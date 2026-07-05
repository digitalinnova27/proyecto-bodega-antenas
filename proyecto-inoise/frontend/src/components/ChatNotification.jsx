/**
 * ChatNotification.jsx
 *
 * Ventana emergente estilo WhatsApp que aparece cuando llega un mensaje nuevo
 * mientras el chat no está abierto con ese remitente.
 * Se auto-descarta después de 5 segundos o al hacer clic.
 */

import React, { useEffect, useState } from 'react'
import { Box, Typography, IconButton, Avatar } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import ChatBubbleIcon from '@mui/icons-material/ChatBubble'
import EventIcon from '@mui/icons-material/Event'
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import { useChat } from '../context/ChatContext'
import { useAuth } from '../context/AuthContext'

/* ─── Formatea el preview del mensaje ────────────────────────────────────── */
function getPreview(msg) {
  if (!msg) return ''
  if (msg.type === 'event_ref') return `📅 Evento: ${msg.metadata?.refNumber || ''}`
  if (msg.type === 'rental_ref') return `🚚 Arriendo: ${msg.metadata?.refNumber || ''}`
  const text = msg.content || ''
  return text.length > 80 ? text.slice(0, 80) + '…' : text
}

const AVATAR_COLORS = [
  '#1D9E75','#378ADD','#EF9F27','#E24B4A',
  '#7C3AED','#F59E0B','#EC4899','#6366F1'
]

export default function ChatNotification() {
  const { notification, dismissNotification, openChat } = useChat()
  const { users = [] } = useAuth()

  const [visible, setVisible] = useState(false)
  const [animOut, setAnimOut] = useState(false)

  useEffect(() => {
    if (notification) {
      setAnimOut(false)
      setVisible(true)
    }
  }, [notification])

  const handleDismiss = () => {
    setAnimOut(true)
    setTimeout(() => {
      setVisible(false)
      dismissNotification()
    }, 250)
  }

  const handleOpen = () => {
    if (notification?.from_user) {
      openChat(notification.from_user)
    }
    handleDismiss()
  }

  if (!visible || !notification) return null

  // Buscar el remitente en la lista de usuarios (si está disponible)
  const sender = users?.find?.(u => u.id === notification.from_user)
  const senderName = sender
    ? `${sender.nombre} ${sender.apellido}`
    : (notification.from_user || 'Colaborador')

  const avatarColor = AVATAR_COLORS[senderName.charCodeAt(0) % AVATAR_COLORS.length]
  const preview = getPreview(notification)

  return (
    <Box
      onClick={handleOpen}
      sx={{
        position: 'fixed',
        bottom: 88,
        right: 24,
        width: 320,
        bgcolor: '#1F2833',
        border: '1px solid rgba(102,252,241,0.25)',
        borderRadius: 2.5,
        boxShadow: '0 12px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(102,252,241,0.08)',
        zIndex: 2000,
        cursor: 'pointer',
        overflow: 'hidden',
        opacity: animOut ? 0 : 1,
        transform: animOut ? 'translateY(12px)' : 'translateY(0)',
        transition: 'opacity 0.25s ease, transform 0.25s ease',
        animation: 'chatNotifIn 0.3s cubic-bezier(.22,1,.36,1)',
        '@keyframes chatNotifIn': {
          from: { opacity: 0, transform: 'translateY(20px) scale(0.95)' },
          to:   { opacity: 1, transform: 'translateY(0) scale(1)' }
        }
      }}
    >
      {/* Barra de progreso superior */}
      <Box sx={{
        height: 3,
        bgcolor: 'rgba(102,252,241,0.3)',
        position: 'relative',
        overflow: 'hidden',
        '&::after': {
          content: '""',
          position: 'absolute',
          top: 0, left: 0, bottom: 0,
          bgcolor: '#66FCF1',
          animation: 'notifProgress 5s linear forwards',
          '@keyframes notifProgress': {
            from: { width: '100%' },
            to:   { width: '0%' }
          }
        }
      }} />

      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, px: 1.5, py: 1.25 }}>
        {/* Avatar */}
        <Avatar sx={{
          width: 40, height: 40, bgcolor: avatarColor,
          fontSize: 16, fontWeight: 700, flexShrink: 0
        }}>
          {senderName.charAt(0).toUpperCase()}
        </Avatar>

        {/* Contenido */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
            <ChatBubbleIcon sx={{ fontSize: 11, color: '#66FCF1' }} />
            <Typography variant="caption" sx={{ color: '#66FCF1', fontWeight: 700, fontSize: 11 }}>
              Mensaje nuevo
            </Typography>
          </Box>
          <Typography variant="body2" fontWeight={700} sx={{ color: '#fff', lineHeight: 1.2, mb: 0.25 }}>
            {senderName}
          </Typography>
          <Typography variant="caption" sx={{
            color: '#C5C6C7', display: 'block',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
          }}>
            {preview || '(mensaje nuevo)'}
          </Typography>
        </Box>

        {/* Cerrar sin abrir */}
        <IconButton
          size="small"
          onClick={(e) => { e.stopPropagation(); handleDismiss() }}
          sx={{ color: 'rgba(255,255,255,0.35)', mt: -0.5, mr: -0.5 }}
        >
          <CloseIcon sx={{ fontSize: 14 }} />
        </IconButton>
      </Box>

      {/* Hint de acción */}
      <Box sx={{
        bgcolor: 'rgba(102,252,241,0.05)',
        borderTop: '1px solid rgba(102,252,241,0.1)',
        px: 1.5, py: 0.75
      }}>
        <Typography variant="caption" sx={{ color: '#66FCF1', fontSize: 11, fontWeight: 600 }}>
          Toca para abrir el chat →
        </Typography>
      </Box>
    </Box>
  )
}
