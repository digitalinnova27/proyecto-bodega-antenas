import React, { createContext, useContext, useState, useCallback } from 'react'
import { api, setToken, clearToken, getToken } from '../lib/api'
import { getSocket, authenticateSocket, deauthenticateSocket } from '../lib/socket'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)
  const [users, setUsers] = useState([])
  const [usersLoaded, setUsersLoaded] = useState(false)
  // null = aún cargando, true/false = resultado de /api/auth/status
  const [hasAnyUsers, setHasAnyUsers] = useState(null)
  // Lista mínima de usuarios para la pantalla de login (sin token)
  const [loginUsers, setLoginUsers] = useState([])
  // ID de la sesión activa en BD (solo en memoria — no persistir en sessionStorage)
  const [sessionId, setSessionId] = useState(null)
  // IDs de usuarios actualmente conectados (actualizado vía Socket.io)
  const [onlineUserIds, setOnlineUserIds] = useState([])

  // ── Cargar lista de usuarios ───────────────────────────────────────────────
  const loadUsers = useCallback(async () => {
    try {
      const res = await api.get('/api/users')
      const list = (res.ok && Array.isArray(res.data)) ? res.data : []
      setUsers(list)
      setUsersLoaded(true)
      return list
    } catch (e) {
      console.error('[Auth] loadUsers:', e)
      setUsersLoaded(true)
      return []
    }
  }, [])

  // ── Eventos de Socket.io ───────────────────────────────────────────────────
  React.useEffect(() => {
    const sock = getSocket()

    // Recibir lista de usuarios online desde el servidor
    const onOnlineUsers = (list) => {
      setOnlineUserIds((list || []).map(u => u.userId))
    }

    // Reautenticarse tras reconexión (ej. pérdida de red momentánea)
    const onConnect = () => {
      const token = getToken()
      if (token) authenticateSocket(token, null)
    }

    // Actualización de usuarios desde otros clientes
    const onUsersUpdated = () => {
      loadUsers()
      api.get('/api/auth/status').then(res => {
        if (res.ok) {
          setHasAnyUsers(res.hasUsers)
          if (Array.isArray(res.users)) setLoginUsers(res.users)
        }
      }).catch(() => {})
    }

    sock.on('online:users', onOnlineUsers)
    sock.on('connect', onConnect)
    sock.on('users:updated', onUsersUpdated)

    return () => {
      sock.off('online:users', onOnlineUsers)
      sock.off('connect', onConnect)
      sock.off('users:updated', onUsersUpdated)
    }
  }, [loadUsers])

  // ── Login con contraseña ───────────────────────────────────────────────────
  // expectedRole (opcional): si se pasa, valida que el usuario tenga ese rol
  // ANTES de guardar token/sesión. Esto es clave — App.jsx decide qué mostrar
  // (login vs. app completa) según currentUser/role en este contexto, así
  // que si primero autenticábamos y recién después revisábamos el rol, la
  // app ya había cambiado a la vista completa por una fracción de segundo
  // (ej. un Administrador entrando desde la tarjeta "Operador" alcanzaba a
  // ver el dashboard antes de que el chequeo posterior cerrara la sesión).
  // Validar antes de comprometer el estado evita ese parpadeo por completo.
  const login = useCallback(async (username, password, expectedRole) => {
    try {
      const res = await api.post('/api/auth/login', { username, password })
      if (res.ok && res.data && res.token) {
        if (expectedRole && res.data.role !== expectedRole) {
          return { ok: false, error: 'El usuario no corresponde al perfil seleccionado' }
        }
        setToken(res.token)
        setCurrentUser(res.data)
        setSessionId(res.sessionId || null)
        await loadUsers()
        // Registrar como online en el servidor
        authenticateSocket(res.token, res.sessionId || null)
        window.dispatchEvent(new Event('inoise:auth-changed'))
        return { ok: true, user: res.data }
      }
      return { ok: false, error: res.error || 'Usuario o contraseña incorrectos' }
    } catch (e) {
      return { ok: false, error: 'Sin conexión con el servidor' }
    }
  }, [loadUsers])

  // ── Login con PIN ──────────────────────────────────────────────────────────
  const loginPin = useCallback(async (userId, pin) => {
    try {
      const res = await api.post('/api/auth/login-pin', { userId, pin })
      if (res.ok && res.data && res.token) {
        setToken(res.token)
        setCurrentUser(res.data)
        setSessionId(res.sessionId || null)
        await loadUsers()
        authenticateSocket(res.token, res.sessionId || null)
        window.dispatchEvent(new Event('inoise:auth-changed'))
        return { ok: true, user: res.data }
      }
      return { ok: false, error: 'PIN incorrecto' }
    } catch (e) {
      return { ok: false, error: 'Sin conexión con el servidor' }
    }
  }, [loadUsers])

  // ── Logout ─────────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    // 1. Cerrar sesión en BD (fire-and-forget — no bloquear la UI)
    if (sessionId) {
      api.post('/api/auth/logout', { sessionId }).catch(() => {})
    }
    // 2. Quitar del mapa de online en el servidor
    deauthenticateSocket()
    // 3. Limpiar estado local
    clearToken()
    setCurrentUser(null)
    setUsers([])
    setUsersLoaded(false)
    setSessionId(null)
  }, [sessionId])

  // ── CRUD de usuarios ───────────────────────────────────────────────────────
  const createUser = useCallback(async (data, password) => {
    try {
      const res = await api.post('/api/users', { data, password })
      if (res.ok) await loadUsers()
      return res
    } catch (e) {
      console.error('[Auth] createUser:', e)
      return { ok: false, error: 'Sin conexión con el servidor' }
    }
  }, [loadUsers])

  const updateUser = useCallback(async (id, fields, newPassword) => {
    try {
      const res = await api.put(`/api/users/${id}`, { fields, newPassword: newPassword || null })
      if (res.ok) {
        await loadUsers()
        if (currentUser?.id === id) setCurrentUser(prev => ({ ...prev, ...fields }))
      }
      return res
    } catch (e) {
      return { ok: false, error: 'Sin conexión con el servidor' }
    }
  }, [loadUsers, currentUser])

  const deleteUser = useCallback(async (id) => {
    try {
      const res = await api.delete(`/api/users/${id}`)
      if (res.ok) await loadUsers()
      return res
    } catch (e) {
      return { ok: false, error: 'Sin conexión con el servidor' }
    }
  }, [loadUsers])

  // ── Verificar contraseña sin cambiar sesión ────────────────────────────────
  const verifyAdminPassword = useCallback(async (password) => {
    if (!currentUser) return false
    try {
      const res = await api.post('/api/auth/verify', { password })
      return res.ok === true
    } catch {
      return false
    }
  }, [currentUser])

  // ── PIN ────────────────────────────────────────────────────────────────────
  const setUserPin = useCallback(async (userId, pin) => {
    try {
      const res = await api.post(`/api/users/${userId}/pin`, { pin })
      if (res.ok) {
        await loadUsers()
        if (currentUser?.id === userId) setCurrentUser(prev => ({ ...prev, hasPin: true }))
      }
      return res
    } catch (e) {
      return { ok: false, error: 'Sin conexión con el servidor' }
    }
  }, [loadUsers, currentUser])

  const removeUserPin = useCallback(async (userId) => {
    try {
      const res = await api.delete(`/api/users/${userId}/pin`)
      if (res.ok) {
        await loadUsers()
        if (currentUser?.id === userId) setCurrentUser(prev => ({ ...prev, hasPin: false }))
      }
      return res
    } catch (e) {
      return { ok: false, error: 'Sin conexión con el servidor' }
    }
  }, [loadUsers, currentUser])

  const setUserActive = useCallback(async (userId, active) => {
    try {
      const res = await api.patch(`/api/users/${userId}/active`, { active })
      if (res.ok) await loadUsers()
      return res
    } catch (e) {
      return { ok: false, error: 'Sin conexión con el servidor' }
    }
  }, [loadUsers])

  // ── Recuperar contraseña olvidada ──────────────────────────────────────────
  // Públicas (sin token) — se usan justamente cuando no se puede iniciar sesión.
  const forgotPassword = useCallback(async (username) => {
    try { return await api.post('/api/auth/forgot-password', { username }) }
    catch (e) { return { ok: false, error: 'Sin conexión con el servidor' } }
  }, [])

  const resetPasswordWithCode = useCallback(async (username, code, newPassword) => {
    try { return await api.post('/api/auth/reset-password', { username, code, newPassword }) }
    catch (e) { return { ok: false, error: 'Sin conexión con el servidor' } }
  }, [])

  // ── Credenciales por correo (SMTP) ─────────────────────────────────────────
  const getSmtpConfig = useCallback(async () => {
    try { return await api.get('/api/settings/smtp') }
    catch (e) { return { ok: false, error: 'Sin conexión con el servidor' } }
  }, [])

  const setSmtpConfig = useCallback(async (config) => {
    try { return await api.post('/api/settings/smtp', config) }
    catch (e) { return { ok: false, error: 'Sin conexión con el servidor' } }
  }, [])

  const sendCredentialsEmail = useCallback(async (userId, password, accessUrl) => {
    try { return await api.post(`/api/users/${userId}/send-credentials`, { password, accessUrl }) }
    catch (e) { return { ok: false, error: 'Sin conexión con el servidor' } }
  }, [])

  // ── Restaurar sesión desde sessionStorage al recargar página ──────────────
  React.useEffect(() => {
    // Consultar si existen usuarios (endpoint público).
    api.get('/api/auth/status')
      .then(res => {
        if (res.ok) {
          setHasAnyUsers(res.hasUsers)
          if (Array.isArray(res.users)) setLoginUsers(res.users)
        } else {
          setHasAnyUsers(false)
        }
      })
      .catch(() => setHasAnyUsers(false))

    const token = getToken()
    if (!token) { setUsersLoaded(true); return }

    // Token existe → autenticar socket (recarga de página, sessionId perdido)
    authenticateSocket(token, null)

    // Cargar usuarios para verificar que el token sigue vigente.
    loadUsers().catch(() => setUsersLoaded(true))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AuthContext.Provider value={{
      currentUser,
      role: currentUser?.role ?? null,
      users,
      usersLoaded,
      hasAnyUsers,
      loginUsers,
      isAuthenticated: Boolean(currentUser),
      onlineUserIds,
      sessionId,
      loadUsers,
      login,
      loginPin,
      logout,
      createUser,
      updateUser,
      deleteUser,
      verifyAdminPassword,
      setUserPin,
      removeUserPin,
      setUserActive,
      getSmtpConfig,
      setSmtpConfig,
      sendCredentialsEmail,
      forgotPassword,
      resetPasswordWithCode
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
