/**
 * ChatPanel.jsx
 *
 * Panel de chat flotante estilo WhatsApp Web.
 * Muestra lista de colaboradores a la izquierda y conversación a la derecha.
 * Soporta mensajes de texto, emojis, y referencias a eventos/rentas.
 */

import React, { useState, useRef, useEffect } from 'react'
import {
  Box, Typography, IconButton, TextField, Badge, Divider,
  Tooltip, Avatar, CircularProgress, Chip
} from '@mui/material'
import SendIcon from '@mui/icons-material/Send'
import CloseIcon from '@mui/icons-material/Close'
import EmojiEmotionsIcon from '@mui/icons-material/EmojiEmotions'
import EventIcon from '@mui/icons-material/Event'
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import SupportAgentIcon from '@mui/icons-material/SupportAgent'

import { useChat } from '../context/ChatContext'
import { useAuth } from '../context/AuthContext'
import { useInventory } from '../context/InventoryContext'
import { HELP_FAQ, searchFaq } from '../data/helpFaq'

/* ── Contacto virtual: Asistente de ayuda (búsqueda local en FAQ, sin
 * backend ni IA externa) ─────────────────────────────────────────────── */
const ASSISTANT_ID = '__assistant__'
const ASSISTANT_SUGGESTED_IDS = ['crear-evento', 'disponibilidad-fecha', 'fases-operaciones', 'incidencias', 'chat-interno']

/* ── Paleta de emojis de uso frecuente ───────────────────────────────────── */
const EMOJI_ROWS = [
  ['😀','😂','😊','😍','🤔','😅','🙏','👍','👎','✅','❌','⚠️'],
  ['🔔','📦','📋','📄','🗂️','🔧','🚚','📅','🕐','💬','📞','📌'],
  ['👷','👔','🧑‍💻','👨‍💼','👩‍💼','🦺','🔑','🏷️','💡','🎯','🚨','✨'],
]

/* ── Avatar genérico por nombre ──────────────────────────────────────────── */
function UserAvatar({ name = '?', color = '#378ADD', size = 36 }) {
  return (
    <Avatar sx={{
      width: size, height: size,
      bgcolor: color, fontSize: size * 0.4, fontWeight: 700
    }}>
      {name.charAt(0).toUpperCase()}
    </Avatar>
  )
}

/* ── Chip de referencia a evento o rental ────────────────────────────────── */
function RefChip({ type, metadata, isOwn }) {
  const bg = isOwn ? 'rgba(102,252,241,0.15)' : 'rgba(255,255,255,0.08)'
  const Icon = type === 'event_ref' ? EventIcon : LocalShippingIcon
  const label = type === 'event_ref' ? 'Evento' : 'Arriendo'
  return (
    <Box sx={{
      display: 'flex', alignItems: 'center', gap: 1,
      bgcolor: bg, borderRadius: 1.5, px: 1.5, py: 0.75,
      border: '1px solid rgba(102,252,241,0.2)', minWidth: 160
    }}>
      <Icon sx={{ fontSize: 16, color: '#66FCF1', flexShrink: 0 }} />
      <Box>
        <Typography variant="caption" sx={{ color: '#66FCF1', fontWeight: 600, display: 'block', lineHeight: 1.2 }}>
          {label}: {metadata?.refNumber || ''}
        </Typography>
        <Typography variant="caption" sx={{ color: '#C5C6C7', display: 'block', lineHeight: 1.2, fontSize: 11 }}>
          {metadata?.refName || ''}
        </Typography>
      </Box>
    </Box>
  )
}

/* ── Burbuja de mensaje ──────────────────────────────────────────────────── */
function MessageBubble({ msg, isOwn }) {
  const ts = msg.created_at
    ? new Date(msg.created_at).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
    : ''

  return (
    <Box sx={{
      display: 'flex',
      justifyContent: isOwn ? 'flex-end' : 'flex-start',
      mb: 0.75, px: 1
    }}>
      <Box sx={{
        maxWidth: '72%',
        bgcolor: isOwn ? 'rgba(102,252,241,0.18)' : 'rgba(255,255,255,0.07)',
        borderRadius: isOwn ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
        px: 1.5, py: 0.75,
        border: isOwn ? '1px solid rgba(102,252,241,0.25)' : '1px solid rgba(255,255,255,0.08)'
      }}>
        {(msg.type === 'event_ref' || msg.type === 'rental_ref') && (
          <Box sx={{ mb: msg.content ? 0.5 : 0 }}>
            <RefChip type={msg.type} metadata={msg.metadata} isOwn={isOwn} />
          </Box>
        )}
        {msg.content && (
          <Typography variant="body2" sx={{ color: '#E8E8E8', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.45 }}>
            {msg.content}
          </Typography>
        )}
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, display: 'block', textAlign: 'right', mt: 0.25 }}>
          {ts}
        </Typography>
      </Box>
    </Box>
  )
}

/* ── Panel de la conversación (derecha) ─────────────────────────────────── */
function ConversationPanel({ user, onClose }) {
  const { conversations, sendMessage, openWith } = useChat()
  const { currentUser } = useAuth()
  const { events, rentals } = useInventory()
  const msgs = conversations[user.id] || []

  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [showEmoji, setShowEmoji] = useState(false)
  const [showRefPicker, setShowRefPicker] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  // Scroll al fondo cuando llegan mensajes nuevos
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs.length])

  const handleSend = async () => {
    const trimmed = text.trim()
    if (!trimmed || sending) return
    setSending(true)
    setText('')
    setShowEmoji(false)
    await sendMessage(user.id, trimmed, 'text')
    setSending(false)
    inputRef.current?.focus()
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const insertEmoji = (emoji) => {
    setText(t => t + emoji)
    setShowEmoji(false)
    inputRef.current?.focus()
  }

  const sendRef = async (type, item) => {
    setShowRefPicker(false)
    await sendMessage(user.id, '', type, {
      refId: item.id,
      refNumber: item.orderNumber,
      refName: item.name || item.clientName || ''
    })
  }

  // Calcular iniciales y color del avatar del interlocutor
  const displayName = `${user.nombre} ${user.apellido}`
  const AVATAR_COLORS = ['#1D9E75','#378ADD','#EF9F27','#E24B4A','#7C3AED','#F59E0B','#EC4899','#6366F1']
  const avatarColor = AVATAR_COLORS[displayName.charCodeAt(0) % AVATAR_COLORS.length]

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', minWidth: 0 }}>

      {/* Header */}
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 1.5,
        px: 2, py: 1.5,
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        bgcolor: 'rgba(255,255,255,0.02)'
      }}>
        <UserAvatar name={displayName} color={avatarColor} size={34} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" fontWeight={600} sx={{ color: '#E8E8E8', lineHeight: 1.2 }}>
            {displayName}
          </Typography>
          <Typography variant="caption" sx={{ color: '#888', fontSize: 11 }}>
            {user.cargo || user.role}
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose} sx={{ color: 'rgba(255,255,255,0.4)' }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* Mensajes */}
      <Box sx={{ flex: 1, overflowY: 'auto', py: 1.5 }}>
        {msgs.length === 0 && (
          <Box sx={{ textAlign: 'center', pt: 4 }}>
            <Typography variant="caption" sx={{ color: '#555' }}>
              Sin mensajes aún. ¡Inicia la conversación!
            </Typography>
          </Box>
        )}
        {msgs.map((m, i) => (
          <MessageBubble
            key={m.id ?? i}
            msg={m}
            isOwn={m.from_user === currentUser?.id}
          />
        ))}
        <div ref={bottomRef} />
      </Box>

      {/* Picker de referencias (eventos / rentas) */}
      {showRefPicker && (
        <Box sx={{
          borderTop: '1px solid rgba(255,255,255,0.08)',
          bgcolor: '#141820',
          maxHeight: 200, overflowY: 'auto', px: 1, py: 1
        }}>
          <Typography variant="caption" sx={{ color: '#888', px: 1, display: 'block', mb: 0.5 }}>
            Eventos activos
          </Typography>
          {events.filter(e => !['Concluido', 'Cancelado'].includes(e.status)).slice(0, 10).map(ev => (
            <Box key={ev.id}
              onClick={() => sendRef('event_ref', ev)}
              sx={{
                display: 'flex', alignItems: 'center', gap: 1, px: 1, py: 0.5,
                borderRadius: 1, cursor: 'pointer',
                '&:hover': { bgcolor: 'rgba(102,252,241,0.07)' }
              }}>
              <EventIcon sx={{ fontSize: 14, color: '#66FCF1', flexShrink: 0 }} />
              <Typography variant="caption" sx={{ color: '#C5C6C7' }}>
                {ev.orderNumber} — {ev.name}
              </Typography>
            </Box>
          ))}
          <Divider sx={{ my: 0.5, borderColor: 'rgba(255,255,255,0.06)' }} />
          <Typography variant="caption" sx={{ color: '#888', px: 1, display: 'block', mb: 0.5 }}>
            Arriendos activos
          </Typography>
          {rentals.filter(r => r.status !== 'Concluido').slice(0, 10).map(r => (
            <Box key={r.id}
              onClick={() => sendRef('rental_ref', r)}
              sx={{
                display: 'flex', alignItems: 'center', gap: 1, px: 1, py: 0.5,
                borderRadius: 1, cursor: 'pointer',
                '&:hover': { bgcolor: 'rgba(102,252,241,0.07)' }
              }}>
              <LocalShippingIcon sx={{ fontSize: 14, color: '#66FCF1', flexShrink: 0 }} />
              <Typography variant="caption" sx={{ color: '#C5C6C7' }}>
                {r.orderNumber} — {r.name}
              </Typography>
            </Box>
          ))}
        </Box>
      )}

      {/* Emoji picker */}
      {showEmoji && (
        <Box sx={{
          borderTop: '1px solid rgba(255,255,255,0.08)',
          bgcolor: '#141820', px: 1.5, py: 1
        }}>
          {EMOJI_ROWS.map((row, ri) => (
            <Box key={ri} sx={{ display: 'flex', gap: 0.5, mb: 0.5 }}>
              {row.map(e => (
                <Box key={e}
                  onClick={() => insertEmoji(e)}
                  sx={{
                    fontSize: 20, cursor: 'pointer', borderRadius: 1, px: 0.5, py: 0.25,
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' },
                    userSelect: 'none'
                  }}
                >
                  {e}
                </Box>
              ))}
            </Box>
          ))}
        </Box>
      )}

      {/* Área de entrada */}
      <Box sx={{
        display: 'flex', alignItems: 'flex-end', gap: 0.5,
        px: 1.5, py: 1,
        borderTop: '1px solid rgba(255,255,255,0.08)',
        bgcolor: 'rgba(255,255,255,0.01)'
      }}>
        {/* Botón referencias evento/rental */}
        <Tooltip title="Compartir evento o arriendo">
          <IconButton
            size="small"
            onClick={() => { setShowRefPicker(v => !v); setShowEmoji(false) }}
            sx={{ color: showRefPicker ? '#66FCF1' : 'rgba(255,255,255,0.35)', mb: 0.5 }}
          >
            <EventIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        {/* Botón emoji */}
        <Tooltip title="Emojis">
          <IconButton
            size="small"
            onClick={() => { setShowEmoji(v => !v); setShowRefPicker(false) }}
            sx={{ color: showEmoji ? '#66FCF1' : 'rgba(255,255,255,0.35)', mb: 0.5 }}
          >
            <EmojiEmotionsIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        {/* Campo de texto */}
        <TextField
          inputRef={inputRef}
          multiline maxRows={4}
          size="small"
          fullWidth
          placeholder="Escribe un mensaje..."
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          sx={{
            '& .MuiOutlinedInput-root': {
              bgcolor: 'rgba(255,255,255,0.05)',
              borderRadius: 3,
              fontSize: 13,
              '& fieldset': { borderColor: 'rgba(255,255,255,0.12)' },
              '&:hover fieldset': { borderColor: 'rgba(102,252,241,0.3)' },
              '&.Mui-focused fieldset': { borderColor: '#66FCF1' }
            },
            '& .MuiOutlinedInput-input': { color: '#E8E8E8', py: '8px' }
          }}
        />

        {/* Botón enviar */}
        <IconButton
          size="small"
          onClick={handleSend}
          disabled={!text.trim() || sending}
          sx={{
            mb: 0.5, bgcolor: text.trim() ? '#66FCF1' : 'rgba(255,255,255,0.08)',
            color: text.trim() ? '#0B0C10' : 'rgba(255,255,255,0.3)',
            '&:hover': { bgcolor: text.trim() ? '#4dd9d0' : 'rgba(255,255,255,0.12)' },
            '&.Mui-disabled': { bgcolor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.2)' },
            transition: 'all 0.15s'
          }}
        >
          {sending ? <CircularProgress size={16} sx={{ color: 'inherit' }} /> : <SendIcon fontSize="small" />}
        </IconButton>
      </Box>
    </Box>
  )
}

/* ── Burbuja de mensaje del asistente (usuario ↔ respuestas locales) ────── */
function AssistantBubble({ msg }) {
  const isOwn = msg.from === 'user'
  return (
    <Box sx={{ display: 'flex', justifyContent: isOwn ? 'flex-end' : 'flex-start', mb: 0.75, px: 1 }}>
      <Box sx={{
        maxWidth: '80%',
        bgcolor: isOwn ? 'rgba(102,252,241,0.18)' : 'rgba(255,255,255,0.07)',
        borderRadius: isOwn ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
        px: 1.5, py: 0.9,
        border: isOwn ? '1px solid rgba(102,252,241,0.25)' : '1px solid rgba(255,255,255,0.08)'
      }}>
        {msg.category && (
          <Chip
            label={msg.category}
            size="small"
            sx={{ mb: 0.75, height: 18, fontSize: 10, fontWeight: 600, bgcolor: 'rgba(102,252,241,0.15)', color: '#66FCF1' }}
          />
        )}
        <Typography variant="body2" sx={{ color: '#E8E8E8', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.5 }}>
          {msg.content}
        </Typography>
      </Box>
    </Box>
  )
}

/* ── Panel de conversación con el Asistente de ayuda (derecha) ──────────── *
 * Búsqueda 100% local sobre src/data/helpFaq.js — sin IA externa, sin
 * internet, sin costo. Solo responde dudas de funcionamiento de la app,
 * no de código. El historial vive en memoria de este componente mientras
 * la app está abierta (no se guarda en la base de datos). */
function AssistantConversationPanel({ onClose }) {
  const [messages, setMessages] = useState(() => ([
    {
      id: 'greet',
      from: 'assistant',
      content: '¡Hola! Soy el asistente de ayuda de iNOISE. Pregúntame sobre el funcionamiento del sistema (eventos, inventario, operaciones, chat, etc.). No resuelvo temas de código ni configuración técnica.'
    }
  ]))
  const [text, setText] = useState('')
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  const ask = (question) => {
    const trimmed = question.trim()
    if (!trimmed) return
    const [best] = searchFaq(trimmed, 1)
    const reply = best
      ? { id: `a-${Date.now()}`, from: 'assistant', content: best.answer, category: best.category }
      : { id: `a-${Date.now()}`, from: 'assistant', content: 'No encontré nada sobre eso. Prueba con otras palabras, o menciona la sección (Eventos, Operaciones, Inventario, Chat...).' }
    setMessages(m => [...m, { id: `u-${Date.now()}`, from: 'user', content: trimmed }, reply])
    setText('')
    inputRef.current?.focus()
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      ask(text)
    }
  }

  const suggested = ASSISTANT_SUGGESTED_IDS.map(id => HELP_FAQ.find(e => e.id === id)).filter(Boolean)
  const showSuggestions = messages.length <= 1

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', minWidth: 0 }}>

      {/* Header */}
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 1.5,
        px: 2, py: 1.5,
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        bgcolor: 'rgba(255,255,255,0.02)'
      }}>
        <Avatar sx={{ width: 34, height: 34, bgcolor: '#66FCF1', color: '#0B0C10' }}>
          <SupportAgentIcon fontSize="small" />
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" fontWeight={600} sx={{ color: '#E8E8E8', lineHeight: 1.2 }}>
            Asistente iNOISE
          </Typography>
          <Typography variant="caption" sx={{ color: '#888', fontSize: 11 }}>
            Ayuda y preguntas frecuentes
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose} sx={{ color: 'rgba(255,255,255,0.4)' }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* Mensajes */}
      <Box sx={{ flex: 1, overflowY: 'auto', py: 1.5 }}>
        {messages.map(m => <AssistantBubble key={m.id} msg={m} />)}

        {showSuggestions && (
          <Box sx={{ px: 2, pt: 1 }}>
            <Typography variant="caption" sx={{ color: '#666', display: 'block', mb: 0.75 }}>
              Preguntas frecuentes:
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              {suggested.map(entry => (
                <Box
                  key={entry.id}
                  onClick={() => ask(entry.question)}
                  sx={{
                    px: 1.25, py: 0.9, borderRadius: 1.5, cursor: 'pointer',
                    bgcolor: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    '&:hover': { bgcolor: 'rgba(102,252,241,0.07)', borderColor: 'rgba(102,252,241,0.2)' }
                  }}
                >
                  <Typography variant="caption" sx={{ color: '#C5C6C7', fontSize: 12 }}>
                    {entry.question}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        )}
        <div ref={bottomRef} />
      </Box>

      {/* Área de entrada */}
      <Box sx={{
        display: 'flex', alignItems: 'flex-end', gap: 0.5,
        px: 1.5, py: 1,
        borderTop: '1px solid rgba(255,255,255,0.08)',
        bgcolor: 'rgba(255,255,255,0.01)'
      }}>
        <TextField
          inputRef={inputRef}
          multiline maxRows={4}
          size="small"
          fullWidth
          placeholder="Escribe tu duda..."
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          sx={{
            '& .MuiOutlinedInput-root': {
              bgcolor: 'rgba(255,255,255,0.05)',
              borderRadius: 3,
              fontSize: 13,
              '& fieldset': { borderColor: 'rgba(255,255,255,0.12)' },
              '&:hover fieldset': { borderColor: 'rgba(102,252,241,0.3)' },
              '&.Mui-focused fieldset': { borderColor: '#66FCF1' }
            },
            '& .MuiOutlinedInput-input': { color: '#E8E8E8', py: '8px' }
          }}
        />
        <IconButton
          size="small"
          onClick={() => ask(text)}
          disabled={!text.trim()}
          sx={{
            mb: 0.5, bgcolor: text.trim() ? '#66FCF1' : 'rgba(255,255,255,0.08)',
            color: text.trim() ? '#0B0C10' : 'rgba(255,255,255,0.3)',
            '&:hover': { bgcolor: text.trim() ? '#4dd9d0' : 'rgba(255,255,255,0.12)' },
            '&.Mui-disabled': { bgcolor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.2)' },
            transition: 'all 0.15s'
          }}
        >
          <SendIcon fontSize="small" />
        </IconButton>
      </Box>
    </Box>
  )
}

/* ── Panel principal del chat ─────────────────────────────────────────────── */
export default function ChatPanel({ open, onClose }) {
  const { openWith, openChat, closeChat, unreadByUser } = useChat()
  const { currentUser, users: allUsers = [] } = useAuth()
  const users = allUsers.filter(u => u.id !== currentUser?.id && u.active !== 0)

  const [assistantSelected, setAssistantSelected] = useState(false)

  const selectedUser = users.find(u => u.id === openWith)

  const selectAssistant = () => { setAssistantSelected(true); closeChat() }
  const selectUser = (userId) => { setAssistantSelected(false); openChat(userId) }

  const AVATAR_COLORS = ['#1D9E75','#378ADD','#EF9F27','#E24B4A','#7C3AED','#F59E0B','#EC4899','#6366F1']

  if (!open) return null

  return (
    <>
      {/* Overlay para cerrar al hacer clic fuera */}
      <Box
        onClick={onClose}
        sx={{
          position: 'fixed', inset: 0, zIndex: 1299,
          bgcolor: 'rgba(0,0,0,0.4)'
        }}
      />

      {/* Panel flotante */}
      <Box sx={{
        position: 'fixed',
        bottom: 24, right: 24,
        width: (openWith || assistantSelected) ? 640 : 280,
        height: 520,
        bgcolor: '#1A2030',
        borderRadius: 3,
        border: '1px solid rgba(102,252,241,0.15)',
        boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
        display: 'flex',
        overflow: 'hidden',
        zIndex: 1300,
        transition: 'width 0.25s ease'
      }}>

        {/* ── Lista de colaboradores (izquierda) ── */}
        <Box sx={{
          width: 240, flexShrink: 0,
          display: 'flex', flexDirection: 'column',
          borderRight: (openWith || assistantSelected) ? '1px solid rgba(255,255,255,0.08)' : 'none'
        }}>
          {/* Header del panel */}
          <Box sx={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            px: 2, py: 1.5,
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            bgcolor: 'rgba(102,252,241,0.04)'
          }}>
            <Typography variant="subtitle2" sx={{ color: '#66FCF1', fontWeight: 700, fontSize: 13 }}>
              💬 Chat equipo
            </Typography>
            <IconButton size="small" onClick={onClose} sx={{ color: 'rgba(255,255,255,0.4)' }}>
              <CloseIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Box>

          {/* Lista de usuarios */}
          <Box sx={{ flex: 1, overflowY: 'auto' }}>

            {/* Contacto fijo: Asistente de ayuda (búsqueda local, sin backend) */}
            <Box
              onClick={selectAssistant}
              sx={{
                display: 'flex', alignItems: 'center', gap: 1.5,
                px: 1.5, py: 1.25, cursor: 'pointer',
                bgcolor: assistantSelected ? 'rgba(102,252,241,0.08)' : 'transparent',
                borderLeft: assistantSelected ? '3px solid #66FCF1' : '3px solid transparent',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' },
                transition: 'background 0.15s'
              }}
            >
              <Avatar sx={{ width: 36, height: 36, bgcolor: '#66FCF1', color: '#0B0C10' }}>
                <SupportAgentIcon fontSize="small" />
              </Avatar>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" fontWeight={500} sx={{ color: '#C5C6C7', lineHeight: 1.2, fontSize: 13 }}>
                  Asistente iNOISE
                </Typography>
                <Typography variant="caption" sx={{ color: '#666', fontSize: 11 }}>
                  Ayuda y preguntas frecuentes
                </Typography>
              </Box>
            </Box>
            <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />

            {users.length === 0 && (
              <Box sx={{ px: 2, py: 3, textAlign: 'center' }}>
                <Typography variant="caption" sx={{ color: '#555' }}>
                  No hay otros colaboradores
                </Typography>
              </Box>
            )}
            {users.map(u => {
              const name = `${u.nombre} ${u.apellido}`
              const unread = unreadByUser[u.id] || 0
              const color = AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]
              const isSelected = !assistantSelected && openWith === u.id

              return (
                <Box
                  key={u.id}
                  onClick={() => selectUser(u.id)}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 1.5,
                    px: 1.5, py: 1.25, cursor: 'pointer',
                    bgcolor: isSelected ? 'rgba(102,252,241,0.08)' : 'transparent',
                    borderLeft: isSelected ? '3px solid #66FCF1' : '3px solid transparent',
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' },
                    transition: 'background 0.15s'
                  }}
                >
                  <Badge badgeContent={unread} color="error" max={9}>
                    <UserAvatar name={name} color={color} size={36} />
                  </Badge>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" fontWeight={unread > 0 ? 700 : 500}
                      sx={{ color: unread > 0 ? '#fff' : '#C5C6C7', lineHeight: 1.2, fontSize: 13 }}>
                      {name}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#666', fontSize: 11 }}>
                      {u.cargo || u.role}
                    </Typography>
                  </Box>
                </Box>
              )
            })}
          </Box>
        </Box>

        {/* ── Panel de conversación (derecha) ── */}
        {assistantSelected && (
          <AssistantConversationPanel onClose={() => setAssistantSelected(false)} />
        )}

        {!assistantSelected && selectedUser && (
          <ConversationPanel
            user={selectedUser}
            onClose={closeChat}
          />
        )}

        {/* Placeholder cuando no hay usuario seleccionado */}
        {!assistantSelected && !selectedUser && openWith && (
          <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography variant="caption" sx={{ color: '#555' }}>
              Selecciona un colaborador
            </Typography>
          </Box>
        )}
      </Box>
    </>
  )
}
