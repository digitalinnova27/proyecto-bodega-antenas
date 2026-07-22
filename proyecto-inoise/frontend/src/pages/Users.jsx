import React from 'react'
import {
  Box, Typography, Paper, Avatar, Chip, Divider,
  List, ListItem, ListItemButton, ListItemAvatar, ListItemText,
  TextField, InputAdornment, Tooltip,
  Popover, IconButton,
  CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  Snackbar, Alert
} from '@mui/material'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import InventoryIcon from '@mui/icons-material/Inventory'
import SearchIcon from '@mui/icons-material/Search'
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings'
import PersonIcon from '@mui/icons-material/Person'
import BlockIcon from '@mui/icons-material/Block'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord'
import LockResetIcon from '@mui/icons-material/LockReset'
import { useAuth } from '../context/AuthContext'
import { useInventory } from '../context/InventoryContext'
import { api } from '../lib/api'
import { AVATARS } from './Login'

/* ─── Diálogo: restablecer contraseña de un usuario (solo admin) ─────────
 * Usa updateUser(id, {}, newPassword) — ya soportado por el backend
 * (electron/db.js) pero sin ningún botón en la UI hasta ahora. Al no
 * existir forma de recuperar la contraseña original (se guarda hasheada
 * con pbkdf2), esta es la única vía para que un usuario recupere el
 * acceso si la olvidó. */
function ResetPasswordDialog({ open, user, onClose, onSuccess }) {
  const { updateUser } = useAuth()
  const [pass1, setPass1] = React.useState('')
  const [pass2, setPass2] = React.useState('')
  const [error, setError] = React.useState('')
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    if (open) { setPass1(''); setPass2(''); setError('') }
  }, [open])

  const handleSubmit = async () => {
    if (pass1.length < 4) { setError('Mínimo 4 caracteres'); return }
    if (pass1 !== pass2) { setError('Las contraseñas no coinciden'); return }
    setLoading(true)
    setError('')
    try {
      // IMPORTANTE: updateUser reemplaza nombre/apellido/username/etc. con lo
      // que reciba en "fields" — hay que reenviar los datos actuales del
      // usuario tal cual, para no borrarlos al solo querer cambiar la clave.
      const currentFields = {
        nombre: user.nombre, apellido: user.apellido, email: user.email,
        cargo: user.cargo, avatar: user.avatar, username: user.username
      }
      const res = await updateUser(user.id, currentFields, pass1)
      if (!res?.ok) { setError(res?.error || 'No se pudo actualizar'); setLoading(false); return }
      setLoading(false)
      onSuccess()
    } catch (e) {
      setError('Error al actualizar')
      setLoading(false)
    }
  }

  if (!user) return null

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Restablecer contraseña</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Nueva contraseña para <strong>{fullName(user)}</strong> (@{user.username}). El usuario deberá usar esta nueva contraseña para iniciar sesión.
        </Typography>
        <TextField
          autoFocus fullWidth type="password" size="small"
          label="Nueva contraseña" value={pass1}
          onChange={e => { setPass1(e.target.value); setError('') }}
          sx={{ mb: 2 }}
        />
        <TextField
          fullWidth type="password" size="small"
          label="Confirmar contraseña" value={pass2}
          onChange={e => { setPass2(e.target.value); setError('') }}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
        />
        {error && <Typography variant="caption" color="error" sx={{ display: 'block', mt: 1 }}>{error}</Typography>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>Cancelar</Button>
        <Button onClick={handleSubmit} variant="contained" disabled={loading}>
          {loading ? 'Guardando…' : 'Guardar'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

/* ─── Color de sección — reutilizable ───────────────────────────────────── */
const SECTION_BORDER = '1px solid rgba(255,255,255,0.07)'

/* ─── Helpers ────────────────────────────────────────────────────────────── */
function UserAvatar({ avatarId, size = 40 }) {
  const av = AVATARS.find(a => a.id === avatarId) || AVATARS[0]
  return (
    <Avatar sx={{ width: size, height: size, bgcolor: av.color, fontSize: size * 0.45 }}>
      {av.emoji}
    </Avatar>
  )
}

function fullName(u) { return `${u.nombre} ${u.apellido}`.trim() }

function matchUser(u, field) {
  if (!field || field === 'Sistema') return false
  const name = fullName(u)
  if (typeof field === 'string') return field === name || field === u.username
  if (typeof field === 'object' && field !== null)
    return (`${field.nombre || ''} ${field.apellido || ''}`).trim() === name || field.id === u.id
  return false
}

function fmtDate(ts) {
  if (!ts) return '—'
  try { return new Date(ts).toLocaleString('es-CL', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) }
  catch { return ts }
}

function fmtDateShort(ts) {
  if (!ts) return '—'
  try { return new Date(ts).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }) }
  catch { return ts }
}

function relativeTime(ts) {
  if (!ts) return null
  const diff = Date.now() - new Date(ts).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins < 1)   return 'hace un momento'
  if (mins < 60)  return `hace ${mins} min`
  if (hours < 24) return `hace ${hours} h`
  if (days === 1) return 'ayer'
  return `hace ${days} días`
}

function sessionDuration(loginAt, logoutAt) {
  if (!loginAt || !logoutAt) return null
  const ms = new Date(logoutAt) - new Date(loginAt)
  if (ms < 0) return null
  const mins  = Math.floor(ms / 60000)
  const hours = Math.floor(ms / 3600000)
  if (mins < 1)   return '< 1 min'
  if (mins < 60)  return `${mins} min`
  return `${hours} h ${mins % 60} min`
}

/* ─── Encabezado de sección interna ─────────────────────────────────────── */
function SectionLabel({ children }) {
  return (
    <Typography variant="caption" sx={{
      display: 'block', fontWeight: 700, letterSpacing: 1, fontSize: 10,
      textTransform: 'uppercase', color: 'text.disabled', mb: 1.5
    }}>
      {children}
    </Typography>
  )
}

/* ─── Tarjeta stat (sin elevation para quedar dentro del Paper padre) ────── */
function StatCard({ icon, label, value, color = 'primary.main' }) {
  return (
    <Box sx={{
      flex: 1, textAlign: 'center', py: 1.5, px: 1,
      border: SECTION_BORDER, borderRadius: 1,
      bgcolor: 'rgba(255,255,255,0.02)'
    }}>
      <Box sx={{ color, mb: 0.5 }}>{icon}</Box>
      <Typography variant="h5" fontWeight={700} lineHeight={1}>{value}</Typography>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
    </Box>
  )
}

/* ─── Ítem de actividad ──────────────────────────────────────────────────── */
const CATEGORY_META = {
  evento:   { icon: <CalendarMonthIcon fontSize="small" />, color: '#66FCF1' },
  arriendo: { icon: <LocalShippingIcon fontSize="small" />, color: '#FFA94D' },
  producto: { icon: <InventoryIcon     fontSize="small" />, color: '#74C0FC' },
}

function ActivityItem({ icon, color, action, detail, timestamp }) {
  return (
    <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start', py: 1 }}>
      <Box sx={{
        mt: 0.25, width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
        bgcolor: `${color}18`, color, display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        {icon}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" fontWeight={500} noWrap>{action}</Typography>
        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>{detail}</Typography>
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
        {fmtDate(timestamp)}
      </Typography>
    </Box>
  )
}

/* ─── Acordeón de sesiones agrupadas por día ─────────────────────────────── */
function dayLabel(dateStr) {
  const d    = new Date(dateStr)
  const now  = new Date()
  const tod  = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yest = new Date(tod); yest.setDate(tod.getDate() - 1)
  const day  = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const fmt  = (dt) => dt.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })
  if (+day === +tod)  return `Hoy — ${fmt(d)}`
  if (+day === +yest) return `Ayer — ${fmt(d)}`
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
}

function dayKey(dateStr) {
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

function isToday(dateStr)     { const n = new Date(); return dayKey(dateStr) === `${n.getFullYear()}-${n.getMonth()}-${n.getDate()}` }
function isYesterday(dateStr) { const y = new Date(); y.setDate(y.getDate() - 1); return dayKey(dateStr) === `${y.getFullYear()}-${y.getMonth()}-${y.getDate()}` }

/* Fila de una sesión individual */
function SessionRow({ s }) {
  const isActive   = !s.logoutAt
  const dur        = sessionDuration(s.loginAt, s.logoutAt)
  const loginTime  = s.loginAt  ? new Date(s.loginAt).toLocaleTimeString('es-CL',  { hour: '2-digit', minute: '2-digit' }) : '—'
  const logoutTime = s.logoutAt ? new Date(s.logoutAt).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) : null
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 0.75, borderTop: '0.5px solid rgba(255,255,255,0.04)' }}>
      <Box sx={{ color: isActive ? '#4caf50' : '#66FCF1', fontSize: 11, flexShrink: 0, lineHeight: 1 }}>
        {isActive ? '●' : '↑'}
      </Box>
      <Typography variant="caption" sx={{ flex: 1 }}>
        {loginTime}
        {logoutTime ? ` — ${logoutTime}` : <span style={{ color: '#4caf50', fontWeight: 600 }}> — activa</span>}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0, minWidth: 48, textAlign: 'right' }}>
        {isActive ? '—' : (dur || '—')}
      </Typography>
      {isActive ? (
        <Chip icon={<FiberManualRecordIcon sx={{ fontSize: '10px !important' }} />}
          label="Online" size="small" color="success" variant="outlined"
          sx={{ height: 18, fontSize: 10, flexShrink: 0 }} />
      ) : (
        <Typography variant="caption" color="text.disabled" sx={{ flexShrink: 0, minWidth: 44, textAlign: 'right' }}>
          Cerrada
        </Typography>
      )}
    </Box>
  )
}

/* Grupo colapsable de un día */
function AccordionGroup({ group, isOpen, onToggle, accent = false }) {
  return (
    <Box sx={{ border: `0.5px solid ${accent ? 'rgba(102,252,241,0.3)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 1, overflow: 'hidden' }}>
      <Box
        onClick={onToggle}
        sx={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          px: 1.5, py: 0.875, cursor: 'pointer', userSelect: 'none',
          bgcolor: accent ? 'rgba(102,252,241,0.04)' : 'rgba(255,255,255,0.025)',
          '&:hover': { bgcolor: accent ? 'rgba(102,252,241,0.07)' : 'rgba(255,255,255,0.045)' }
        }}
      >
        <Typography variant="caption" fontWeight={600}>{group.label}</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="caption" sx={{ fontSize: 10, color: 'text.disabled', bgcolor: 'rgba(255,255,255,0.06)', px: 0.75, py: 0.25, borderRadius: 0.5 }}>
            {group.items.length} sesión{group.items.length !== 1 ? 'es' : ''}
          </Typography>
          <Typography variant="caption" sx={{ fontSize: 10, color: 'text.disabled', display: 'inline-block', transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
            ▼
          </Typography>
        </Box>
      </Box>
      {isOpen && group.items.map(s => <SessionRow key={s.id} s={s} />)}
    </Box>
  )
}

const CAL_MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function SessionAccordion({ sessions, loadingSessions }) {
  /* ── Grupos memoizados (más reciente primero) ───────────────────────────── */
  const allGroups = React.useMemo(() => {
    const groups = []
    const keyMap = {}
    ;[...sessions]
      .sort((a, b) => new Date(b.loginAt || 0) - new Date(a.loginAt || 0))
      .forEach(s => {
        const k = s.loginAt ? dayKey(s.loginAt) : 'sin-fecha'
        if (keyMap[k] === undefined) {
          keyMap[k] = groups.length
          groups.push({ key: k, label: s.loginAt ? dayLabel(s.loginAt) : 'Sin fecha', items: [], dateStr: s.loginAt })
        }
        groups[keyMap[k]].items.push(s)
      })
    return groups
  }, [sessions])

  const displayGroups = allGroups.slice(0, 3)

  /* Días con sesiones para dots del calendario */
  const sessionDayKeys = React.useMemo(() => new Set(allGroups.map(g => g.key)), [allGroups])

  /* ── Estado (todos los hooks antes de cualquier early return) ───────────── */
  const [open, setOpen]             = React.useState(new Set())
  const [calAnchor, setCalAnchor]   = React.useState(null)
  const [navYear, setNavYear]       = React.useState(() => new Date().getFullYear())
  const [navMonth, setNavMonth]     = React.useState(() => new Date().getMonth())
  const [extraGroup, setExtraGroup] = React.useState(null)

  /* Abrir hoy/ayer por defecto una vez que lleguen los datos */
  const openInitialized = React.useRef(false)
  React.useEffect(() => {
    if (!allGroups.length || openInitialized.current) return
    openInitialized.current = true
    const defaults = new Set()
    displayGroups.forEach(g => {
      if (g.dateStr && (isToday(g.dateStr) || isYesterday(g.dateStr))) defaults.add(g.key)
    })
    if (defaults.size === 0 && displayGroups.length > 0) defaults.add(displayGroups[0].key)
    setOpen(defaults)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allGroups.length])

  const toggle = (k) => setOpen(prev => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n })

  /* ── Rejilla del calendario ─────────────────────────────────────────────── */
  const calCells = React.useMemo(() => {
    const first       = new Date(navYear, navMonth, 1).getDay()
    const daysInMonth = new Date(navYear, navMonth + 1, 0).getDate()
    const cells       = Array(first).fill(null)
    for (let d = 1; d <= daysInMonth; d++) cells.push(d)
    while (cells.length % 7 !== 0) cells.push(null)
    return cells
  }, [navYear, navMonth])

  const hasSessions = (day) => Boolean(day) && sessionDayKeys.has(`${navYear}-${navMonth}-${day}`)

  const now       = new Date()
  const canGoNext = !(navYear === now.getFullYear() && navMonth === now.getMonth())

  const prevMonth = () => {
    if (navMonth === 0) { setNavYear(y => y - 1); setNavMonth(11) } else setNavMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (!canGoNext) return
    if (navMonth === 11) { setNavYear(y => y + 1); setNavMonth(0) } else setNavMonth(m => m + 1)
  }

  const handleDayClick = (day) => {
    if (!hasSessions(day)) return
    const k     = `${navYear}-${navMonth}-${day}`
    const group = allGroups.find(g => g.key === k)
    if (!group) return
    setExtraGroup(prev => prev?.key === k ? null : group)
    setCalAnchor(null)
  }

  /* ── Early returns (después de todos los hooks) ─────────────────────────── */
  if (loadingSessions) return <Box sx={{ py: 3, textAlign: 'center' }}><CircularProgress size={24} /></Box>
  if (!sessions.length) return (
    <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
      Sin sesiones registradas
    </Typography>
  )

  /* ── Render ─────────────────────────────────────────────────────────────── */
  return (
    <Box>
      {/* 3 días más recientes */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        {displayGroups.map(group => (
          <AccordionGroup
            key={group.key}
            group={group}
            isOpen={open.has(group.key)}
            onToggle={() => toggle(group.key)}
          />
        ))}
      </Box>

      {/* Botón "Ver historial completo" */}
      <Box sx={{ mt: 1.5, display: 'flex', justifyContent: 'flex-end' }}>
        <Box
          onClick={(e) => setCalAnchor(e.currentTarget)}
          sx={{
            display: 'inline-flex', alignItems: 'center', gap: 0.75,
            px: 1.25, py: 0.5, cursor: 'pointer', borderRadius: 1,
            border: '0.5px solid rgba(102,252,241,0.2)',
            bgcolor: 'rgba(102,252,241,0.04)',
            '&:hover': { bgcolor: 'rgba(102,252,241,0.09)' }
          }}
        >
          <CalendarMonthIcon sx={{ fontSize: 13, color: '#66FCF1' }} />
          <Typography variant="caption" sx={{ color: '#66FCF1', fontWeight: 500, fontSize: 11 }}>
            Ver historial completo
          </Typography>
        </Box>
      </Box>

      {/* Día seleccionado del calendario */}
      {extraGroup && (
        <Box sx={{ mt: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.75 }}>
            <Typography variant="caption" sx={{ fontSize: 10, color: 'text.disabled', fontStyle: 'italic' }}>
              Día seleccionado del historial
            </Typography>
            <Box
              onClick={() => setExtraGroup(null)}
              sx={{ ml: 'auto', cursor: 'pointer', color: 'text.disabled', fontSize: 13, lineHeight: 1, userSelect: 'none', '&:hover': { color: 'text.secondary' } }}
            >
              ✕
            </Box>
          </Box>
          <AccordionGroup group={extraGroup} isOpen={true} onToggle={() => {}} accent />
        </Box>
      )}

      {/* Popover del calendario */}
      <Popover
        open={Boolean(calAnchor)}
        anchorEl={calAnchor}
        onClose={() => setCalAnchor(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        slotProps={{ paper: { sx: { bgcolor: '#1F2833', border: '0.5px solid rgba(102,252,241,0.18)', p: 1.5, minWidth: 224 } } }}
      >
        {/* Navegación de mes */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.25 }}>
          <IconButton size="small" onClick={prevMonth} sx={{ p: 0.5, color: 'text.secondary' }}>
            <ChevronLeftIcon sx={{ fontSize: 16 }} />
          </IconButton>
          <Typography variant="caption" fontWeight={600} sx={{ fontSize: 12 }}>
            {CAL_MONTHS[navMonth]} {navYear}
          </Typography>
          <IconButton size="small" onClick={nextMonth} disabled={!canGoNext} sx={{ p: 0.5 }}>
            <ChevronRightIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Box>

        {/* Encabezado días de semana */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', mb: 0.5 }}>
          {['D','L','M','M','J','V','S'].map((d, i) => (
            <Typography key={i} variant="caption" sx={{ textAlign: 'center', fontSize: 9, color: 'text.disabled', fontWeight: 700, py: 0.25 }}>
              {d}
            </Typography>
          ))}
        </Box>

        {/* Celdas de días */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.25 }}>
          {calCells.map((day, i) => {
            const hasS       = hasSessions(day)
            const k          = day ? `${navYear}-${navMonth}-${day}` : null
            const isSelected = Boolean(k && extraGroup?.key === k)
            return (
              <Box
                key={i}
                onClick={() => day && handleDayClick(day)}
                sx={{
                  height: 30, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', borderRadius: 0.5,
                  cursor: hasS ? 'pointer' : 'default',
                  bgcolor: isSelected ? 'rgba(102,252,241,0.15)' : 'transparent',
                  border: isSelected ? '0.5px solid rgba(102,252,241,0.4)' : '0.5px solid transparent',
                  '&:hover': hasS ? { bgcolor: isSelected ? 'rgba(102,252,241,0.2)' : 'rgba(102,252,241,0.07)' } : {}
                }}
              >
                {day && (
                  <>
                    <Typography variant="caption" sx={{ fontSize: 11, lineHeight: 1, color: hasS ? '#e0e0e0' : 'rgba(255,255,255,0.2)' }}>
                      {day}
                    </Typography>
                    {hasS && <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: '#66FCF1', mt: 0.25 }} />}
                  </>
                )}
              </Box>
            )
          })}
        </Box>

        <Typography variant="caption" sx={{ display: 'block', mt: 1, fontSize: 9, color: 'text.disabled', textAlign: 'center' }}>
          • días con sesiones registradas
        </Typography>
      </Popover>
    </Box>
  )
}

/* ─── Panel de perfil — UN SOLO Paper con secciones internas ──────────────
 * Todas las secciones viven dentro del mismo Paper (background.paper #1F2833)
 * separadas por bordes sutiles. Así no queda ningún hueco negro entre ellas. */
function UserProfile({ user, isOnline, eventHistory, rentalHistory, purchaseHistory, auditLog, viewerIsAdmin }) {
  const name     = fullName(user)
  const isActive = user.active !== false

  const [resetOpen, setResetOpen] = React.useState(false)
  const [resetOk, setResetOk]     = React.useState(false)

  /* Actividad atribuida a este usuario */
  const myEvents   = eventHistory.filter(e => e.closedBy === name || e.closedBy === user.username)
  const myRentals  = rentalHistory.filter(r => r.closedBy === name || r.closedBy === user.username)
  const myProducts = purchaseHistory.filter(p => matchUser(user, p.user))
  const myAudit    = auditLog.filter(a => a.user === name || a.user === user.username)

  const timeline = [
    ...myEvents.map(e => ({ ts: e.closedAt, category: 'evento', action: 'Evento cerrado', detail: `${e.orderNumber || '—'} · ${e.name}` })),
    ...myRentals.map(r => ({ ts: r.closedAt, category: 'arriendo', action: 'Arriendo cerrado', detail: `${r.orderNumber || '—'} · ${r.name}${r.clientName ? ' · ' + r.clientName : ''}` })),
    ...myProducts.map(p => ({ ts: p.date, category: 'producto', action: 'Producto ingresado', detail: `${p.productName} (${p.sku}) · ${p.qty} unid.` })),
    ...myAudit.filter(a => !['producto', 'evento', 'arriendo'].includes(a.category))
              .map(a => ({ ts: a.timestamp, category: a.category || 'sistema', action: a.action, detail: a.detail }))
  ].sort((a, b) => new Date(b.ts) - new Date(a.ts))

  const lastActivity = timeline[0]?.ts || null

  /* Sesiones */
  const [sessions, setSessions]       = React.useState([])
  const [loadingSessions, setLoading] = React.useState(true)

  React.useEffect(() => {
    setLoading(true)
    setSessions([])
    api.get(`/api/sessions/user/${user.id}?limit=500`)
      .then(res => { if (res.ok && Array.isArray(res.data)) setSessions(res.data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [user.id])

  return (
    <Paper sx={{ overflow: 'hidden' }}>

      {/* ── CABECERA ── */}
      <Box sx={{ p: 2.5, borderBottom: SECTION_BORDER }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>

          {/* Avatar con punto online */}
          <Box sx={{ position: 'relative', flexShrink: 0 }}>
            <UserAvatar avatarId={user.avatar} size={64} />
            {isOnline && (
              <Tooltip title="Conectado ahora">
                <Box sx={{
                  position: 'absolute', bottom: 2, right: 2,
                  width: 14, height: 14, borderRadius: '50%', bgcolor: '#4caf50',
                  border: '2px solid', borderColor: 'background.paper',
                  boxShadow: '0 0 0 2px #4caf5055'
                }} />
              </Tooltip>
            )}
          </Box>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.25 }}>
              <Typography variant="h6" fontWeight={700}>{name}</Typography>
              <Chip
                icon={user.role === 'admin' ? <AdminPanelSettingsIcon sx={{ fontSize: 13 }} /> : <PersonIcon sx={{ fontSize: 13 }} />}
                label={user.role === 'admin' ? 'Administrador' : 'Operador'}
                size="small"
                color={user.role === 'admin' ? 'warning' : 'default'}
                variant={user.role === 'admin' ? 'filled' : 'outlined'}
              />
              {!isActive && (
                <Chip icon={<BlockIcon sx={{ fontSize: 12 }} />} label="Deshabilitado"
                  size="small" color="error" variant="outlined" />
              )}
              {viewerIsAdmin && (
                <Tooltip title="Restablecer contraseña">
                  <Button
                    size="small"
                    startIcon={<LockResetIcon sx={{ fontSize: 16 }} />}
                    onClick={() => setResetOpen(true)}
                    sx={{ ml: 'auto', fontSize: 12, textTransform: 'none' }}
                  >
                    Restablecer contraseña
                  </Button>
                </Tooltip>
              )}
            </Box>

            <Typography variant="body2" color="text.secondary">
              @{user.username}
              {user.cargo ? ` · ${user.cargo}` : ''}
              {user.email ? ` · ${user.email}` : ''}
            </Typography>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.75 }}>
              <AccessTimeIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
              {isOnline ? (
                <Typography variant="caption" color="success.main" fontWeight={600}>Conectado ahora</Typography>
              ) : lastActivity ? (
                <Typography variant="caption" color="text.secondary">Última actividad {relativeTime(lastActivity)}</Typography>
              ) : user.createdAt ? (
                <Typography variant="caption" color="text.secondary">En el sistema desde {fmtDateShort(user.createdAt)}</Typography>
              ) : (
                <Typography variant="caption" color="text.disabled">Sin actividad registrada</Typography>
              )}
            </Box>
          </Box>
        </Box>
      </Box>

      {/* ── STATS ── */}
      <Box sx={{ p: 2, borderBottom: SECTION_BORDER, display: 'flex', gap: 1.5 }}>
        <StatCard icon={<CalendarMonthIcon />} label="Eventos cerrados"   value={myEvents.length}   color="#66FCF1" />
        <StatCard icon={<LocalShippingIcon />} label="Arriendos cerrados" value={myRentals.length}  color="#FFA94D" />
        <StatCard icon={<InventoryIcon />}     label="Prod. ingresados"   value={myProducts.length} color="#74C0FC" />
        <StatCard icon={<PersonIcon />}        label="Acciones totales"   value={timeline.length}   color="#b8a0f0" />
      </Box>

      {/* ── ACTIVIDAD RECIENTE ── */}
      <Box sx={{ p: 2.5, borderBottom: SECTION_BORDER }}>
        <SectionLabel>Actividad reciente</SectionLabel>
        {timeline.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
            Sin actividad registrada para este usuario
          </Typography>
        ) : (
          timeline.slice(0, 15).map((item, i) => {
            const meta = CATEGORY_META[item.category] || CATEGORY_META['evento']
            return (
              <React.Fragment key={i}>
                {i > 0 && <Divider sx={{ borderColor: 'rgba(255,255,255,0.05)' }} />}
                <ActivityItem icon={meta.icon} color={meta.color}
                  action={item.action} detail={item.detail} timestamp={item.ts} />
              </React.Fragment>
            )
          })
        )}
      </Box>

      {/* ── HISTORIAL DE SESIONES ── */}
      <Box sx={{ p: 2.5 }}>
        <SectionLabel>Historial de sesiones</SectionLabel>
        <SessionAccordion sessions={sessions} loadingSessions={loadingSessions} />
      </Box>

      <ResetPasswordDialog
        open={resetOpen}
        user={user}
        onClose={() => setResetOpen(false)}
        onSuccess={() => { setResetOpen(false); setResetOk(true) }}
      />
      <Snackbar open={resetOk} autoHideDuration={4000} onClose={() => setResetOk(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="success" onClose={() => setResetOk(false)} sx={{ width: '100%' }}>
          Contraseña actualizada. Avísale al usuario que ya puede iniciar sesión con la nueva.
        </Alert>
      </Snackbar>

    </Paper>
  )
}

/* ─── Página principal ───────────────────────────────────────────────────── */
export default function Users() {
  const { currentUser, users, role, onlineUserIds } = useAuth()
  const { eventHistory, rentalHistory, purchaseHistory, auditLog } = useInventory()

  const [search, setSearch]     = React.useState('')
  const [selectedId, setSelectedId] = React.useState(null)

  const visibleUsers = role === 'admin' ? users : users.filter(u => u.id === currentUser?.id)

  const filtered = visibleUsers.filter(u => {
    const q = search.toLowerCase()
    return fullName(u).toLowerCase().includes(q) ||
           u.username.toLowerCase().includes(q) ||
           (u.cargo || '').toLowerCase().includes(q)
  })

  React.useEffect(() => {
    if (!selectedId && filtered.length > 0) setSelectedId(filtered[0].id)
  }, [filtered, selectedId])

  React.useEffect(() => {
    if (selectedId && !filtered.find(u => u.id === selectedId))
      setSelectedId(filtered[0]?.id || null)
  }, [filtered, selectedId])

  const selectedUser = users.find(u => u.id === selectedId)
  const onlineCount  = onlineUserIds.length

  return (
    <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>

      {/* ── Panel izquierdo — sticky ── */}
      <Paper sx={{
        width: 240, flexShrink: 0,
        position: 'sticky', top: 0,
        maxHeight: 'calc(100vh - 96px)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden'
      }}>

        {/* Cabecera del panel */}
        <Box sx={{ p: 1.5, borderBottom: SECTION_BORDER }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: role === 'admin' ? 1 : 0 }}>
            <Typography variant="subtitle2" fontWeight={600}>
              {role === 'admin' ? `${users.length} usuario${users.length !== 1 ? 's' : ''}` : 'Mi perfil'}
            </Typography>
            {onlineCount > 0 && (
              <Chip
                icon={<FiberManualRecordIcon sx={{ fontSize: '10px !important', color: '#4caf50 !important' }} />}
                label={`${onlineCount} online`} size="small"
                sx={{ height: 20, fontSize: 11, bgcolor: '#4caf5015', color: '#4caf50', border: '1px solid #4caf5040' }}
              />
            )}
          </Box>
          {role === 'admin' && (
            <TextField
              size="small" fullWidth placeholder="Buscar..."
              value={search} onChange={e => setSearch(e.target.value)}
              InputProps={{ startAdornment: (<InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>) }}
            />
          )}
        </Box>

        {/* Lista de usuarios */}
        <List dense sx={{ flex: 1, overflowY: 'auto', p: 0 }}>
          {filtered.map(u => {
            const av        = AVATARS.find(a => a.id === u.avatar) || AVATARS[0]
            const isActive  = u.active !== false
            const isOnline  = onlineUserIds.includes(u.id)
            const isSelected = u.id === selectedId
            return (
              <ListItem key={u.id} disablePadding>
                <ListItemButton
                  selected={isSelected}
                  onClick={() => setSelectedId(u.id)}
                  sx={{
                    opacity: isActive ? 1 : 0.5,
                    borderLeft: isSelected ? '3px solid' : '3px solid transparent',
                    borderColor: isSelected ? 'primary.main' : 'transparent',
                    '&.Mui-selected': { bgcolor: 'rgba(102,252,241,0.06)' },
                    '&.Mui-selected:hover': { bgcolor: 'rgba(102,252,241,0.10)' }
                  }}
                >
                  <ListItemAvatar sx={{ minWidth: 44 }}>
                    <Box sx={{ position: 'relative', display: 'inline-block' }}>
                      <Avatar sx={{ width: 32, height: 32, bgcolor: av.color, fontSize: 15 }}>
                        {av.emoji}
                      </Avatar>
                      {isOnline && (
                        <Box sx={{
                          position: 'absolute', bottom: 0, right: 0,
                          width: 9, height: 9, borderRadius: '50%', bgcolor: '#4caf50',
                          border: '1.5px solid', borderColor: 'background.paper'
                        }} />
                      )}
                    </Box>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Typography variant="body2" noWrap fontWeight={isSelected ? 600 : 400}>
                        {fullName(u)}
                      </Typography>
                    }
                    secondary={
                      <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Typography variant="caption" color={isOnline ? 'success.main' : 'text.secondary'} noWrap>
                          {isOnline ? 'Online' : (u.role === 'admin' ? 'Admin' : 'Operador')}
                        </Typography>
                        {!isActive && (
                          <Tooltip title="Deshabilitado">
                            <BlockIcon sx={{ fontSize: 10, color: 'error.main' }} />
                          </Tooltip>
                        )}
                      </Box>
                    }
                  />
                </ListItemButton>
              </ListItem>
            )
          })}
          {filtered.length === 0 && (
            <ListItem>
              <ListItemText primary={<Typography variant="caption" color="text.secondary">Sin resultados</Typography>} />
            </ListItem>
          )}
        </List>
      </Paper>

      {/* ── Panel derecho — UN solo Paper por perfil, sin huecos ── */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {selectedUser ? (
          <UserProfile
            key={selectedUser.id}
            user={selectedUser}
            isOnline={onlineUserIds.includes(selectedUser.id)}
            eventHistory={eventHistory}
            rentalHistory={rentalHistory}
            purchaseHistory={purchaseHistory}
            auditLog={auditLog}
            viewerIsAdmin={role === 'admin'}
          />
        ) : (
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <Typography color="text.secondary">Seleccioná un usuario para ver su perfil</Typography>
          </Paper>
        )}
      </Box>

    </Box>
  )
}
