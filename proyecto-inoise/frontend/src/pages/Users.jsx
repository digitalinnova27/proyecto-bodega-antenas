import React from 'react'
import {
  Box, Typography, Paper, Avatar, Chip, Divider,
  List, ListItem, ListItemButton, ListItemAvatar, ListItemText,
  Card, CardContent, TextField, InputAdornment, Tooltip,
  Table, TableHead, TableRow, TableCell, TableBody,
  CircularProgress
} from '@mui/material'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import InventoryIcon from '@mui/icons-material/Inventory'
import SearchIcon from '@mui/icons-material/Search'
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings'
import PersonIcon from '@mui/icons-material/Person'
import BlockIcon from '@mui/icons-material/Block'
import LoginIcon from '@mui/icons-material/Login'
import LogoutIcon from '@mui/icons-material/Logout'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord'
import { useAuth } from '../context/AuthContext'
import { useInventory } from '../context/InventoryContext'
import { api } from '../lib/api'
import { AVATARS } from './Login'

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

/* ─── Panel de perfil — UN SOLO Paper con secciones internas ──────────────
 * Todas las secciones viven dentro del mismo Paper (background.paper #1F2833)
 * separadas por bordes sutiles. Así no queda ningún hueco negro entre ellas. */
function UserProfile({ user, isOnline, eventHistory, rentalHistory, purchaseHistory, auditLog }) {
  const name     = fullName(user)
  const isActive = user.active !== false

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
    api.get(`/api/sessions/user/${user.id}?limit=20`)
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
        {loadingSessions ? (
          <Box sx={{ py: 3, textAlign: 'center' }}><CircularProgress size={24} /></Box>
        ) : sessions.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
            Sin sesiones registradas
          </Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600, fontSize: 12, borderColor: 'rgba(255,255,255,0.08)' }}>Inicio</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: 12, borderColor: 'rgba(255,255,255,0.08)' }}>Cierre</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: 12, borderColor: 'rgba(255,255,255,0.08)' }}>Duración</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: 12, borderColor: 'rgba(255,255,255,0.08)' }}>IP</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: 12, borderColor: 'rgba(255,255,255,0.08)' }}>Estado</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sessions.map((s) => {
                const isSessionActive = !s.logoutAt
                const dur = sessionDuration(s.loginAt, s.logoutAt)
                return (
                  <TableRow key={s.id} hover sx={{ '& td': { borderColor: 'rgba(255,255,255,0.05)' } }}>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <LoginIcon sx={{ fontSize: 13, color: '#66FCF1' }} />
                        <Typography variant="caption">{fmtDate(s.loginAt)}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      {isSessionActive ? (
                        <Typography variant="caption" color="success.main" fontWeight={600}>Sesión activa</Typography>
                      ) : (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <LogoutIcon sx={{ fontSize: 13, color: 'text.disabled' }} />
                          <Typography variant="caption">{fmtDate(s.logoutAt)}</Typography>
                        </Box>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">{isSessionActive ? '—' : (dur || '—')}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary" fontFamily="monospace">{s.ip || '—'}</Typography>
                    </TableCell>
                    <TableCell>
                      {isSessionActive ? (
                        <Chip
                          icon={<FiberManualRecordIcon sx={{ fontSize: '10px !important' }} />}
                          label="Online" size="small" color="success" variant="outlined"
                          sx={{ height: 20, fontSize: 11 }}
                        />
                      ) : (
                        <Typography variant="caption" color="text.disabled">Cerrada</Typography>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </Box>

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
