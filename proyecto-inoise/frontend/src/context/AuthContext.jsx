import React, { createContext, useContext, useState, useCallback } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)   // objeto usuario completo (sin passwordHash)
  const [users, setUsers] = useState([])                  // todos los usuarios (para admin CRUD)
  const [usersLoaded, setUsersLoaded] = useState(false)   // ¿ya consultamos la BD?

  // Carga lista de usuarios desde SQLite (incluye passwordHash para CRUD interno)
  const loadUsers = useCallback(async () => {
    if (!window.api?.loadUsers) { setUsersLoaded(true); return [] }
    try {
      const res = await window.api.loadUsers()
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

  // Autenticar — llama al main process que hace scrypt internamente
  const login = useCallback(async (username, password) => {
    if (!window.api?.authLogin) return { ok: false, error: 'Sin API' }
    const res = await window.api.authLogin(username, password)
    if (res.ok && res.data) {
      setCurrentUser(res.data)
      return { ok: true, user: res.data }
    }
    return { ok: false, error: 'Usuario o contraseña incorrectos' }
  }, [])

  const logout = useCallback(() => {
    setCurrentUser(null)
  }, [])

  // Crear usuario — disponible en first-run y desde Settings (admin)
  const createUser = useCallback(async (data, password) => {
    if (!window.api?.createUser) return { ok: false, error: 'Sin API' }
    try {
      const res = await window.api.createUser(data, password)
      if (res.ok) await loadUsers()
      return res
    } catch (e) {
      console.error('[Auth] createUser:', e)
      return { ok: false, error: 'Sin conexión con la base de datos' }
    }
  }, [loadUsers])

  // Actualizar usuario — admin puede cambiar cualquier perfil
  const updateUser = useCallback(async (id, fields, newPassword) => {
    if (!window.api?.updateUser) return { ok: false, error: 'Sin API' }
    const res = await window.api.updateUser(id, fields, newPassword || null)
    if (res.ok) {
      await loadUsers()
      // Si se edita el usuario actual, actualizar el estado local también
      if (currentUser?.id === id) {
        setCurrentUser(prev => ({ ...prev, ...fields }))
      }
    }
    return res
  }, [loadUsers, currentUser])

  // Eliminar usuario — admin no puede eliminarse a sí mismo
  const deleteUser = useCallback(async (id) => {
    if (!window.api?.deleteUser) return { ok: false, error: 'Sin API' }
    const res = await window.api.deleteUser(id)
    if (res.ok) await loadUsers()
    return res
  }, [loadUsers])

  // Verificar contraseña sin cambiar sesión (funciona para cualquier rol)
  const verifyAdminPassword = useCallback(async (password) => {
    if (!currentUser || !window.api?.authLogin) return false
    const res = await window.api.authLogin(currentUser.username, password)
    return res.ok && Boolean(res.data)
  }, [currentUser])

  // PIN de acceso rápido
  const loginPin = useCallback(async (userId, pin) => {
    if (!window.api?.authLoginPin) return { ok: false, error: 'Sin API' }
    const res = await window.api.authLoginPin(userId, pin)
    if (res.ok && res.data) {
      setCurrentUser(res.data)
      return { ok: true, user: res.data }
    }
    return { ok: false, error: 'PIN incorrecto' }
  }, [])

  const setUserPin = useCallback(async (userId, pin) => {
    if (!window.api?.setUserPin) return { ok: false, error: 'Sin API' }
    const res = await window.api.setUserPin(userId, pin)
    if (res.ok) {
      await loadUsers()
      if (currentUser?.id === userId) setCurrentUser(prev => ({ ...prev, hasPin: true }))
    }
    return res
  }, [loadUsers, currentUser])

  const removeUserPin = useCallback(async (userId) => {
    if (!window.api?.removeUserPin) return { ok: false, error: 'Sin API' }
    const res = await window.api.removeUserPin(userId)
    if (res.ok) {
      await loadUsers()
      if (currentUser?.id === userId) setCurrentUser(prev => ({ ...prev, hasPin: false }))
    }
    return res
  }, [loadUsers, currentUser])

  return (
    <AuthContext.Provider value={{
      currentUser,
      role: currentUser?.role ?? null,
      users,
      usersLoaded,
      isAuthenticated: Boolean(currentUser),
      loadUsers,
      login,
      loginPin,
      logout,
      createUser,
      updateUser,
      deleteUser,
      verifyAdminPassword,
      setUserPin,
      removeUserPin
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
