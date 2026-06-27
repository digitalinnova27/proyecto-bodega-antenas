import React from 'react'
import {
  Box, Typography, Paper, Chip, Button, Divider,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Alert, Snackbar, LinearProgress, Fade,
  List, ListItem, ListItemText, ListItemIcon,
  Tooltip, IconButton, Badge
} from '@mui/material'
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import InventoryIcon from '@mui/icons-material/Inventory'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked'
import WifiIcon from '@mui/icons-material/Wifi'
import EditNoteIcon from '@mui/icons-material/EditNote'
import LockIcon from '@mui/icons-material/Lock'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import CloseIcon from '@mui/icons-material/Close'
import ConfirmationNumberIcon from '@mui/icons-material/ConfirmationNumber'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import StopIcon from '@mui/icons-material/Stop'
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner'
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings'
import EventIcon from '@mui/icons-material/Event'
import PlaceIcon from '@mui/icons-material/Place'

import HandshakeIcon from '@mui/icons-material/Handshake'
import { useInventory } from '../context/InventoryContext'
import { useRfidSocket } from '../hooks/useRfidSocket'
import { useAuth } from '../context/AuthContext'

/* ─── Constantes de fases ──────────────────────────────────────────────────── */
const PHASES = [
  { key: 'f1', label: 'Despacho bodega', short: 'F1', icon: <LocalShippingIcon sx={{ fontSize: 14 }} />, color: '#639922', bgColor: '#EAF3DE', textColor: '#27500A' },
  { key: 'f2', label: 'Recepción evento', short: 'F2', icon: <InventoryIcon sx={{ fontSize: 14 }} />, color: '#378ADD', bgColor: '#E6F1FB', textColor: '#0C447C' },
  { key: 'f3', label: 'Despacho evento', short: 'F3', icon: <LocalShippingIcon sx={{ fontSize: 14 }} />, color: '#BA7517', bgColor: '#FAEEDA', textColor: '#633806' },
  { key: 'f4', label: 'Recepción bodega', short: 'F4', icon: <InventoryIcon sx={{ fontSize: 14 }} />, color: '#534AB7', bgColor: '#EEEDFE', textColor: '#3C3489' },
]

/* ─── Helpers ──────────────────────────────────────────────────────────────── */
const todayStr = () => new Date().toISOString().slice(0, 10)

// Estado inicial de operación de un evento
const initOpState = (totalItems) => ({
  activePhase: null,       // 'f1'|'f2'|'f3'|'f4'|null
  scanMode: null,          // 'auto'|'manual'|null
  phases: {
    f1: { scanned: [], done: false, incidents: [] },
    f2: { scanned: [], done: false, incidents: [] },
    f3: { scanned: [], done: false, incidents: [] },
    f4: { scanned: [], done: false, incidents: [] },
  },
  totalItems,
  forcedBy: null,
  forceLog: [],
})

/* ─── Calcula porcentaje global ─────────────────────────────────────────────── */
const calcProgress = (opState) => {
  if (!opState) return 0
  const { phases, totalItems } = opState
  if (!totalItems) return 0
  let pct = 0
  const phaseWeight = 25
  PHASES.forEach(ph => {
    const p = phases[ph.key]
    if (p.done) {
      pct += phaseWeight
    } else if (opState.activePhase === ph.key) {
      const ratio = p.scanned.length / totalItems
      pct += ratio * phaseWeight
    }
  })
  return Math.min(Math.round(pct), 100)
}

const calcPhaseProgress = (phase, totalItems) => {
  if (!totalItems) return 0
  if (phase.done) return 100
  return Math.min(Math.round((phase.scanned.length / totalItems) * 100), 100)
}

/* ─── Componente principal ──────────────────────────────────────────────────── */
export default function Operations() {
  const { role } = useAuth()
  const roleLabel = role === 'admin' ? 'Administrador' : 'Operador'
  const {
    events, products, rentals, updateEvent, setEvents, epcMap, markUnitOccupied, markUnitAvailable, closeEventToHistory,
    // opStates: { [eventId]: opState } — vive en InventoryContext para que el
    // progreso de fases NO se pierda al navegar a otra página y volver.
    opStates, setOpStates
  } = useInventory()

  // Modal de operación activa
  const [activeModal, setActiveModal] = React.useState(null) // { eventId, phase }
  const [openModal, setOpenModal] = React.useState(false)

  // Modal forzar cierre (solo admin)
  const [openForce, setOpenForce] = React.useState(false)
  const [forceTarget, setForceTarget] = React.useState(null) // { eventId, phase|'all' }
  const forceTargetRef = React.useRef(null) // ref para useCallback estable
  const [openForceLog, setOpenForceLog] = React.useState(false)
  const [forceLogEvent, setForceLogEvent] = React.useState(null)

  // Modal incidencia manual
  const [openIncident, setOpenIncident] = React.useState(false)
  const [incidentItem, setIncidentItem] = React.useState(null)
  const [incidentReason, setIncidentReason] = React.useState('')
  const [incidentState, setIncidentState] = React.useState('Perdido')

  // Simulación auto-scan
  const scanIntervalRef = React.useRef(null)
  const [isAutoRunning, setIsAutoRunning] = React.useState(false)

  const [snack, setSnack] = React.useState({ open: false, msg: '', severity: 'success' })

  // Callbacks estables para ForceDialogExternal (evita remounts con React.memo)
  const stableCloseForce = React.useCallback(() => setOpenForce(false), [])
  const showSnack = (msg, severity = 'success') => setSnack({ open: true, msg, severity })

  // Filtro
  const [filter, setFilter] = React.useState('all') // all|active|pending|done|rental
  const [openRentalModal, setOpenRentalModal] = React.useState(false)
  const [activeRental, setActiveRental] = React.useState(null)

  /* ── Inicializar opState de un evento si no existe ── */
  const getOrInitOp = (ev) => {
    if (opStates[ev.id]) return opStates[ev.id]
    const total = (ev.assignments || []).reduce((s, a) => s + a.qty, 0)
    return initOpState(total)
  }

  const updateOp = (eventId, updater) => {
    setOpStates(prev => {
      const ev = events.find(e => e.id === eventId)
      const current = prev[eventId] || initOpState((ev?.assignments || []).reduce((s, a) => s + a.qty, 0))
      return { ...prev, [eventId]: updater(current) }
    })
  }

  /* ── Obtener artículos del evento con info de producto ── */
  const getEventItems = (ev) => {
    return (ev.assignments || []).flatMap(a => {
      const prod = products.find(p => p.id === a.productId)
      if (!prod) return []
      // Usa los IDs reales de unidad fijados al crear/editar el evento.
      // Fallback a IDs sintéticos solo si el evento es de datos antiguos sin unitIds.
      const unitIds = (a.unitIds && a.unitIds.length === a.qty)
        ? a.unitIds
        : Array.from({ length: a.qty }, (_, i) => `${prod.id}-${i + 1}`)
      return unitIds.map((unitId, i) => {
        const unit = prod.units.find(u => u.id === unitId)
        return {
          id: unitId,
          rfid: unit?.rfid || `${prod.rfidBase}-${String(i + 1).padStart(2, '0')}`,
          name: prod.name,
          sku: prod.sku,
          productId: prod.id,
        }
      })
    })
  }

  /* ── Iniciar fase ── */
  const startPhase = (ev, phaseKey) => {
    const op = getOrInitOp(ev)
    // Validar que la fase anterior esté completa
    const phaseIdx = PHASES.findIndex(p => p.key === phaseKey)
    if (phaseIdx > 0) {
      const prevPhase = PHASES[phaseIdx - 1]
      const prevDone = op.phases[prevPhase.key]?.done
      if (!prevDone) {
        showSnack(`Debes completar "${prevPhase.label}" antes de continuar`, 'error')
        return
      }
    }
    updateOp(ev.id, op => ({ ...op, activePhase: phaseKey, scanMode: 'auto' }))
    // Actualizar estado del evento a 'En curso'
    if (ev.status === 'Programado' || ev.status === 'Confirmado') {
      setEvents(prev => prev.map(e => e.id === ev.id ? { ...e, status: 'En curso' } : e))
    }
  }

  /* ── Abrir modal de operación ── */
  const openOpModal = (ev, phaseKey) => {
    setActiveModal({ eventId: ev.id, phase: phaseKey })
    setOpenModal(true)
  }

  /* ── Simular escaneo RFID (auto) ── */
  const startAutoScan = (eventId, phaseKey) => {
    const ev = events.find(e => e.id === eventId)
    const items = getEventItems(ev)
    const op = opStates[eventId] || initOpState(items.length)
    const alreadyScanned = op.phases[phaseKey].scanned.map(s => s.id)
    const pending = items.filter(i => !alreadyScanned.includes(i.id))

    if (pending.length === 0) return

    setIsAutoRunning(true)

    // Buffer acumulador — vive en un ref para no causar re-renders por sí mismo
    const bufferRef = { scanned: [] }
    const BATCH = 3      // flush cada N artículos
    const TICK = 400    // ms entre artículos (más rápido, sin parpadeo)
    let idx = 0

    const flush = (finalPendingLen) => {
      const snapshot = [...bufferRef.scanned]
      setOpStates(prev => {
        const current = prev[eventId]
        if (!current) return prev
        const phase = current.phases[phaseKey]
        const merged = [...phase.scanned, ...snapshot]
        const done = merged.length + phase.incidents.length >= current.totalItems
        return {
          ...prev,
          [eventId]: {
            ...current,
            phases: {
              ...current.phases,
              [phaseKey]: { ...phase, scanned: merged, done }
            }
          }
        }
      })
      bufferRef.scanned = []
    }

    scanIntervalRef.current = setInterval(() => {
      const item = pending[idx]
      if (!item) {
        if (bufferRef.scanned.length > 0) flush()
        clearInterval(scanIntervalRef.current)
        scanIntervalRef.current = null
        setIsAutoRunning(false)
        return
      }

      bufferRef.scanned.push({ ...item, scannedAt: new Date().toISOString() })
      idx++

      // Flush cada BATCH artículos o al terminar
      if (bufferRef.scanned.length >= BATCH || idx >= pending.length) {
        flush()
      }

      if (idx >= pending.length) {
        clearInterval(scanIntervalRef.current)
        scanIntervalRef.current = null
        setIsAutoRunning(false)
      }
    }, TICK)
  }

  const stopAutoScan = () => {
    clearInterval(scanIntervalRef.current)
    scanIntervalRef.current = null
    setIsAutoRunning(false)
  }

  /* ── Escaneo manual: marcar artículo ── */
  const manualScanItem = (eventId, phaseKey, item) => {
    if (phaseKey === 'f1') markUnitOccupied(item.id)
    if (phaseKey === 'f4') markUnitAvailable(item.id)
    updateOp(eventId, op => {
      const phase = op.phases[phaseKey]
      if (phase.scanned.find(s => s.id === item.id)) return op // ya escaneado
      const newScanned = [...phase.scanned, { ...item, scannedAt: new Date().toISOString() }]
      const done = newScanned.length + phase.incidents.length >= op.totalItems
      return {
        ...op,
        phases: { ...op.phases, [phaseKey]: { ...phase, scanned: newScanned, done } }
      }
    })
  }

  /* ── Completar fase manualmente ── */
  const completePhase = (eventId, phaseKey) => {
    updateOp(eventId, op => ({
      ...op,
      activePhase: null,
      phases: { ...op.phases, [phaseKey]: { ...op.phases[phaseKey], done: true } }
    }))
    // Si es F4, marcar evento como Realizado
    if (phaseKey === 'f4') {
      setEvents(prev => prev.map(e => e.id === eventId ? { ...e, status: 'Realizado' } : e))
      showSnack('¡Evento completado! Ciclo logístico cerrado.', 'success')
    } else {
      showSnack(`Fase completada. Puedes iniciar la siguiente.`, 'success')
    }
    setOpenModal(false)
  }

  /* ── Cerrar evento: mover de Operaciones a Historial de Eventos ──
   * Se dispara desde el modal "Evento concluido" (botón "Guardar y cerrar"),
   * que a su vez solo aparece tras el ticket de F4. Al archivar, el evento
   * sale de `events`, así que `filteredEvents` deja de incluirlo — no hace
   * falta lógica de filtrado aparte para "ocultarlo". */
  const finalizeEvent = (eventId) => {
    const ev = events.find(e => e.id === eventId)
    const op = opStates[eventId]
    closeEventToHistory(ev, op, roleLabel)
    setOpenModal(false)
    showSnack('Evento guardado en el Historial de Eventos.', 'success')
  }

  /* ── Forzar cierre (admin) ── */
  const handleForceClose = React.useCallback((reason) => {
    const { eventId, phase } = forceTargetRef.current || {}
    const logEntry = {
      at: new Date().toISOString(),
      user: 'Administrador',
      phase: phase === 'all' ? 'Ciclo completo' : PHASES.find(p => p.key === phase)?.label,
      reason,
    }
    if (phase === 'all') {
      updateOp(eventId, op => ({
        ...op,
        activePhase: null,
        forcedBy: logEntry,
        forceLog: [...(op.forceLog || []), logEntry],
        phases: Object.fromEntries(
          PHASES.map(p => [p.key, { ...op.phases[p.key], done: true, forcedClose: true }])
        )
      }))
      setEvents(prev => prev.map(e => e.id === eventId ? { ...e, status: 'Realizado' } : e))
      showSnack('Ciclo completo forzado por administrador.', 'warning')
    } else {
      updateOp(eventId, op => ({
        ...op,
        activePhase: null,
        forcedBy: logEntry,
        forceLog: [...(op.forceLog || []), logEntry],
        phases: { ...op.phases, [phase]: { ...op.phases[phase], done: true, forcedClose: true } }
      }))
      showSnack(`Fase "${PHASES.find(p => p.key === phase)?.label}" forzada por administrador.`, 'warning')
    }
    setOpenForce(false)
    setOpenModal(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ── Registrar incidencia (artículo perdido/mantenimiento) ── */
  const registerIncident = () => {
    const { eventId, phaseKey } = incidentItem
    updateOp(eventId, op => {
      const phase = op.phases[phaseKey]
      const newIncidents = [...phase.incidents, {
        ...incidentItem,
        state: incidentState,
        reason: incidentReason,
        reportedAt: new Date().toISOString()
      }]
      const done = phase.scanned.length + newIncidents.length >= op.totalItems
      return {
        ...op,
        phases: { ...op.phases, [phaseKey]: { ...phase, incidents: newIncidents, done } }
      }
    })
    // Simular notificación
    showSnack(`Incidencia registrada: ${incidentItem.name} → ${incidentState}. Notificación enviada.`, 'warning')
    setOpenIncident(false)
    setIncidentReason('')
    setIncidentItem(null)
  }

  /* ── Determinar qué fase debe mostrarse como activa/siguiente ── */
  const getNextPhase = (op) => {
    for (const ph of PHASES) {
      if (!op.phases[ph.key].done) return ph.key
    }
    return null
  }

  /* ── Filtrar eventos ── */
  const filteredEvents = events.filter(ev => {
    if (filter === 'rental') return false // rentals shown separately below
    if (filter === 'pending') return ev.status === 'Programado' || ev.status === 'Confirmado'
    if (filter === 'active') return ev.status === 'En curso'
    if (filter === 'done') return ev.status === 'Realizado'
    return ev.status !== 'Suspendido'
  }).sort((a, b) => a.date > b.date ? 1 : -1)

  /* ── Render de una card de evento ── */
  const EventCard = ({ ev }) => {
    const op = getOrInitOp(ev)
    const progress = calcProgress(op)
    const nextPhase = getNextPhase(op)
    const isDone = ev.status === 'Realizado'
    const totalItems = op.totalItems
    const hasIncidents = PHASES.some(ph => op.phases[ph.key].incidents.length > 0)

    return (
      <Paper sx={{ p: 2, mb: 2, border: '1px solid', borderColor: isDone ? 'success.dark' : hasIncidents ? 'warning.dark' : 'divider', opacity: isDone ? 0.85 : 1 }}>

        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Typography variant="body1" fontWeight={600}>{ev.name}</Typography>
              <Chip label={ev.orderNumber} size="small" color="primary" variant="outlined" sx={{ fontSize: 10 }} />
              <Chip
                label={ev.status}
                size="small"
                color={isDone ? 'success' : ev.status === 'En curso' ? 'warning' : 'default'}
              />
              {hasIncidents && (
                <Chip icon={<WarningAmberIcon sx={{ fontSize: 14 }} />} label="Con incidencias" size="small" color="warning" variant="outlined" />
              )}
              {op.forcedBy && (
                <Chip
                  icon={<AdminPanelSettingsIcon sx={{ fontSize: 14 }} />}
                  label="Cierre forzado — ver detalle"
                  size="small" color="error" variant="outlined"
                  onClick={() => { setForceLogEvent(op); setOpenForceLog(true) }}
                  sx={{ cursor: 'pointer' }}
                />
              )}
            </Box>
            <Box sx={{ display: 'flex', gap: 2, mt: 0.5, flexWrap: 'wrap' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <EventIcon sx={{ fontSize: 13, color: 'text.secondary' }} />
                <Typography variant="caption" color="text.secondary">{ev.date}</Typography>
              </Box>
              {ev.location && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <PlaceIcon sx={{ fontSize: 13, color: 'text.secondary' }} />
                  <Typography variant="caption" color="text.secondary">{ev.location}</Typography>
                </Box>
              )}
              <Typography variant="caption" color="primary">{totalItems} artículos</Typography>
            </Box>
          </Box>

          {/* Botones de acción */}
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
            {!isDone && nextPhase && (
              <Button
                size="small"
                variant="contained"
                startIcon={op.activePhase === nextPhase ? <QrCodeScannerIcon /> : <PlayArrowIcon />}
                onClick={() => {
                  if (!op.phases[nextPhase]?.done && op.activePhase !== nextPhase) {
                    startPhase(ev, nextPhase)
                  }
                  openOpModal(ev, nextPhase)
                }}
                sx={{ fontSize: 12 }}
              >
                {op.activePhase === nextPhase ? 'En curso' : 'Iniciar'}
              </Button>
            )}
            {role === 'admin' && !isDone && (
              <Tooltip title="Forzar cierre del ciclo completo (admin)">
                <IconButton size="small" color="error" onClick={() => { stopAutoScan(); setForceTarget({ eventId: ev.id, phase: 'all' }); forceTargetRef.current = { eventId: ev.id, phase: 'all' }; setOpenForce(true) }}>
                  <AdminPanelSettingsIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </Box>

        {/* Barra de progreso global */}
        <Box sx={{ mb: 1.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="caption" color="text.secondary">Progreso total</Typography>
            <Typography variant="caption" fontWeight={600} color={isDone ? 'success.main' : progress > 0 ? 'primary.main' : 'text.secondary'}>
              {progress}%
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={progress}
            color={isDone ? 'success' : hasIncidents ? 'warning' : 'primary'}
            sx={{ height: 10, borderRadius: 5 }}
          />
        </Box>

        {/* Leyenda de fases */}
        <Box sx={{ display: 'flex', borderRadius: 1, overflow: 'hidden', border: '1px solid', borderColor: 'divider', mb: 1.5 }}>
          {PHASES.map((ph, i) => {
            const phState = op.phases[ph.key]
            const isActive = op.activePhase === ph.key
            const bg = phState.done ? ph.bgColor : isActive ? ph.bgColor + 'aa' : 'transparent'
            return (
              <Box key={ph.key} sx={{
                flex: 1, py: 0.7, px: 0.5, textAlign: 'center',
                fontSize: 10, fontWeight: 500,
                background: bg,
                color: phState.done ? ph.textColor : isActive ? ph.textColor : 'text.disabled',
                borderLeft: i > 0 ? '1px solid' : 'none', borderColor: 'divider',
                cursor: !isDone && (phState.done || isActive) ? 'pointer' : 'default'
              }}
                onClick={() => { if (phState.done || isActive) openOpModal(ev, ph.key) }}
              >
                {ph.short} · {ph.label.split(' ')[0]}
                {phState.done && ' ✓'}
                {phState.incidents.length > 0 && ' ⚠'}
              </Box>
            )
          })}
        </Box>

        {/* Detalle por fase */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8 }}>
          {PHASES.map(ph => {
            const phState = op.phases[ph.key]
            const phasePct = calcPhaseProgress(phState, totalItems)
            const isActive = op.activePhase === ph.key
            return (
              <Box key={ph.key} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ color: phState.done ? ph.color : isActive ? ph.color : 'text.disabled', display: 'flex' }}>
                  {phState.done ? <CheckCircleIcon sx={{ fontSize: 14 }} /> : <RadioButtonUncheckedIcon sx={{ fontSize: 14 }} />}
                </Box>
                <Typography variant="caption" sx={{ minWidth: 150, color: phState.done || isActive ? 'text.primary' : 'text.disabled' }}>
                  {ph.short} · {ph.label}
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={phasePct}
                  sx={{ flex: 1, height: 6, borderRadius: 3, bgcolor: 'action.hover', '& .MuiLinearProgress-bar': { bgcolor: phState.done ? ph.color : isActive ? ph.color : '#888' } }}
                />
                <Typography variant="caption" sx={{ minWidth: 32, textAlign: 'right', color: phState.done ? ph.color : 'text.secondary' }}>
                  {phState.done ? '25%' : isActive ? `${Math.round(phasePct / 4)}%` : '—'}
                </Typography>
                {phState.incidents.length > 0 && (
                  <Chip label={`${phState.incidents.length} inc.`} size="small" color="warning" sx={{ fontSize: 10, height: 18 }} />
                )}
                {phState.forcedClose && (
                  <Chip label="forzado" size="small" color="error" variant="outlined" sx={{ fontSize: 10, height: 18 }} />
                )}
              </Box>
            )
          })}
        </Box>
      </Paper>
    )
  }

  /* ── Modal de operación ── */
  /* ── Modal forzar cierre ── */
  /* ForceModal y ForceLogModal se renderizan como componentes externos al final del JSX
     para evitar re-renders del padre en cada keystroke */

  /* ── Modal incidencia ── */
  const IncidentModal = () => (
    <Dialog open={openIncident} onClose={() => setOpenIncident(false)} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ color: 'warning.main', display: 'flex', alignItems: 'center', gap: 1 }}>
        <WarningAmberIcon /> Registrar incidencia
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
        {incidentItem && (
          <Alert severity="info" sx={{ py: 0.5 }}>
            <Typography variant="caption"><strong>{incidentItem.name}</strong> · {incidentItem.rfid}</Typography>
          </Alert>
        )}
        <TextField
          select label="Estado del artículo" value={incidentState}
          onChange={e => setIncidentState(e.target.value)}
          SelectProps={{ native: true }}
        >
          <option value="Perdido">Perdido</option>
          <option value="En Mantenimiento">En Mantenimiento</option>
        </TextField>
        <TextField
          fullWidth label="Descripción de la incidencia" multiline minRows={2}
          value={incidentReason} onChange={e => setIncidentReason(e.target.value)}
          placeholder="Ej: No se encontró al cargar el camión..."
        />
        <Alert severity="warning" sx={{ py: 0.5 }}>
          Se enviará notificación automática vía WhatsApp y correo electrónico.
        </Alert>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setOpenIncident(false)}>Cancelar</Button>
        <Button variant="contained" color="warning" disabled={!incidentReason.trim()} onClick={registerIncident}>
          Registrar y notificar
        </Button>
      </DialogActions>
    </Dialog>
  )

  /* ── Render principal ── */
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Box>
          <Typography variant="h5">Operaciones</Typography>
          {filter === 'rental' && (
            <Typography variant="caption" sx={{ color: '#EF9F27' }}>Vista: Rental</Typography>
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {[
            { key: 'all', label: 'Todos' },
            { key: 'pending', label: 'Pendientes' },
            { key: 'active', label: 'En curso' },
            { key: 'done', label: 'Realizados' },
          ].map(f => (
            <Button
              key={f.key}
              size="small"
              variant={filter === f.key ? 'contained' : 'outlined'}
              onClick={() => setFilter(f.key)}
              sx={{ fontSize: 12 }}
            >
              {f.label}
            </Button>
          ))}
          <Button
            size="small"
            variant={filter === 'rental' ? 'contained' : 'outlined'}
            onClick={() => setFilter('rental')}
            startIcon={<HandshakeIcon sx={{ fontSize: 14 }} />}
            sx={{ fontSize: 12, bgcolor: filter === 'rental' ? '#EF9F27' : 'transparent', borderColor: '#EF9F27', color: filter === 'rental' ? '#000' : '#EF9F27', '&:hover': { bgcolor: '#EF9F2733', borderColor: '#EF9F27' } }}
          >
            Rental
          </Button>
        </Box>
      </Box>

      {/* ── Eventos ── */}
      {filter !== 'rental' && (
        filteredEvents.length === 0 ? (
          <Paper sx={{ p: 4, textAlign: 'center', mb: 2 }}>
            <EventIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
            <Typography color="text.secondary">No hay eventos en esta categoría.</Typography>
          </Paper>
        ) : (
          filteredEvents.map(ev => <EventCard key={ev.id} ev={ev} />)
        )
      )}

      {/* ── Rentals — siempre visibles en TODOS, o exclusivos con botón Rental ── */}
      {(filter === 'all' || filter === 'rental') && rentals.length > 0 && (
        <Box sx={{ mt: filter === 'all' ? 2 : 0 }}>
          {filter === 'all' && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
              <HandshakeIcon sx={{ color: '#EF9F27', fontSize: 18 }} />
              <Typography variant="subtitle2" sx={{ color: '#EF9F27', fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', fontSize: 12 }}>
                Operaciones Rental
              </Typography>
            </Box>
          )}
          {rentals.map(r => <RentalCard key={r.id} rental={r} />)}
        </Box>
      )}
      {filter === 'rental' && rentals.length === 0 && (
        <Paper sx={{ p: 6, textAlign: 'center' }}>
          <HandshakeIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
          <Typography color="text.secondary">No hay arriendos registrados.</Typography>
        </Paper>
      )}

      <OpModalExternal
        open={openModal}
        activeModal={activeModal}
        events={events}
        opStates={opStates}
        products={products}
        isAutoRunning={isAutoRunning}
        role={role}
        onClose={() => { stopAutoScan(); setOpenModal(false) }}
        onStartAutoScan={startAutoScan}
        onStopAutoScan={stopAutoScan}
        onCompletePhase={completePhase}
        onFinalizeEvent={finalizeEvent}
        onManualScan={manualScanItem}
        onForceOpen={(eventId, phase) => {
          setForceTarget({ eventId, phase })
          forceTargetRef.current = { eventId, phase }
          setOpenForce(true)
        }}
        onIncidentOpen={(item) => { setIncidentItem(item); setOpenIncident(true) }}
        onUpdateOp={updateOp}
      />
      <ForceDialogExternal
        open={openForce}
        target={forceTarget}
        onClose={stableCloseForce}
        onConfirm={handleForceClose}
      />
      <ForceLogDialog
        open={openForceLog}
        opState={forceLogEvent}
        onClose={() => setOpenForceLog(false)}
      />
      <IncidentModal />

      <Snackbar
        open={snack.open} autoHideDuration={4000}
        onClose={() => setSnack(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={snack.severity} onClose={() => setSnack(s => ({ ...s, open: false }))}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </Box>
  )
}



/* ═══════════════════════════════════════════════════════════════════════════
 * useRfidScanMatcher — lógica compartida de matching RFID real
 * Usada por OpModalExternal (eventos) y RentalPhaseModal (rental).
 * Se repite igual en TODAS las fases (F1-F4 en eventos, F1/F4 en rental) —
 * la lógica es genérica por `phase`, no está hardcodeada a F1.
 *
 * Exactamente 3 estados posibles (según especificación del usuario):
 *  1) ROJO        : el sticker no existe / no está registrado en el sistema
 *                   → pide registrarlo. Llega como 'rfid_unknown' del bridge.
 *  2) AZUL+blanco : el sticker SÍ existe/está registrado, pero la unidad no
 *                   pertenece a este evento ni a este arriendo.
 *  3) VERDE       : el sticker pertenece a esta operación y queda registrado
 *                   correctamente (si además completa la fase, se suma el
 *                   modal "Elementos pasados").
 * (Aparte, hay un aviso menor de "ya escaneado" para no duplicar conteos —
 * no es uno de los 3 estados pedidos, solo evita doble registro.)
 * ═══════════════════════════════════════════════════════════════════════════ */
function useRfidScanMatcher({ open, allItems, isAlreadyHandled, onValidScan, notBelongMsg }) {
  const { isConnected, lastScan, unknownTags, clearLastScan } = useRfidSocket()
  const [scanAlert, setScanAlert] = React.useState(null) // { severity, tone, msg }
  const lastUnknownRef = React.useRef(null)
  const wasOpenRef = React.useRef(open)

  // Auto-ocultar la alerta luego de unos segundos
  React.useEffect(() => {
    if (!scanAlert) return
    const t = setTimeout(() => setScanAlert(null), 5000)
    return () => clearTimeout(t)
  }, [scanAlert])

  // BUG FIX: el hook de socket no se desmonta al cerrar el modal, así que
  // `unknownTags` puede traer arrastrado un EPC desconocido de ANTES de abrir
  // este modal (de una sesión/simulación anterior). Sin esto, al abrir el
  // modal el efecto de abajo cree que ese EPC viejo es "nuevo" y dispara la
  // alerta de "Sticker no registrado" sin que el usuario haya pasado nada.
  // Por eso, al pasar de cerrado→abierto, tomamos como línea base el último
  // EPC desconocido YA existente, para que solo se avise de EPCs que lleguen
  // de ahora en adelante.
  React.useEffect(() => {
    if (open && !wasOpenRef.current) {
      lastUnknownRef.current = unknownTags && unknownTags.length > 0
        ? unknownTags[unknownTags.length - 1]
        : null
    }
    wasOpenRef.current = open
  }, [open, unknownTags])

  // ── 1) ROJO: sticker no registrado ──
  React.useEffect(() => {
    if (!open || !unknownTags || unknownTags.length === 0) return
    const epc = unknownTags[unknownTags.length - 1]
    if (lastUnknownRef.current === epc) return
    lastUnknownRef.current = epc
    setScanAlert({
      severity: 'error',
      tone: 'red',
      msg: `Sticker no registrado (EPC …${epc.slice(-8)})`
    })
  }, [unknownTags, open])

  // ── Sticker resuelto por el bridge (lastScan.sku = unitId) ──
  React.useEffect(() => {
    if (!lastScan || !open) return
    const unitId = lastScan.sku
    const item = allItems.find(it => it.id === unitId)

    // ── 2) AZUL con letra blanca: existe pero no pertenece a esta operación ──
    if (!item) {
      setScanAlert({ severity: 'info', tone: 'doesntBelong', msg: notBelongMsg || 'Este sticker no pertenece a este evento' })
      clearLastScan()
      return
    }
    // Aviso menor (no es uno de los 3 estados pedidos): ya fue escaneado antes
    if (isAlreadyHandled(item)) {
      setScanAlert({ severity: 'info', tone: 'alreadyScanned', msg: `Este artículo ya fue escaneado en esta fase — ${item.name}` })
      clearLastScan()
      return
    }
    // ── 3) VERDE: pertenece y queda registrado correctamente ──
    onValidScan(item)
    setScanAlert({ severity: 'success', tone: 'green', msg: `✓ Registrado correctamente: ${item.name} (${item.sku})` })
    clearLastScan()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastScan])

  return { isConnected, scanAlert, setScanAlert }
}

/* ─── Banner / Modal de alerta de escaneo (rojo / azul-blanco / verde) ───
 * Rojo (no registrado) y azul (registrado pero no pertenece) se muestran
 * como un modal grande de color, que el usuario debe cerrar explícitamente
 * con la X — son los 2 casos que requieren atención/acción.
 * Verde (registrado OK) y el aviso menor de "ya escaneado" siguen como
 * banner inline que se auto-oculta, porque no bloquean el flujo. ───────── */
function ScanAlertBanner({ alert, onClose }) {
  if (!alert) return null

  if (alert.tone === 'red' || alert.tone === 'doesntBelong') {
    return <ScanAlertModal alert={alert} onClose={onClose} />
  }

  return (
    <Fade in>
      <Alert severity={alert.severity} onClose={onClose} sx={{ mb: 2 }}>
        {alert.msg}
      </Alert>
    </Fade>
  )
}

/* ─── Modal grande: sticker no registrado (ROJO) / registrado pero no
 * pertenece a esta operación (AZUL con letra blanca) ──────────────────── */
function ScanAlertModal({ alert, onClose }) {
  const isRed = alert.tone === 'red'
  const palette = isRed
    ? { titleBg: 'rgba(211,47,47,0.12)', titleColor: '#C62828', bodyBg: 'background.paper', textColor: 'text.primary', boxBg: 'rgba(211,47,47,0.08)', boxBorder: '#E57373', boxText: '#C62828' }
    : { titleBg: '#0D47A1', titleColor: '#FFFFFF', bodyBg: '#1565C0', textColor: '#FFFFFF', boxBg: 'rgba(255,255,255,0.14)', boxBorder: 'rgba(255,255,255,0.5)', boxText: '#FFFFFF' }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        bgcolor: palette.titleBg, color: palette.titleColor
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {isRed ? <ErrorOutlineIcon /> : <WarningAmberIcon />}
          {isRed ? 'Sticker no registrado' : 'Sticker registrado — no pertenece a esta operación'}
        </Box>
        <IconButton size="small" onClick={onClose} sx={{ color: palette.titleColor }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ pt: 3, bgcolor: palette.bodyBg }}>
        <Typography variant="body1" fontWeight={600} sx={{ mb: 2, color: palette.textColor }}>
          {alert.msg}
        </Typography>
        <Box sx={{ p: 1.5, borderRadius: 1, bgcolor: palette.boxBg, border: `1px solid ${palette.boxBorder}` }}>
          <Typography variant="body2" sx={{ color: palette.boxText }}>
            {isRed
              ? 'Este sticker no está registrado en el sistema. Por favor, ve a "Registrar RFID" para registrarlo antes de continuar.'
              : 'Este sticker sí está registrado en el sistema, pero no pertenece a ningún evento ni arriendo actual. Verifica que estás escaneando el elemento correcto para esta operación.'}
          </Typography>
        </Box>
      </DialogContent>
    </Dialog>
  )
}

/* ─── Modal "ticket": Elementos pasados (fase completada) ─────────────────── */
function CompletionTicketModal({ open, onClose, title, subtitle, count, color }) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        bgcolor: `${color}20`, color
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ConfirmationNumberIcon />
          Elementos pasados
        </Box>
        <IconButton size="small" onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ pt: 3, textAlign: 'center' }}>
        <CheckCircleIcon sx={{ fontSize: 56, color, mb: 1 }} />
        <Typography variant="h6" fontWeight={700}>{title}</Typography>
        {subtitle && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{subtitle}</Typography>
        )}
        <Typography variant="h4" fontWeight={800} sx={{ color, mt: 1 }}>
          {count} / {count}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Todos los elementos pasaron por la antena correctamente.
        </Typography>
      </DialogContent>
    </Dialog>
  )
}

/* ─── Modal "Evento concluido" / "Arriendo concluido" ──────────────────────
 * Aparece justo después del ticket "Elementos pasados" de la fase F4 (la
 * última fase, recepción en bodega). Es el segundo paso del cierre: el
 * ticket confirma que pasaron todos los artículos, este modal confirma que
 * el usuario quiere archivar la operación. Si cierra sin guardar ("Más
 * tarde"), la card sigue en Operaciones como "Realizado" — no se pierde
 * nada, solo se posterga el archivado. ──────────────────────────────────── */
function CloseOperationModal({ open, kind, summary, onDismiss, onSave }) {
  const isEvent = kind === 'event'
  const title = isEvent ? 'Evento concluido' : 'Arriendo concluido'
  const color = isEvent ? '#534AB7' : '#EF9F27'
  const historyLabel = isEvent ? 'Historial de Eventos' : 'Historial de Rentas'

  return (
    <Dialog open={open} onClose={onDismiss} fullWidth maxWidth="xs">
      <DialogTitle sx={{
        display: 'flex', alignItems: 'center', gap: 1,
        bgcolor: `${color}20`, color
      }}>
        <CheckCircleIcon />
        {title}
      </DialogTitle>
      <DialogContent dividers sx={{ pt: 2 }}>
        <Typography variant="body2" sx={{ mb: 2 }}>
          El ciclo logístico se completó. Al guardar, esta operación se
          archivará en <strong>{historyLabel}</strong> y dejará de aparecer
          en Operaciones.
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.6, p: 1.5, borderRadius: 1, bgcolor: 'action.hover' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="caption" color="text.secondary">N° orden</Typography>
            <Typography variant="caption" fontWeight={600}>{summary.orderNumber}</Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="caption" color="text.secondary">Nombre</Typography>
            <Typography variant="caption" fontWeight={600}>{summary.name}</Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="caption" color="text.secondary">Artículos</Typography>
            <Typography variant="caption" fontWeight={600}>{summary.totalItems}</Typography>
          </Box>
          {isEvent && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="caption" color="text.secondary">Incidencias</Typography>
              <Typography variant="caption" fontWeight={600}>{summary.incidentsCount || 0}</Typography>
            </Box>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onDismiss}>Más tarde</Button>
        <Button variant="contained" sx={{ bgcolor: color, color: '#000', '&:hover': { bgcolor: color, opacity: 0.9 } }} onClick={onSave}>
          Guardar y cerrar
        </Button>
      </DialogActions>
    </Dialog>
  )
}

/* ─── RentalCard ──────────────────────────────────────────────────────────── */
function RentalCard({ rental }) {
  const { products, closeRentalToHistory } = useInventory()
  const { role } = useAuth()
  const [openModal, setOpenModal] = React.useState(false)
  const [phase, setPhase] = React.useState(null)
  // scannedItems guarda los IDs de unidad ya escaneados por fase (no solo un contador)
  // para poder hacer matching real contra el sticker leído por la antena.
  const [scannedItems, setScannedItems] = React.useState({ f1: [], f4: [] })
  // activePhase: misma idea de "gating" que en eventos — hay que pulsar
  // "Iniciar" antes de poder escanear esa fase, en vez de saltar directo
  // a los botones de fase.
  const [activePhase, setActivePhase] = React.useState(null)

  const totalItems = (rental.assignments || []).reduce((s, a) => s + a.qty, 0)
  const progress = {
    f1: totalItems ? Math.min(Math.round((scannedItems.f1.length / totalItems) * 100), 100) : 0,
    f4: totalItems ? Math.min(Math.round((scannedItems.f4.length / totalItems) * 100), 100) : 0,
  }
  const phaseDone = (key) => totalItems > 0 && scannedItems[key].length >= totalItems
  const isDone = phaseDone('f1') && phaseDone('f4')
  const nextPhase = RENTAL_PHASES.find(ph => !phaseDone(ph.key))?.key

  const openPhase = (ph) => { setPhase(ph); setOpenModal(true) }

  /* ── Cerrar arriendo: mover de Operaciones a Historial de Rentas ── */
  const finalizeRental = () => {
    closeRentalToHistory(rental, totalItems, role === 'admin' ? 'Administrador' : 'Operador')
    setOpenModal(false)
  }

  return (
    <Paper sx={{ p: 2, mb: 2, border: '1px solid', borderColor: '#EF9F27', opacity: 0.95 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography variant="body1" fontWeight={600}>{rental.name}</Typography>
            <Chip label={rental.orderNumber} size="small" sx={{ fontSize: 10, bgcolor: '#EF9F27', color: '#000' }} />
            <Chip label="Rental" size="small" sx={{ bgcolor: '#EF9F2733', color: '#EF9F27', border: '1px solid #EF9F27', fontSize: 10 }} />
            {isDone && <Chip label="Completado" size="small" color="success" icon={<CheckCircleIcon sx={{ fontSize: 14 }} />} />}
          </Box>
          <Box sx={{ display: 'flex', gap: 2, mt: 0.5, flexWrap: 'wrap' }}>
            <Typography variant="caption" color="text.secondary">{rental.date}{rental.endDate ? ` → ${rental.endDate}` : ''}</Typography>
            {rental.clientName && <Typography variant="caption" color="text.secondary">Cliente: {rental.clientName}</Typography>}
            <Typography variant="caption" sx={{ color: '#EF9F27' }}>{totalItems} artículos</Typography>
          </Box>
        </Box>

        {/* Botón de inicio — mismo patrón que en eventos */}
        {!isDone && nextPhase && (
          <Button
            size="small"
            variant="contained"
            startIcon={activePhase === nextPhase ? <QrCodeScannerIcon /> : <PlayArrowIcon />}
            onClick={() => {
              if (activePhase !== nextPhase) setActivePhase(nextPhase)
              openPhase(nextPhase)
            }}
            sx={{ fontSize: 12, bgcolor: '#EF9F27', color: '#000', '&:hover': { bgcolor: '#d98a1f' } }}
          >
            {activePhase === nextPhase ? 'En curso' : 'Iniciar'}
          </Button>
        )}
      </Box>

      {/* Leyenda de fases — igual que en eventos: solo abre directo si está activa o ya completada */}
      <Box sx={{ display: 'flex', borderRadius: 1, overflow: 'hidden', border: '1px solid', borderColor: 'divider', mb: 1.5 }}>
        {RENTAL_PHASES.map((ph, i) => {
          const done = phaseDone(ph.key)
          const isActive = activePhase === ph.key
          const bg = done ? ph.bgColor : isActive ? ph.bgColor + 'aa' : 'transparent'
          return (
            <Box key={ph.key} sx={{
              flex: 1, py: 0.7, px: 0.5, textAlign: 'center',
              fontSize: 10, fontWeight: 500,
              background: bg,
              color: done ? ph.textColor : isActive ? ph.textColor : 'text.disabled',
              borderLeft: i > 0 ? '1px solid' : 'none', borderColor: 'divider',
              cursor: (done || isActive) ? 'pointer' : 'default'
            }}
              onClick={() => { if (done || isActive) openPhase(ph.key) }}
            >
              {ph.short} · {ph.label}
              {done && ' ✓'}
            </Box>
          )
        })}
      </Box>

      {/* Mini progress bars */}
      <Box sx={{ mt: 1.5, display: 'flex', flexDirection: 'column', gap: 0.8 }}>
        {RENTAL_PHASES.map(ph => (
          <Box key={ph.key} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="caption" sx={{ minWidth: 130, color: 'text.secondary' }}>{ph.short} · {ph.label}</Typography>
            <LinearProgress variant="determinate" value={progress[ph.key]}
              sx={{ flex: 1, height: 6, borderRadius: 3, bgcolor: 'action.hover', '& .MuiLinearProgress-bar': { bgcolor: ph.color } }} />
            <Typography variant="caption" sx={{ minWidth: 32, textAlign: 'right', color: ph.color }}>
              {progress[ph.key] > 0 ? `${progress[ph.key]}%` : '—'}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* Modal de fase */}
      <RentalPhaseModal
        open={openModal} phase={phase} rental={rental}
        products={products} totalItems={totalItems}
        scannedItems={scannedItems} setScannedItems={setScannedItems}
        onClose={() => setOpenModal(false)}
        onFinalizeRental={finalizeRental}
      />
    </Paper>
  )
}

/* ─── RentalPhaseModal ────────────────────────────────────────────────────── */
function RentalPhaseModal({ open, phase, rental, products, totalItems, scannedItems, setScannedItems, onClose, onFinalizeRental }) {
  const { markUnitBackFromRental } = useInventory()
  const phaseObj = RENTAL_PHASES.find(p => p.key === phase)

  const items = (rental.assignments || []).flatMap(a => {
    const prod = products.find(p => p.id === a.productId)
    if (!prod) return []
    // Usa los IDs reales de unidad fijados al crear el arriendo, para que
    // nunca coincidan con los IDs reales usados por un evento del mismo producto.
    const unitIds = (a.unitIds && a.unitIds.length === a.qty)
      ? a.unitIds
      : Array.from({ length: a.qty }, (_, i) => `${prod.id}-${i + 1}`)
    return unitIds.map(unitId => ({
      id: unitId,
      name: prod.name,
      sku: prod.sku,
    }))
  })

  const scannedIds = (phase && scannedItems?.[phase]) || []
  const scannedCount = scannedIds.length
  const pct = totalItems > 0 ? Math.min(Math.round((scannedCount / totalItems) * 100), 100) : 0
  const pendingItems = items.filter(it => !scannedIds.includes(it.id))

  // ── Modal "Elementos pasados": aparece una vez al llegar a 100% ──
  const [showTicket, setShowTicket] = React.useState(false)
  const ticketShownRef = React.useRef(false)
  React.useEffect(() => {
    if (!open) { ticketShownRef.current = false; return }
    if (pct === 100 && totalItems > 0 && !ticketShownRef.current) {
      ticketShownRef.current = true
      setShowTicket(true)
    }
  }, [pct, totalItems, open])

  // ── Modal "Arriendo concluido": aparece justo después del ticket, solo
  // en F4 (última fase del arriendo) ──
  const [showCloseModal, setShowCloseModal] = React.useState(false)
  const closeTicket = () => {
    setShowTicket(false)
    if (phase === 'f4') setShowCloseModal(true)
  }

  /* ── Marca un artículo como escaneado en esta fase y actualiza inventario ── */
  const markScanned = (item) => {
    setScannedItems(prev => {
      const list = prev[phase] || []
      if (list.includes(item.id)) return prev
      return { ...prev, [phase]: [...list, item.id] }
    })
    // F1 "Salida de bodega": la unidad ya pasó a Rental al crear el arriendo.
    // F4 "Entrada a bodega": vuelve de Rental a Disponible.
    if (phase === 'f4') markUnitBackFromRental(item.id)
  }

  // ── Conexión RFID real — escucha la antena igual que el modal de eventos ──
  const { isConnected, scanAlert, setScanAlert } = useRfidScanMatcher({
    open,
    allItems: items,
    isAlreadyHandled: (item) => scannedIds.includes(item.id),
    onValidScan: markScanned,
    notBelongMsg: 'Este sticker no pertenece a este arriendo'
  })

  if (!phaseObj) return null

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ color: phaseObj.color }}>{phaseObj.icon}</Box>
          {phaseObj.label} — {rental.name}
          <Chip label={rental.orderNumber} size="small" sx={{ bgcolor: '#EF9F27', color: '#000', fontSize: 10, ml: 1 }} />
          <Chip
            label={isConnected ? '🟢 Antena conectada' : '⚫ Antena desconectada'}
            size="small"
            sx={{ fontSize: 10, ml: 1, bgcolor: isConnected ? '#1D9E7520' : '#88888820', color: isConnected ? '#1D9E75' : '#888' }}
          />
        </Box>
      </DialogTitle>
      <DialogContent>
        <ScanAlertBanner alert={scanAlert} onClose={() => setScanAlert(null)} />
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="body2" color="text.secondary">{scannedCount} de {totalItems} artículos escaneados</Typography>
            <Typography variant="body2" fontWeight={600} sx={{ color: phaseObj.color }}>{pct}%</Typography>
          </Box>
          <LinearProgress variant="determinate" value={pct}
            sx={{ height: 12, borderRadius: 6, '& .MuiLinearProgress-bar': { bgcolor: phaseObj.color } }} />
        </Box>
        <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <Typography variant="caption" color="text.secondary">
            Pasa cada sticker por la antena. También puedes simular o marcar manualmente si la antena no está disponible.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
          <Button variant="outlined" size="small" startIcon={<WifiIcon />}
            onClick={() => pendingItems[0] && markScanned(pendingItems[0])}
            disabled={pendingItems.length === 0}>
            Simular siguiente escaneo
          </Button>
        </Box>
        <Box sx={{ maxHeight: 320, overflowY: 'auto' }}>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>Artículos del arriendo</Typography>
          <List dense disablePadding>
            {items.map((item) => {
              const scanned = scannedIds.includes(item.id)
              return (
                <ListItem key={item.id}
                  secondaryAction={!scanned && (
                    <Button size="small" variant="outlined" sx={{ fontSize: 10, py: 0.2 }}
                      onClick={() => markScanned(item)}>
                      Marcar
                    </Button>
                  )}
                  sx={{
                    py: 0.5, px: 1, mb: 0.3, borderRadius: 1,
                    bgcolor: scanned ? 'rgba(239,159,39,0.08)' : 'background.paper',
                    border: '1px solid', borderColor: scanned ? '#EF9F27' : 'divider'
                  }}>
                  <ListItemIcon sx={{ minWidth: 28 }}>
                    {scanned
                      ? <CheckCircleIcon sx={{ fontSize: 16, color: '#EF9F27' }} />
                      : <RadioButtonUncheckedIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
                    }
                  </ListItemIcon>
                  <ListItemText
                    primary={<Typography variant="caption" fontWeight={scanned ? 600 : 400}>{item.name}</Typography>}
                    secondary={<Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace', fontSize: 10 }}>{item.sku}</Typography>}
                  />
                </ListItem>
              )
            })}
          </List>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cerrar</Button>
        {pct === 100 && <Chip label="Fase completada" color="success" icon={<CheckCircleIcon />} />}
      </DialogActions>
      <CompletionTicketModal
        open={showTicket}
        onClose={closeTicket}
        title="Elementos pasados"
        subtitle={`${rental.name} — ${phaseObj.label}`}
        count={totalItems}
        color={phaseObj.color}
      />
      <CloseOperationModal
        open={showCloseModal}
        kind="rental"
        summary={{ orderNumber: rental.orderNumber, name: rental.name, totalItems }}
        onDismiss={() => setShowCloseModal(false)}
        onSave={() => { setShowCloseModal(false); onFinalizeRental() }}
      />
    </Dialog>
  )
}

/* ─── Fases de Rental (solo F1 y F4) ──────────────────────────────────────── */
const RENTAL_PHASES = [
  { key: 'f1', label: 'Salida de bodega', short: 'F1', icon: <LocalShippingIcon sx={{ fontSize: 14 }} />, color: '#EF9F27', bgColor: '#FAEEDA', textColor: '#633806' },
  { key: 'f4', label: 'Entrada a bodega', short: 'F4', icon: <InventoryIcon sx={{ fontSize: 14 }} />, color: '#534AB7', bgColor: '#EEEDFE', textColor: '#3C3489' },
]

/* ═══════════════════════════════════════════════════════════════════════════
 * OpModalExternal — fuera del componente padre para evitar remounts
 * ═══════════════════════════════════════════════════════════════════════════ */
const OpModalExternal = React.memo(function OpModalExternal({
  open, activeModal, events, opStates, products,
  isAutoRunning, role,
  onClose, onStartAutoScan, onStopAutoScan, onCompletePhase, onFinalizeEvent,
  onManualScan, onForceOpen, onIncidentOpen, onUpdateOp
}) {
  if (!open || !activeModal) return null
  const { eventId, phase } = activeModal
  const ev = events.find(e => e.id === eventId)
  if (!ev) return null
  const op = opStates[eventId] || { phases: { f1: { scanned: [], done: false, incidents: [] }, f2: { scanned: [], done: false, incidents: [] }, f3: { scanned: [], done: false, incidents: [] }, f4: { scanned: [], done: false, incidents: [] } }, totalItems: 0 }
  const phaseObj = PHASES.find(p => p.key === phase)
  const phState = op.phases[phase]

  const allItems = (ev.assignments || []).flatMap(a => {
    const prod = products.find(p => p.id === a.productId)
    if (!prod) return []
    // IDs reales de unidad (no sintéticos) para que coincidan exactamente
    // con la unidad física que la antena resuelve, y nunca choquen con un
    // arriendo que use el mismo producto.
    const unitIds = (a.unitIds && a.unitIds.length === a.qty)
      ? a.unitIds
      : Array.from({ length: a.qty }, (_, i) => `${prod.id}-${i + 1}`)
    return unitIds.map((unitId, i) => {
      const unit = prod.units.find(u => u.id === unitId)
      return {
        id: unitId,
        rfid: unit?.rfid || `${prod.rfidBase}-${String(i + 1).padStart(2, '0')}`,
        name: prod.name, sku: prod.sku, productId: prod.id,
      }
    })
  })

  const scannedIds = phState.scanned.map(s => s.id)
  const incidentIds = phState.incidents.map(i => i.id)
  const pendingItems = allItems.filter(i => !scannedIds.includes(i.id) && !incidentIds.includes(i.id))
  const phasePct = op.totalItems ? Math.min(Math.round(((phState.scanned.length / op.totalItems) * 100)), 100) : 0
  const isActive = op.activePhase === phase

  // ── Modal "Elementos pasados": aparece una vez al llegar a 100% ──
  const [showTicket, setShowTicket] = React.useState(false)
  const ticketShownRef = React.useRef(false)
  React.useEffect(() => {
    if (!open) { ticketShownRef.current = false; return }
    if (phasePct === 100 && op.totalItems > 0 && !ticketShownRef.current) {
      ticketShownRef.current = true
      setShowTicket(true)
    }
  }, [phasePct, op.totalItems, open])

  // ── Modal "Evento concluido": aparece justo después del ticket, solo en
  // F4 (última fase del evento) ──
  const [showCloseModal, setShowCloseModal] = React.useState(false)
  const closeTicket = () => {
    setShowTicket(false)
    if (phase === 'f4') setShowCloseModal(true)
  }

  // ── Conexión RFID real — usa el mismo matcher que RentalPhaseModal ────────
  const { isConnected, scanAlert, setScanAlert } = useRfidScanMatcher({
    open,
    allItems,
    isAlreadyHandled: (item) => scannedIds.includes(item.id) || incidentIds.includes(item.id),
    onValidScan: (item) => onManualScan(eventId, phase, item),
    notBelongMsg: 'Este sticker no pertenece a este evento'
  })

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ color: phaseObj.color }}>{phaseObj.icon}</Box>
          {phaseObj.label} — {ev.name}
          <Chip label={ev.orderNumber} size="small" color="primary" variant="outlined" sx={{ fontSize: 10, ml: 1 }} />
          <Chip
            label={isConnected ? '🔴 Antena conectada' : '⚫ Antena desconectada'}
            size="small"
            sx={{ fontSize: 10, ml: 1, bgcolor: isConnected ? '#1D9E7520' : '#88888820', color: isConnected ? '#1D9E75' : '#888' }}
          />
        </Box>
      </DialogTitle>
      <DialogContent>
        <ScanAlertBanner alert={scanAlert} onClose={() => setScanAlert(null)} />
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="body2" color="text.secondary">
              {phState.scanned.length} de {op.totalItems} artículos escaneados
              {phState.incidents.length > 0 && ` · ${phState.incidents.length} con incidencia`}
            </Typography>
            <Typography variant="body2" fontWeight={600} sx={{ color: phaseObj.color }}>{phasePct}%</Typography>
          </Box>
          <LinearProgress variant="determinate" value={phasePct}
            sx={{ height: 12, borderRadius: 6, '& .MuiLinearProgress-bar': { bgcolor: phaseObj.color } }} />
        </Box>
        {phState.incidents.length > 0 && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            <Typography variant="caption" fontWeight={600}>Artículos con incidencia:</Typography>
            {phState.incidents.map((inc, i) => (
              <Box key={i} sx={{ fontSize: 12 }}>• {inc.name} ({inc.rfid}) → <strong>{inc.state}</strong>: {inc.reason}</Box>
            ))}
          </Alert>
        )}
        {!phState.done && (
          <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <Button variant="contained" size="small" startIcon={<WifiIcon />} color="primary"
              onClick={() => onStartAutoScan(eventId, phase)}
              disabled={isAutoRunning || pendingItems.length === 0}>
              Simular lectura RFID
            </Button>
            <Button variant="outlined" size="small" startIcon={<StopIcon />} color="error"
              onClick={onStopAutoScan} disabled={!isAutoRunning}>
              Detener
            </Button>
            <Button variant="outlined" size="small" startIcon={<EditNoteIcon />}
              onClick={() => { onUpdateOp(eventId, op => ({ ...op, scanMode: 'manual' })) }}>
              Modo manual
            </Button>
            {role === 'admin' && (
              <Tooltip title="Forzar cierre de esta fase (admin)">
                <Button variant="outlined" size="small" color="error" startIcon={<LockIcon />}
                  onClick={() => {
                    onStopAutoScan()
                    onForceOpen(eventId, phase)
                  }}>
                  Forzar fase
                </Button>
              </Tooltip>
            )}
          </Box>
        )}
        <Box sx={{ maxHeight: 360, overflowY: 'auto' }}>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>Artículos del evento</Typography>
          <List dense disablePadding>
            {allItems.map(item => {
              const scanned = scannedIds.includes(item.id)
              const incident = phState.incidents.find(i => i.id === item.id)
              return (
                <ListItem key={item.id} sx={{
                  py: 0.5, px: 1, mb: 0.3, borderRadius: 1,
                  bgcolor: scanned ? 'rgba(99,153,34,0.08)' : incident ? 'rgba(186,117,23,0.1)' : 'background.paper',
                  border: '1px solid', borderColor: scanned ? '#639922' : incident ? '#BA7517' : 'divider'
                }}
                  secondaryAction={!phState.done && (
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      {!scanned && !incident && op.scanMode === 'manual' && (
                        <Button size="small" variant="outlined" sx={{ fontSize: 10, py: 0.2 }}
                          onClick={() => onManualScan(eventId, phase, item)}>Marcar</Button>
                      )}
                      {!scanned && !incident && (
                        <Button size="small" color="warning" variant="outlined" sx={{ fontSize: 10, py: 0.2 }}
                          onClick={() => onIncidentOpen({ ...item, eventId, phaseKey: phase })}>
                          Incidencia
                        </Button>
                      )}
                    </Box>
                  )}>
                  <ListItemIcon sx={{ minWidth: 28 }}>
                    {scanned ? <CheckCircleIcon sx={{ fontSize: 16, color: '#639922' }} />
                      : incident ? <WarningAmberIcon sx={{ fontSize: 16, color: '#BA7517' }} />
                        : <RadioButtonUncheckedIcon sx={{ fontSize: 16, color: 'text.disabled' }} />}
                  </ListItemIcon>
                  <ListItemText
                    primary={<Typography variant="caption" fontWeight={scanned ? 600 : 400}>{item.name}</Typography>}
                    secondary={<Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace', fontSize: 10 }}>
                      {item.rfid}{incident && ` · ${incident.state}: ${incident.reason}`}
                    </Typography>}
                  />
                </ListItem>
              )
            })}
          </List>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Cerrar</Button>
        {!phState.done && (
          <Button variant="contained" color="success"
            disabled={pendingItems.length > 0 && phState.incidents.length === 0}
            onClick={() => onCompletePhase(eventId, phase)}>
            Completar fase ({phasePct}%)
          </Button>
        )}
        {phState.done && <Chip label="Fase completada" color="success" icon={<CheckCircleIcon />} />}
      </DialogActions>
      <CompletionTicketModal
        open={showTicket}
        onClose={closeTicket}
        title="Elementos pasados"
        subtitle={`${ev.name} — ${phaseObj.label}`}
        count={op.totalItems}
        color={phaseObj.color}
      />
      <CloseOperationModal
        open={showCloseModal}
        kind="event"
        summary={{
          orderNumber: ev.orderNumber,
          name: ev.name,
          totalItems: op.totalItems,
          incidentsCount: Object.values(op.phases).reduce((s, p) => s + (p.incidents?.length || 0), 0)
        }}
        onDismiss={() => setShowCloseModal(false)}
        onSave={() => { setShowCloseModal(false); onFinalizeEvent(eventId) }}
      />
    </Dialog>
  )
})

/* ═══════════════════════════════════════════════════════════════════════════
 * ForceDialogExternal — componente EXTERNO al padre para evitar lag en input
 * El estado local del textarea vive aquí, no sube al padre hasta confirmar.
 * ═══════════════════════════════════════════════════════════════════════════ */
const ForceDialogExternal = React.memo(function ForceDialogExternal({ open, target, onClose, onConfirm }) {
  const [reason, setReason] = React.useState('')

  // Limpiar al cerrar
  React.useEffect(() => {
    if (!open) setReason('')
  }, [open])

  const handleConfirm = () => {
    onConfirm(reason)
    setReason('')
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ color: 'error.main', display: 'flex', alignItems: 'center', gap: 1 }}>
        <AdminPanelSettingsIcon />
        Forzar cierre — Admin
      </DialogTitle>
      <DialogContent>
        <Alert severity="warning" sx={{ mb: 2 }}>
          Esta acción cierra{' '}
          {target?.phase === 'all' ? 'el ciclo completo' : 'la fase actual'}{' '}
          independientemente del estado de los artículos.
        </Alert>
        <TextField
          fullWidth
          label="Motivo del forzado"
          multiline
          minRows={3}
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="Ej: Falla en antena, tiempo operativo crítico..."
          autoFocus
        />
        <Box sx={{ mt: 1.5, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Box sx={{ fontSize: 12, color: 'text.secondary' }}>
            Fecha y hora: <strong>{new Date().toLocaleString('es-CL')}</strong>
          </Box>
          <Box sx={{ fontSize: 12, color: 'text.secondary' }}>
            Responsable: <strong>Administrador</strong>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button
          variant="contained"
          color="error"
          disabled={!reason.trim()}
          onClick={handleConfirm}
        >
          Confirmar forzado
        </Button>
      </DialogActions>
    </Dialog>
  )
})

/* ═══════════════════════════════════════════════════════════════════════════
 * ForceLogDialog — muestra el historial de cierres forzados de un evento
 * ═══════════════════════════════════════════════════════════════════════════ */
function ForceLogDialog({ open, opState, onClose }) {
  if (!opState) return null
  const log = opState.forceLog || []
  const fmt = (iso) => {
    if (!iso) return '—'
    const d = new Date(iso)
    return d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
      ' ' + d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <AdminPanelSettingsIcon color="error" />
        Historial de cierres forzados
      </DialogTitle>
      <DialogContent>
        {log.length === 0 ? (
          <Alert severity="info">No hay registros de cierres forzados para este evento.</Alert>
        ) : (
          log.map((entry, i) => (
            <Paper
              key={i}
              variant="outlined"
              sx={{ p: 2, mb: 1.5, borderColor: 'error.dark', borderRadius: 2 }}
            >
              <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', mb: 1 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">FECHA Y HORA</Typography>
                  <Typography variant="body2" fontWeight={600}>{fmt(entry.at)}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">RESPONSABLE</Typography>
                  <Typography variant="body2" fontWeight={600}>{entry.user}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">ÁMBITO</Typography>
                  <Typography variant="body2" fontWeight={600}>{entry.phase}</Typography>
                </Box>
              </Box>
              <Divider sx={{ mb: 1 }} />
              <Typography variant="caption" color="text.secondary">MOTIVO / DETALLE</Typography>
              <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: 'pre-wrap' }}>
                {entry.reason}
              </Typography>
            </Paper>
          ))
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  )
}
