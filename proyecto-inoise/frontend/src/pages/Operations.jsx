import React from 'react'
import {
  Box, Typography, Paper, Chip, Button, Divider,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Alert, Snackbar, LinearProgress,
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
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import StopIcon from '@mui/icons-material/Stop'
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner'
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings'
import EventIcon from '@mui/icons-material/Event'
import PlaceIcon from '@mui/icons-material/Place'

import { useInventory } from '../context/InventoryContext'
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
  const { events, products, updateEvent, setEvents } = useInventory()

  // opStates: { [eventId]: opState }
  const [opStates, setOpStates] = React.useState({})

  // Modal de operación activa
  const [activeModal, setActiveModal] = React.useState(null) // { eventId, phase }
  const [openModal, setOpenModal] = React.useState(false)

  // Modal forzar cierre (solo admin)
  const [openForce, setOpenForce] = React.useState(false)
  const [forceTarget, setForceTarget] = React.useState(null) // { eventId, phase|'all' }
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
  const [filter, setFilter] = React.useState('all') // all|active|pending|done

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
      return Array.from({ length: a.qty }, (_, i) => ({
        id: `${prod.id}-${i + 1}`,
        rfid: `${prod.rfidBase}-${String(i + 1).padStart(2, '0')}`,
        name: prod.name,
        sku: prod.sku,
        productId: prod.id,
      }))
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

  /* ── Forzar cierre (admin) ── */
  const handleForceClose = (reason) => {
    const { eventId, phase } = forceTarget
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
  }

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
                {op.activePhase === nextPhase
                  ? `En curso · ${PHASES.find(p => p.key === nextPhase)?.short}`
                  : `Iniciar · ${PHASES.find(p => p.key === nextPhase)?.short}`
                }
              </Button>
            )}
            {role === 'admin' && !isDone && (
              <Tooltip title="Forzar cierre del ciclo completo (admin)">
                <IconButton size="small" color="error" onClick={() => { setForceTarget({ eventId: ev.id, phase: 'all' }); setOpenForce(true) }}>
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
  const OpModal = () => {
    if (!activeModal) return null
    const { eventId, phase } = activeModal
    const ev = events.find(e => e.id === eventId)
    if (!ev) return null
    const op = opStates[eventId] || initOpState(0)
    const phaseObj = PHASES.find(p => p.key === phase)
    const phState = op.phases[phase]
    const allItems = getEventItems(ev)
    const scannedIds = phState.scanned.map(s => s.id)
    const incidentIds = phState.incidents.map(i => i.id)
    const pendingItems = allItems.filter(i => !scannedIds.includes(i.id) && !incidentIds.includes(i.id))
    const phasePct = calcPhaseProgress(phState, op.totalItems)
    const isActive = op.activePhase === phase

    return (
      <Dialog open={openModal} onClose={() => { stopAutoScan(); setOpenModal(false) }} fullWidth maxWidth="md">
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ color: phaseObj.color }}>{phaseObj.icon}</Box>
            {phaseObj.label} — {ev.name}
            <Chip label={ev.orderNumber} size="small" color="primary" variant="outlined" sx={{ fontSize: 10, ml: 1 }} />
          </Box>
        </DialogTitle>

        <DialogContent>
          {/* Barra de progreso de la fase */}
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="body2" color="text.secondary">
                {phState.scanned.length} de {op.totalItems} artículos escaneados
                {phState.incidents.length > 0 && ` · ${phState.incidents.length} con incidencia`}
              </Typography>
              <Typography variant="body2" fontWeight={600} sx={{ color: phaseObj.color }}>{phasePct}%</Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={phasePct}
              sx={{ height: 12, borderRadius: 6, '& .MuiLinearProgress-bar': { bgcolor: phaseObj.color } }}
            />
          </Box>

          {/* Incidencias */}
          {phState.incidents.length > 0 && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              <Typography variant="caption" fontWeight={600}>Artículos con incidencia:</Typography>
              {phState.incidents.map((inc, i) => (
                <Box key={i} sx={{ fontSize: 12 }}>• {inc.name} ({inc.rfid}) → <strong>{inc.state}</strong>: {inc.reason}</Box>
              ))}
            </Alert>
          )}

          {/* Controles de escaneo */}
          {!phState.done && (
            <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
              <Button
                variant="contained"
                size="small"
                startIcon={<WifiIcon />}
                color="primary"
                onClick={() => startAutoScan(eventId, phase)}
                disabled={isAutoRunning || pendingItems.length === 0}
              >
                Simular lectura RFID
              </Button>
              <Button
                variant="outlined"
                size="small"
                startIcon={<StopIcon />}
                color="error"
                onClick={stopAutoScan}
                disabled={!isAutoRunning}
              >
                Detener
              </Button>
              <Button
                variant="outlined"
                size="small"
                startIcon={<EditNoteIcon />}
                onClick={() => {
                  updateOp(eventId, op => ({ ...op, scanMode: 'manual' }))
                  showSnack('Modo manual activado. Marca artículos uno a uno.', 'info')
                }}
              >
                Modo manual
              </Button>
              {role === 'admin' && (
                <Tooltip title="Forzar cierre de esta fase (admin)">
                  <Button
                    variant="outlined"
                    size="small"
                    color="error"
                    startIcon={<LockIcon />}
                    onClick={() => { setForceTarget({ eventId, phase }); setOpenForce(true) }}
                  >
                    Forzar fase
                  </Button>
                </Tooltip>
              )}
            </Box>
          )}

          {/* Lista de artículos */}
          <Box sx={{ maxHeight: 360, overflowY: 'auto' }}>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
              Artículos del evento
            </Typography>
            <List dense disablePadding>
              {allItems.map(item => {
                const scanned = scannedIds.includes(item.id)
                const incident = phState.incidents.find(i => i.id === item.id)
                return (
                  <ListItem
                    key={item.id}
                    sx={{
                      py: 0.5, px: 1, mb: 0.3, borderRadius: 1,
                      bgcolor: scanned ? 'rgba(99,153,34,0.08)' : incident ? 'rgba(186,117,23,0.1)' : 'background.paper',
                      border: '1px solid',
                      borderColor: scanned ? '#639922' : incident ? '#BA7517' : 'divider'
                    }}
                    secondaryAction={
                      !phState.done && (
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          {!scanned && !incident && op.scanMode === 'manual' && (
                            <Button size="small" variant="outlined" sx={{ fontSize: 10, py: 0.2 }}
                              onClick={() => manualScanItem(eventId, phase, item)}>
                              Marcar
                            </Button>
                          )}
                          {!scanned && !incident && (
                            <Button size="small" color="warning" variant="outlined" sx={{ fontSize: 10, py: 0.2 }}
                              onClick={() => {
                                setIncidentItem({ ...item, eventId, phaseKey: phase })
                                setOpenIncident(true)
                              }}>
                              Incidencia
                            </Button>
                          )}
                        </Box>
                      )
                    }
                  >
                    <ListItemIcon sx={{ minWidth: 28 }}>
                      {scanned
                        ? <CheckCircleIcon sx={{ fontSize: 16, color: '#639922' }} />
                        : incident
                          ? <WarningAmberIcon sx={{ fontSize: 16, color: '#BA7517' }} />
                          : <RadioButtonUncheckedIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
                      }
                    </ListItemIcon>
                    <ListItemText
                      primary={<Typography variant="caption" fontWeight={scanned ? 600 : 400}>{item.name}</Typography>}
                      secondary={
                        <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace', fontSize: 10 }}>
                          {item.rfid}
                          {incident && ` · ${incident.state}: ${incident.reason}`}
                        </Typography>
                      }
                    />
                  </ListItem>
                )
              })}
            </List>
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => { stopAutoScan(); setOpenModal(false) }}>Cerrar</Button>
          {!phState.done && (
            <Button
              variant="contained"
              color="success"
              disabled={pendingItems.length > 0 && phState.incidents.length === 0}
              onClick={() => completePhase(eventId, phase)}
            >
              Completar fase ({phasePct}%)
            </Button>
          )}
          {phState.done && (
            <Chip label="Fase completada" color="success" icon={<CheckCircleIcon />} />
          )}
        </DialogActions>
      </Dialog>
    )
  }

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
        <Typography variant="h5">Operaciones</Typography>
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
        </Box>
      </Box>

      {filteredEvents.length === 0 ? (
        <Paper sx={{ p: 6, textAlign: 'center' }}>
          <EventIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
          <Typography color="text.secondary">No hay eventos en esta categoría.</Typography>
        </Paper>
      ) : (
        filteredEvents.map(ev => <EventCard key={ev.id} ev={ev} />)
      )}

      <OpModal />
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
