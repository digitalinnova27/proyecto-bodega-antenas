/**
 * ChatContext.jsx
 *
 * Estado global del chat interno entre colaboradores.
 * Gestiona conversaciones, mensajes no leídos y la conexión al socket.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { api, getToken } from '../lib/api'
import { getSocket } from '../lib/socket'

const ChatContext = createContext(null)

export function ChatProvider({ children }) {
  // { [userId]: Message[] }  — conversaciones cargadas en memoria
  const [conversations, setConversations] = useState({})
  // { [userId]: number }     — mensajes no leídos por remitente
  const [unreadByUser, setUnreadByUser] = useState({})
  // Total de no leídos (suma de todos los remitentes)
  const [totalUnread, setTotalUnread] = useState(0)
  // Panel abierto: null | userId  (con quién se está chateando)
  const [openWith, setOpenWith] = useState(null)
  // Notificación emergente
  const [notification, setNotification] = useState(null) // { msg, sender }
  const notifTimer = useRef(null)
  // { [userId]: true }  — quién está escribiendo ahora mismo (en vivo, no se
  // guarda en la base de datos, solo dura mientras la otra persona escribe)
  const [typingUsers, setTypingUsers] = useState({})
  const typingTimers = useRef({}) // [userId]: timeout — auto-limpia si no llega el "dejó de escribir"

  // ── Cargar no leídos al iniciar sesión ───────────────────────────────────────
  // Sincroniza tanto el total como el desglose por remitente desde la base de
  // datos (fuente de verdad) — así el contador es correcto desde el arranque,
  // no solo con los mensajes que lleguen en vivo durante la sesión, y también
  // sirve para "resincronizar" después de marcar algo como leído, evitando que
  // el número quede pegado si el conteo local no coincidía con el real.
  const loadUnread = useCallback(async () => {
    if (!getToken()) return
    try {
      const res = await api.get('/api/chat/unread')
      if (res?.ok) {
        setTotalUnread(res.count || 0)
        setUnreadByUser(res.bySender || {})
      }
    } catch {}
  }, [])

  useEffect(() => {
    loadUnread()
    const onAuth = () => loadUnread()
    window.addEventListener('inoise:auth-changed', onAuth)
    return () => window.removeEventListener('inoise:auth-changed', onAuth)
  }, [loadUnread])

  // ── Socket: escuchar mensajes entrantes ──────────────────────────────────────
  useEffect(() => {
    const socket = getSocket()
    if (!socket) return

    const handler = (msg) => {
      // Parsear metadata si viene como string
      const parsed = {
        ...msg,
        metadata: typeof msg.metadata === 'string'
          ? (() => { try { return JSON.parse(msg.metadata) } catch { return null } })()
          : msg.metadata
      }

      // Actualizar conversación en memoria si ya está cargada
      setConversations(prev => {
        const conv = prev[parsed.from_user] || []
        return { ...prev, [parsed.from_user]: [...conv, parsed] }
      })

      // Si el chat está abierto con ese usuario, marcar como leído de inmediato.
      // IMPORTANTE: openWith se resetea a null en closeChat(), que ahora se
      // invoca también al cerrar el panel completo (no solo una conversación
      // individual) — ver handlePanelClose en ChatPanel.jsx. Antes openWith
      // quedaba "pegado" al último contacto aunque el panel ya estuviera
      // cerrado, así que los mensajes nuevos se marcaban leídos en silencio
      // sin avisar ni sumar al contador.
      if (openWith === parsed.from_user) {
        api.patch(`/api/chat/conversation/read?with=${parsed.from_user}`).catch(() => {})
      } else {
        // Incrementar contador de no leídos
        setUnreadByUser(prev => ({
          ...prev,
          [parsed.from_user]: (prev[parsed.from_user] || 0) + 1
        }))
        setTotalUnread(t => t + 1)
        showNotification(parsed)
      }
    }

    socket.on('chat:message', handler)
    return () => socket.off('chat:message', handler)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openWith])

  // ── Socket: "escribiendo..." ──────────────────────────────────────────────────
  useEffect(() => {
    const socket = getSocket()
    if (!socket) return

    const handler = ({ from, isTyping } = {}) => {
      if (!from) return
      if (typingTimers.current[from]) clearTimeout(typingTimers.current[from])

      if (isTyping) {
        setTypingUsers(prev => ({ ...prev, [from]: true }))
        // Auto-limpia a los 4s por si el "dejó de escribir" no llega nunca
        // (se cerró la app, se cayó la conexión, etc.)
        typingTimers.current[from] = setTimeout(() => {
          setTypingUsers(prev => ({ ...prev, [from]: false }))
        }, 4000)
      } else {
        setTypingUsers(prev => ({ ...prev, [from]: false }))
      }
    }

    socket.on('chat:typing', handler)
    return () => socket.off('chat:typing', handler)
  }, [])

  // ── Socket: avisos de "leído" en tiempo real ────────────────────────────────────
  // Cuando la otra persona abre la conversación y marca tus mensajes como
  // leídos, el servidor te avisa acá — así se puede mostrar el doble check
  // sin tener que recargar ni volver a pedir la conversación.
  useEffect(() => {
    const socket = getSocket()
    if (!socket) return

    const handler = ({ by } = {}) => {
      if (!by) return
      const now = new Date().toISOString()
      setConversations(prev => {
        const conv = prev[by]
        if (!conv) return prev
        return {
          ...prev,
          [by]: conv.map(m => (m.to_user === by && !m.read_at) ? { ...m, read_at: now } : m)
        }
      })
    }

    socket.on('chat:read', handler)
    return () => socket.off('chat:read', handler)
  }, [])

  // ── Emitir "estoy escribiendo" / "dejé de escribir" ─────────────────────────────
  const sendTyping = useCallback((toUser, isTyping) => {
    const socket = getSocket()
    if (!socket || !toUser) return
    socket.emit('chat:typing', { to: toUser, isTyping })
  }, [])

  // ── Notificación emergente ────────────────────────────────────────────────────
  const showNotification = useCallback((msg) => {
    setNotification(msg)
    playBell()
    if (notifTimer.current) clearTimeout(notifTimer.current)
    notifTimer.current = setTimeout(() => setNotification(null), 5000)
  }, [])

  const dismissNotification = useCallback(() => {
    setNotification(null)
    if (notifTimer.current) clearTimeout(notifTimer.current)
  }, [])

  // ── Cargar conversación con un usuario ───────────────────────────────────────
  const fetchConversation = useCallback(async (withUserId) => {
    try {
      const res = await api.get(`/api/chat/conversation?with=${withUserId}`)
      if (res?.ok) {
        const msgs = (res.data || []).map(m => ({
          ...m,
          metadata: typeof m.metadata === 'string'
            ? (() => { try { return JSON.parse(m.metadata) } catch { return null } })()
            : m.metadata
        }))
        setConversations(prev => ({ ...prev, [withUserId]: msgs }))
      }
    } catch {}
  }, [])

  // ── Abrir chat con un usuario ─────────────────────────────────────────────────
  const openChat = useCallback(async (userId) => {
    setOpenWith(userId)
    await fetchConversation(userId)
    // Marcar como leídos. En vez de restar localmente lo que unreadByUser[userId]
    // tenía contado (que puede ser 0 si esos mensajes eran de antes de esta
    // sesión y nunca pasaron por el socket), se resincroniza todo desde la
    // base de datos — así el contador siempre queda exacto, sin quedar pegado.
    try {
      await api.patch(`/api/chat/conversation/read?with=${userId}`)
      setUnreadByUser(prev => ({ ...prev, [userId]: 0 }))
      await loadUnread()
    } catch {}
  }, [fetchConversation, loadUnread])

  const closeChat = useCallback(() => setOpenWith(null), [])

  // ── Enviar mensaje ────────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (toUser, content, type = 'text', metadata = null) => {
    const res = await api.post('/api/chat/messages', { toUser, content, type, metadata })
    if (res?.ok) {
      const msg = res.data
      setConversations(prev => {
        const conv = prev[toUser] || []
        return { ...prev, [toUser]: [...conv, msg] }
      })
    }
    return res
  }, [])

  return (
    <ChatContext.Provider value={{
      conversations,
      unreadByUser,
      totalUnread,
      openWith,
      notification,
      typingUsers,
      openChat,
      closeChat,
      sendMessage,
      sendTyping,
      fetchConversation,
      dismissNotification
    }}>
      {children}
    </ChatContext.Provider>
  )
}

export function useChat() {
  const ctx = useContext(ChatContext)
  if (!ctx) throw new Error('useChat debe usarse dentro de ChatProvider')
  return ctx
}

/* ── Sonido de campanita con Web Audio API (sin archivo externo) ────────── */
function playBell() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()

    // Dos osciladores apilados para dar "cuerpo" de campana
    const freq1 = 880  // La5
    const freq2 = 1320 // Mi6

    ;[freq1, freq2].forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = 'sine'
      osc.frequency.value = freq

      // Envolvente: ataque rápido + decay suave
      const now = ctx.currentTime + i * 0.05
      gain.gain.setValueAtTime(0, now)
      gain.gain.linearRampToValueAtTime(i === 0 ? 0.4 : 0.25, now + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8)

      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 0.85)
    })
  } catch {
    // El navegador puede bloquear AudioContext sin interacción previa; ignorar
  }
}
