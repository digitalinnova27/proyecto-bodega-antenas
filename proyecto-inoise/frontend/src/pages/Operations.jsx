import React from 'react'
import {
  Box, Typography, Paper, Chip, Button, Divider,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Alert, Snackbar, LinearProgress, Fade, Collapse,
  List, ListItem, ListItemText, ListItemIcon,
  Tooltip, IconButton, Badge
} from '@mui/material'
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import InventoryIcon from '@mui/icons-material/Inventory'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked'
import EditNoteIcon from '@mui/icons-material/EditNote'
import LockIcon from '@mui/icons-material/Lock'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import CloseIcon from '@mui/icons-material/Close'
import ConfirmationNumberIcon from '@mui/icons-material/ConfirmationNumber'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner'
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings'
import EventIcon from '@mui/icons-material/Event'
import PlaceIcon from '@mui/icons-material/Place'
import SearchIcon from '@mui/icons-material/Search'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import FilterAltOffIcon from '@mui/icons-material/FilterAltOff'

import HandshakeIcon from '@mui/icons-material/Handshake'
import { useNavigate } from 'react-router-dom'
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

/* ─── Clasificación de estado — compartida por eventos y arriendos ──────────
 * "Cancelado" y "Realizado"/"Concluido" son estados finales: ya no
 * requieren ninguna acción, así que solo se muestran en la pestaña "Todos"
 * (nunca en "En curso" ni en "Próximos"). Todo lo demás (Programado,
 * Confirmado, En curso...) se considera "abierto" y se reparte entre
 * "En curso"/"Próximos" según su fecha. */
const isFinishedStatus = (status) => status === 'Realizado' || status === 'Concluido'
const isCancelledStatus = (status) => status === 'Cancelado'
const isOpenStatus = (status) => !isFinishedStatus(status) && !isCancelledStatus(status)

/* ─── Fecha con día/semana/mes — usado por el filtro y el agrupado de
 * "Todos" ── */
const WEEKDAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const MONTH_NAMES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

// "2026-08-09" → "2026-W32" (semana ISO, lunes a domingo)
const isoWeekKey = (dateStr) => {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  if (isNaN(d)) return ''
  const target = new Date(d.valueOf())
  const dayNr = (d.getDay() + 6) % 7 // lunes=0 ... domingo=6
  target.setDate(target.getDate() - dayNr + 3)
  const firstThursday = new Date(target.getFullYear(), 0, 4)
  const diff = target - firstThursday
  const week = 1 + Math.round(diff / (7 * 24 * 3600 * 1000))
  return `${target.getFullYear()}-W${String(week).padStart(2, '0')}`
}

const monthOf = (dateStr) => (dateStr ? String(dateStr).slice(0, 7) : '')

// "2026-08-09" → "Domingo 9 de agosto de 2026 · Semana 32"
const formatGroupHeader = (dateStr) => {
  if (!dateStr) return 'Sin fecha'
  const d = new Date(dateStr + 'T00:00:00')
  if (isNaN(d)) return dateStr
  const weekday = WEEKDAY_NAMES[d.getDay()]
  const week = isoWeekKey(dateStr).split('-W')[1]
  return `${weekday} ${d.getDate()} de ${MONTH_NAMES[d.getMonth()]} de ${d.getFullYear()} · Semana ${week}`
}

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
  // lostItems vive a nivel de EVENTO (no por fase): una vez que un artículo
  // se registra como perdido/incidencia, queda excluido de "pendiente" en
  // TODAS las fases siguientes automáticamente — antes cada fase tenía su
  // propio `incidents`, así que un artículo perdido en F1 volvía a aparecer
  // como pendiente en F2/F3/F4, obligando a reportarlo de nuevo cada vez.
  lostItems: [],
  totalItems,
  forcedBy: null,
  forceLog: [],
})

/* ─── Calcula porcentaje global ─────────────────────────────────────────────── */
const calcProgress = (opState) => {
  if (!opState) return 0
  const { phases, totalItems } = opState
  if (!totalItems) return 0
  const lostCount = (opState.lostItems || []).length
  let pct = 0
  const phaseWeight = 25
  PHASES.forEach(ph => {
    const p = phases[ph.key]
    if (p.done) {
      pct += phaseWeight
    } else if (opState.activePhase === ph.key) {
      const ratio = Math.min((p.scanned.length + lostCount) / totalItems, 1)
      pct += ratio * phaseWeight
    }
  })
  return Math.min(Math.round(pct), 100)
}

const calcPhaseProgress = (phase, totalItems, lostCount = 0) => {
  if (!totalItems) return 0
  if (phase.done) return 100
  return Math.min(Math.round(((phase.scanned.length + lostCount) / totalItems) * 100), 100)
}

/* ─── Componente principal ──────────────────────────────────────────────────── */
export default function Operations() {
  const navigate = useNavigate()
  const { role, currentUser: authUser } = useAuth()
  const roleLabel = authUser ? `${authUser.nombre} ${authUser.apellido}` : (role === 'admin' ? 'Administrador' : 'Operador')
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

  // Modal incidencia manual — el estado/motivo viven DENTRO de
  // IncidentDialogExternal (componente externo), no acá, para evitar que
  // cada tecleo dispare un re-render del padre (ese era el bug que sólo
  // dejaba escribir un carácter en el textarea de motivo).
  const [openIncident, setOpenIncident] = React.useState(false)
  const [incidentItem, setIncidentItem] = React.useState(null)

  const [snack, setSnack] = React.useState({ open: false, msg: '', severity: 'success', action: null })

  // Callbacks estables para ForceDialogExternal (evita remounts con React.memo)
  const stableCloseForce = React.useCallback(() => setOpenForce(false), [])
  // `action` opcional: { label, onClick } — se muestra como botón dentro del
  // aviso (ej. "Ver detalle" que lleva al Historial).
  const showSnack = (msg, severity = 'success', action = null) => setSnack({ open: true, msg, severity, action })

  // Filtro — 3 vistas para eventos (En curso / Próximos / Todos) + Rental,
  // que a su vez tiene sus propias 3 vistas (ver rentalFilter más abajo).
  const [filter, setFilter] = React.useState('active') // active|upcoming|all|rental
  const [rentalFilter, setRentalFilter] = React.useState('active') // active|upcoming|all
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

  /* ── Escaneo manual: marcar artículo ──
   * OJO: el estado Reservado→Ocupado→Disponible vive en products[].units[],
   * indexado por el ID del CUPO preasignado (slotId) — no por el tag físico
   * real que terminó satisfaciéndolo (que puede ser un gemelo, ver F1 más
   * abajo). Por eso acá siempre se usa item.slotId (si existe) en vez de
   * item.id — de lo contrario, en F4 se intentaría liberar el tag real
   * (que nunca quedó marcado Ocupado) y el cupo original se quedaría
   * Ocupado para siempre, sin bajar nunca a Disponible. */
  const manualScanItem = (eventId, phaseKey, item) => {
    const slotId = item.slotId || item.id
    if (phaseKey === 'f1') markUnitOccupied(slotId)
    if (phaseKey === 'f4') markUnitAvailable(slotId)

    // El botón "Completar fase" solo se muestra mientras la fase NO está
    // done — pero `done` se calcula abajo, en el mismo escaneo que la
    // completa, así que ese botón desaparece ANTES de que alguien alcance a
    // pulsarlo (nunca queda 100% escaneado con el botón todavía visible).
    // Por eso lo que antes hacía completePhase (limpiar activePhase, y en
    // F4 pasar el evento a "Realizado") se dispara acá mismo, apenas la
    // fase pasa de no-done a done por un escaneo real — no depende de un
    // botón que en la práctica nunca llega a estar disponible.
    const opBefore = opStates[eventId]
    const phaseBefore = opBefore?.phases?.[phaseKey]
    const alreadyScanned = phaseBefore?.scanned?.some(s => s.id === item.id)
    const willBeDone = !alreadyScanned && opBefore
      ? ((phaseBefore.scanned.length + 1) + (opBefore.lostItems || []).length) >= opBefore.totalItems
      : false
    const justCompleted = willBeDone && !phaseBefore?.done

    updateOp(eventId, op => {
      const phase = op.phases[phaseKey]
      if (phase.scanned.find(s => s.id === item.id)) return op // ya escaneado
      const newScanned = [...phase.scanned, { ...item, scannedAt: new Date().toISOString() }]
      const done = newScanned.length + (op.lostItems || []).length >= op.totalItems
      return {
        ...op,
        activePhase: (done && !phase.done) ? null : op.activePhase,
        phases: { ...op.phases, [phaseKey]: { ...phase, scanned: newScanned, done } }
      }
    })

    if (phaseKey === 'f4' && justCompleted) {
      setEvents(prev => prev.map(e => e.id === eventId ? { ...e, status: 'Realizado' } : e))
      showSnack('¡Evento completado! Revisa el resumen y guarda para archivarlo en el Historial.', 'success')
    }
  }

  /* ── Completar fase manualmente (hoy solo queda alcanzable si se fuerza
   * el avance con 0 artículos pendientes de otra forma; el escaneo normal
   * ya deja la fase "done" automáticamente en manualScanItem de arriba) ── */
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
   * que a su vez solo aparece tras el ticket de F4. El evento queda marcado
   * "Concluido" y sigue visible en Eventos/Operaciones, mientras su detalle
   * completo (fases, artículos, incidencias) queda en el Historial. */
  const finalizeEvent = (eventId) => {
    const ev = events.find(e => e.id === eventId)
    const op = opStates[eventId]
    closeEventToHistory(ev, op, roleLabel)
    setOpenModal(false)
    showSnack('Evento guardado en el Historial de Eventos.', 'success', {
      label: 'Ver detalle',
      onClick: () => navigate('/history', { state: { tab: 0, expandOrderNumber: ev?.orderNumber } })
    })
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
      // Si la fase forzada es F4 (la última), el evento también pasa a
      // "Realizado" — igual que al completarla escaneando normalmente,
      // para que no quede visible como "En curso" para siempre.
      if (phase === 'f4') {
        setEvents(prev => prev.map(e => e.id === eventId ? { ...e, status: 'Realizado' } : e))
      }
      showSnack(`Fase "${PHASES.find(p => p.key === phase)?.label}" forzada. Si quedó algún artículo sin escanear, usa el botón "Incidencia" para registrarlo antes de avanzar.`, 'warning')
    }
    setOpenForce(false)
    // OJO: el modal de la fase NO se cierra al forzar una fase individual —
    // a propósito. Forzar el cierre solo desbloquea el avance, pero el/los
    // artículo(s) que no se escanearon siguen sin resolver: el usuario debe
    // poder pulsar "Incidencia" sobre ellos ahí mismo para registrar el
    // motivo (flujo pedido: 1. forzar fase → 2. registrar incidencia del
    // artículo faltante). Si se forzó el CICLO COMPLETO ('all') sí se
    // cierra, porque ahí no queda nada más por hacer en ese modal.
    if (phase === 'all') setOpenModal(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ── Registrar incidencia (artículo perdido/mantenimiento) ──
   * Se guarda a nivel de EVENTO (op.lostItems), no por fase: así el
   * artículo queda excluido de "pendiente" automáticamente en todas las
   * fases siguientes sin necesidad de volver a reportarlo. */
  const registerIncident = (item, state, reason) => {
    const { eventId, phaseKey, ...itemData } = item
    updateOp(eventId, op => {
      if ((op.lostItems || []).some(li => li.id === itemData.id)) return op // ya registrado
      const newLost = [...(op.lostItems || []), {
        ...itemData,
        state,
        reason,
        reportedAt: new Date().toISOString(),
        phaseKey, // fase en la que se detectó/reportó la pérdida
      }]
      const phase = op.phases[phaseKey]
      const done = phase.scanned.length + newLost.length >= op.totalItems
      return {
        ...op,
        lostItems: newLost,
        phases: { ...op.phases, [phaseKey]: { ...phase, done } }
      }
    })
    // Simular notificación
    showSnack(`Incidencia registrada: ${item.name} → ${state}. Notificación enviada.`, 'warning')
    setOpenIncident(false)
    setIncidentItem(null)
  }

  /* ── Determinar qué fase debe mostrarse como activa/siguiente ── */
  const getNextPhase = (op) => {
    for (const ph of PHASES) {
      if (!op.phases[ph.key].done) return ph.key
    }
    return null
  }

  /* ── Clasificar eventos por fecha/estado — En curso / Próximos ──
   * Ya NO depende de que alguien pulse "Iniciar": cualquier evento cuya
   * fecha ya llegó (hoy o antes) y que no esté Cancelado/Realizado/
   * Concluido cae en "En curso" automáticamente. "Próximos" son los que
   * todavía no llegan a su fecha — el mismo evento pasa solo de una lista
   * a la otra apenas cambia el día calendario, sin ninguna acción manual
   * ni que se pierda si se recarga la página (se recalcula siempre desde
   * ev.date/ev.status, no se guarda como un estado aparte). */
  const activeEvents = events
    .filter(ev => isOpenStatus(ev.status) && (!ev.date || ev.date <= todayStr()))
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
  const upcomingEvents = events
    .filter(ev => isOpenStatus(ev.status) && ev.date && ev.date > todayStr())
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
  const filteredEvents = filter === 'upcoming' ? upcomingEvents : activeEvents

  /* ── Mismo criterio para arriendos (sección Rental) ── */
  const activeRentals = rentals
    .filter(r => isOpenStatus(r.status) && (!r.date || r.date <= todayStr()))
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
  const upcomingRentals = rentals
    .filter(r => isOpenStatus(r.status) && r.date && r.date > todayStr())
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''))

  /* ── Render de una card de evento ── */
  const EventCard = ({ ev }) => {
    const op = getOrInitOp(ev)
    const progress = calcProgress(op)
    const nextPhase = getNextPhase(op)
    const isDone = ev.status === 'Realizado' || ev.status === 'Concluido'
    const isCancelled = ev.status === 'Cancelado'
    const totalItems = op.totalItems
    const hasIncidents = (op.lostItems || []).length > 0

    return (
      <Paper sx={{ p: 2, mb: 2, border: '1px solid', borderColor: isCancelled ? 'error.dark' : isDone ? 'success.dark' : hasIncidents ? 'warning.dark' : 'divider', opacity: (isDone || isCancelled) ? 0.85 : 1 }}>

        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Typography variant="body1" fontWeight={600}>{ev.name}</Typography>
              <Chip label={ev.orderNumber} size="small" color="primary" variant="outlined" sx={{ fontSize: 10 }} />
              <Chip
                label={ev.status}
                size="small"
                color={isCancelled ? 'error' : isDone ? 'success' : ev.status === 'En curso' ? 'warning' : 'default'}
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
            {!isDone && !isCancelled && nextPhase && (
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
            {role === 'admin' && !isDone && !isCancelled && (
              <Tooltip title="Forzar cierre del ciclo completo (admin)">
                <IconButton size="small" color="error" onClick={() => { setForceTarget({ eventId: ev.id, phase: 'all' }); forceTargetRef.current = { eventId: ev.id, phase: 'all' }; setOpenForce(true) }}>
                  <AdminPanelSettingsIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </Box>

        {isCancelled && (
          <Alert severity="error" sx={{ mb: 1.5 }}>
            Motivo de cancelación: {ev.cancelReason || 'Sin motivo especificado'}
            {ev.cancelledBy ? ` — ${ev.cancelledBy}` : ''}
          </Alert>
        )}

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
                {(op.lostItems || []).some(li => li.phaseKey === ph.key) && ' ⚠'}
              </Box>
            )
          })}
        </Box>

        {/* Detalle por fase */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8 }}>
          {PHASES.map(ph => {
            const phState = op.phases[ph.key]
            // Para el % de avance se cuentan TODOS los artículos perdidos
            // (de cualquier fase) — ya nunca se van a escanear. Para el
            // chip "X inc." solo se muestran los detectados EN esta fase.
            const lostInThisPhase = (op.lostItems || []).filter(li => li.phaseKey === ph.key).length
            const phasePct = calcPhaseProgress(phState, totalItems, (op.lostItems || []).length)
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
                {lostInThisPhase > 0 && (
                  <Chip label={`${lostInThisPhase} inc.`} size="small" color="warning" sx={{ fontSize: 10, height: 18 }} />
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
          <Button
            size="small"
            variant={filter === 'active' ? 'contained' : 'outlined'}
            color="success"
            onClick={() => setFilter('active')}
            sx={{ fontSize: 12 }}
          >
            En curso ({activeEvents.length})
          </Button>
          <Button
            size="small"
            variant={filter === 'upcoming' ? 'contained' : 'outlined'}
            onClick={() => setFilter('upcoming')}
            sx={{ fontSize: 12 }}
          >
            Próximos ({upcomingEvents.length})
          </Button>
          <Button
            size="small"
            variant={filter === 'all' ? 'contained' : 'outlined'}
            onClick={() => setFilter('all')}
            sx={{ fontSize: 12 }}
          >
            Todos
          </Button>
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

      {/* ── Eventos: En curso / Próximos ── */}
      {(filter === 'active' || filter === 'upcoming') && (
        filteredEvents.length === 0 ? (
          <Paper sx={{ p: 4, textAlign: 'center', mb: 2 }}>
            <EventIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
            <Typography color="text.secondary">
              {filter === 'upcoming' ? 'No hay eventos próximos.' : 'No hay eventos en curso.'}
            </Typography>
          </Paper>
        ) : (
          filteredEvents.map(ev => <EventCard key={ev.id} ev={ev} />)
        )
      )}

      {/* ── Eventos: Todos (con filtros y agrupado por fecha) ── */}
      {filter === 'all' && (
        <TodosPanel
          items={events}
          getId={ev => ev.id}
          getOrderNumber={ev => ev.orderNumber}
          getName={ev => ev.name}
          getDate={ev => ev.date}
          getStatus={ev => ev.status}
          hasIncidents={ev => ((opStates[ev.id]?.lostItems) || []).length > 0}
          renderCard={ev => <EventCard ev={ev} />}
          emptyLabel="No hay eventos registrados."
        />
      )}

      {/* ── Rental: En curso / Próximos / Todos ── */}
      {filter === 'rental' && (
        <Box>
          <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
            {[
              { key: 'active', label: `En curso (${activeRentals.length})` },
              { key: 'upcoming', label: `Próximos (${upcomingRentals.length})` },
              { key: 'all', label: 'Todos' },
            ].map(f => (
              <Button
                key={f.key}
                size="small"
                variant={rentalFilter === f.key ? 'contained' : 'outlined'}
                onClick={() => setRentalFilter(f.key)}
                sx={{
                  fontSize: 12,
                  bgcolor: rentalFilter === f.key ? '#EF9F27' : 'transparent',
                  borderColor: '#EF9F27',
                  color: rentalFilter === f.key ? '#000' : '#EF9F27',
                  '&:hover': { bgcolor: '#EF9F2733', borderColor: '#EF9F27' }
                }}
              >
                {f.label}
              </Button>
            ))}
          </Box>

          {rentalFilter === 'all' ? (
            <TodosPanel
              items={rentals}
              getId={r => r.id}
              getOrderNumber={r => r.orderNumber}
              getName={r => r.name}
              getDate={r => r.date}
              getStatus={r => r.status}
              hasIncidents={() => false}
              hideIncidentChip
              renderCard={r => <RentalCard rental={r} />}
              emptyLabel="No hay arriendos registrados."
              accentColor="#EF9F27"
            />
          ) : (
            (rentalFilter === 'upcoming' ? upcomingRentals : activeRentals).length === 0 ? (
              <Paper sx={{ p: 6, textAlign: 'center' }}>
                <HandshakeIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                <Typography color="text.secondary">
                  {rentalFilter === 'upcoming' ? 'No hay arriendos próximos.' : 'No hay arriendos en curso.'}
                </Typography>
              </Paper>
            ) : (
              (rentalFilter === 'upcoming' ? upcomingRentals : activeRentals).map(r => <RentalCard key={r.id} rental={r} />)
            )
          )}
        </Box>
      )}

      <OpModalExternal
        open={openModal}
        activeModal={activeModal}
        events={events}
        opStates={opStates}
        products={products}
        role={role}
        onClose={() => setOpenModal(false)}
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
      <IncidentDialogExternal
        open={openIncident}
        item={incidentItem}
        onClose={() => setOpenIncident(false)}
        onConfirm={registerIncident}
      />

      <Snackbar
        open={snack.open} autoHideDuration={snack.action ? 8000 : 4000}
        onClose={() => setSnack(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          severity={snack.severity}
          onClose={() => setSnack(s => ({ ...s, open: false }))}
          action={snack.action && (
            <Button color="inherit" size="small" onClick={() => { snack.action.onClick(); setSnack(s => ({ ...s, open: false })) }}>
              {snack.action.label}
            </Button>
          )}
        >
          {snack.msg}
        </Alert>
      </Snackbar>
    </Box>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
 * TodosPanel — pestaña "Todos", compartida entre eventos y arriendos.
 *
 * Sin ningún filtro activo: agrupa por fecha exacta (más reciente primero),
 * de forma desplegable — el grupo más reciente abierto por defecto, el
 * resto colapsado. Cada encabezado de grupo muestra día + fecha + semana +
 * mes (formatGroupHeader).
 *
 * Con búsqueda / filtro de fecha (día·semana·mes) / chips de estado
 * activos: se muestra una lista plana, ordenada de más reciente a más
 * antigua, sin agrupar.
 *
 * `getStatus`/`hasIncidents` alimentan los 3 chips de estado (Cancelados,
 * Con incidencia, Realizados) — si hay uno o más chips activos, un ítem se
 * muestra si calza con AL MENOS UNO de los chips activos (filtro OR).
 * ═══════════════════════════════════════════════════════════════════════════ */
function TodosPanel({
  items, getId, getOrderNumber, getName, getDate, getStatus, hasIncidents,
  renderCard, emptyLabel, hideIncidentChip, accentColor = '#639922'
}) {
  const [search, setSearch] = React.useState('')
  const [dateScope, setDateScope] = React.useState('none') // none|day|week|month
  const [dateValue, setDateValue] = React.useState('')
  const [statusChips, setStatusChips] = React.useState(() => new Set())
  // Ver nota sobre openedGroups/closedGroups en el toggle de abajo.
  const [openedGroups, setOpenedGroups] = React.useState(() => new Set())
  const [closedGroups, setClosedGroups] = React.useState(() => new Set())

  const toggleChip = (key) => {
    setStatusChips(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const setScope = (scope) => {
    setDateScope(scope)
    if (scope === 'day') setDateValue(todayStr())
    else if (scope === 'week') setDateValue(isoWeekKey(todayStr()))
    else if (scope === 'month') setDateValue(monthOf(todayStr()))
    else setDateValue('')
  }

  const clearFilters = () => { setSearch(''); setScope('none'); setStatusChips(new Set()) }

  const matchesSearch = (it) => {
    if (!search.trim()) return true
    const q = search.trim().toLowerCase()
    return (getOrderNumber(it) || '').toLowerCase().includes(q) || (getName(it) || '').toLowerCase().includes(q)
  }
  const matchesDate = (it) => {
    const d = getDate(it)
    if (dateScope === 'day') return d === dateValue
    if (dateScope === 'week') return isoWeekKey(d) === dateValue
    if (dateScope === 'month') return monthOf(d) === dateValue
    return true
  }
  const matchesStatusChips = (it) => {
    if (statusChips.size === 0) return true
    const status = getStatus(it)
    return (
      (statusChips.has('cancelado') && isCancelledStatus(status)) ||
      (statusChips.has('incidencia') && hasIncidents(it)) ||
      (statusChips.has('realizado') && isFinishedStatus(status))
    )
  }

  const filtered = items.filter(it => matchesSearch(it) && matchesDate(it) && matchesStatusChips(it))
  const sorted = [...filtered].sort((a, b) => (getDate(b) || '').localeCompare(getDate(a) || ''))
  const noFiltersActive = !search.trim() && dateScope === 'none' && statusChips.size === 0

  // Agrupado por fecha exacta (solo cuando no hay filtros activos).
  const grouped = {}
  if (noFiltersActive) {
    sorted.forEach(it => {
      const key = getDate(it) || 'Sin fecha'
      if (!grouped[key]) grouped[key] = []
      grouped[key].push(it)
    })
  }
  const groupKeys = Object.keys(grouped).sort((a, b) => b.localeCompare(a))

  // El primer grupo (más reciente) está abierto por defecto salvo que el
  // usuario lo haya cerrado a propósito; el resto arranca cerrado salvo que
  // el usuario lo haya abierto a propósito. Dos sets separados para no
  // pisar ese comportamiento por defecto apenas se toca cualquier otro grupo.
  const isGroupOpen = (key, idx) => idx === 0 ? !closedGroups.has(key) : openedGroups.has(key)
  const toggleGroup = (key, idx) => {
    if (idx === 0) {
      setClosedGroups(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n })
    } else {
      setOpenedGroups(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n })
    }
  }

  const chipDefs = [
    { key: 'cancelado', label: 'Cancelados', color: 'error' },
    ...(hideIncidentChip ? [] : [{ key: 'incidencia', label: 'Con incidencia', color: 'warning' }]),
    { key: 'realizado', label: 'Realizados', color: 'success' },
  ]

  return (
    <Box>
      <Paper sx={{ p: 1.5, mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          <TextField
            size="small" placeholder="Buscar por N° o nombre…"
            value={search} onChange={e => setSearch(e.target.value)}
            sx={{ minWidth: 220 }}
            InputProps={{ startAdornment: <SearchIcon fontSize="small" sx={{ mr: 0.5, color: 'text.secondary' }} /> }}
          />
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {[{ key: 'none', label: 'Sin filtro' }, { key: 'day', label: 'Día' }, { key: 'week', label: 'Semana' }, { key: 'month', label: 'Mes' }].map(s => (
              <Button key={s.key} size="small"
                variant={dateScope === s.key ? 'contained' : 'outlined'}
                onClick={() => setScope(s.key)}
                sx={{ fontSize: 11 }}
              >
                {s.label}
              </Button>
            ))}
          </Box>
          {dateScope === 'day' && (
            <TextField size="small" type="date" value={dateValue} onChange={e => setDateValue(e.target.value)} />
          )}
          {dateScope === 'week' && (
            <TextField size="small" type="week" value={dateValue} onChange={e => setDateValue(e.target.value)} />
          )}
          {dateScope === 'month' && (
            <TextField size="small" type="month" value={dateValue} onChange={e => setDateValue(e.target.value)} />
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 1, mt: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
          {chipDefs.map(c => (
            <Chip
              key={c.key}
              label={c.label}
              size="small"
              clickable
              color={statusChips.has(c.key) ? c.color : 'default'}
              variant={statusChips.has(c.key) ? 'filled' : 'outlined'}
              onClick={() => toggleChip(c.key)}
            />
          ))}
          {!noFiltersActive && (
            <Button size="small" startIcon={<FilterAltOffIcon sx={{ fontSize: 14 }} />} onClick={clearFilters} sx={{ fontSize: 11 }}>
              Limpiar filtros
            </Button>
          )}
        </Box>
      </Paper>

      {sorted.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">
            {noFiltersActive ? emptyLabel : 'Nada calza con estos filtros.'}
          </Typography>
        </Paper>
      ) : noFiltersActive ? (
        groupKeys.map((key, idx) => {
          const open = isGroupOpen(key, idx)
          return (
            <Paper key={key} sx={{ mb: 1.5, overflow: 'hidden' }}>
              <Box
                onClick={() => toggleGroup(key, idx)}
                sx={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  p: 1.5, cursor: 'pointer', bgcolor: 'action.hover'
                }}
              >
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  {key === 'Sin fecha' ? key : formatGroupHeader(key)}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Chip label={grouped[key].length} size="small" sx={{ bgcolor: `${accentColor}20`, color: accentColor, fontWeight: 700 }} />
                  {open ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                </Box>
              </Box>
              <Collapse in={open}>
                <Box sx={{ p: 1.5, pt: 1.5 }}>
                  {grouped[key].map(it => <Box key={getId(it)} sx={{ '&:not(:first-of-type)': { mt: 0 } }}>{renderCard(it)}</Box>)}
                </Box>
              </Collapse>
            </Paper>
          )
        })
      ) : (
        sorted.map(it => <Box key={getId(it)}>{renderCard(it)}</Box>)
      )}
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
 *  1) ROJO        : el tag no existe / no está registrado en el sistema
 *                   → pide registrarlo. Llega como 'rfid_unknown' del bridge.
 *  2) AZUL+blanco : el tag SÍ existe/está registrado, pero su SKU no
 *                   corresponde a esta operación.
 *  3) VERDE       : el tag pertenece a esta operación y queda registrado
 *                   correctamente (si además completa la fase, se suma el
 *                   modal "Elementos pasados").
 * (Aparte, hay un aviso menor de "ya escaneado" para no duplicar conteos —
 * no es uno de los 3 estados pedidos, solo evita doble registro.)
 *
 * `products` se usa únicamente para el caso AZUL: cuando el tag escaneado
 * no pertenece a esta operación, igual se busca a qué producto SÍ
 * corresponde (por el ID de unidad que resolvió el bridge) para poder
 * mostrarle al bodeguero el SKU, nombre y tag exactos — así sabe de
 * inmediato qué es lo que pasó por la antena, en vez de un aviso genérico.
 * ═══════════════════════════════════════════════════════════════════════════ */
function useRfidScanMatcher({ open, allItems, isAlreadyHandled, onValidScan, notBelongMsg, allowSkuFallback = true, products = [] }) {
  const { lastScan, unknownTags, clearLastScan, keyboardLastReadAt } = useRfidSocket()
  const [scanAlert, setScanAlert] = React.useState(null) // { severity, tone, msg }

  // ── Presencia REAL de antena o lector, no solo si el bridge está vivo ──
  // Antes este chip usaba "isConnected" del socket, que solo dice si el
  // software (bridge) está corriendo — no si hay una antena o el lector USB
  // físicamente conectados (mismo problema ya corregido en Registrar RFID).
  // Ni las antenas (UDP, sin heartbeat) ni el lector USB en modo teclado
  // avisan al desconectarse, así que se usa la misma aproximación: lista
  // real de antenas (/api/antennas) + recencia de lectura del lector.
  const PRESENCE_TIMEOUT_MS = 90000
  const [antennaCount, setAntennaCount] = React.useState(0)
  const [, forceTick] = React.useState(0)
  React.useEffect(() => {
    if (!open) return
    const fetchAntennas = async () => {
      try {
        const res = await fetch('http://localhost:3002/api/antennas')
        const data = await res.json()
        setAntennaCount(Array.isArray(data.antennas) ? data.antennas.length : 0)
      } catch (e) { }
    }
    fetchAntennas()
    const interval = setInterval(fetchAntennas, 2000)
    const tick = setInterval(() => forceTick(v => v + 1), 2000)
    return () => { clearInterval(interval); clearInterval(tick) }
  }, [open])
  const keyboardPresent = !!keyboardLastReadAt && (Date.now() - keyboardLastReadAt) < PRESENCE_TIMEOUT_MS
  const isConnected = antennaCount > 0 || keyboardPresent
  const lastUnknownRef = React.useRef(null)
  const lastSeenScanRef = React.useRef(null) // huella (epc+timestamp) del último lastScan ya "visto" al abrir
  // OJO: wasOpenRef arranca SIEMPRE en false (no en `open`). Este modal se
  // monta directamente con open=true (el padre solo lo renderiza cuando ya
  // está abierto), así que la transición cerrado→abierto NUNCA ocurre dentro
  // de este componente — si inicializáramos wasOpenRef con `open`, el efecto
  // de abajo nunca tomaría línea base en el primer render y cualquier scan
  // viejo que ya estuviera en el socket compartido (de otra pantalla, de
  // antes de abrir este modal) se trataría como nuevo. Arrancando en false,
  // el primer render SIEMPRE cuenta como "se acaba de abrir" y se toma la
  // línea base correctamente.
  const wasOpenRef = React.useRef(false)

  // Auto-ocultar la alerta luego de unos segundos
  React.useEffect(() => {
    if (!scanAlert) return
    const t = setTimeout(() => setScanAlert(null), 5000)
    return () => clearTimeout(t)
  }, [scanAlert])

  // BUG FIX: useRfidSocket ahora comparte UNA sola conexión para toda la
  // app (ver RfidSocketContext), así que `unknownTags` y `lastScan` pueden
  // traer arrastrado un EPC de ANTES de abrir este modal — de otra pantalla,
  // de una simulación anterior en la misma sesión, etc. Sin esto, al abrir
  // el modal los efectos de abajo creen que ese EPC/scan viejo es "nuevo" y
  // disparan la alerta de "Tag no registrado" (o "Registrado
  // correctamente") sin que el usuario haya pasado nada. Por eso, en el
  // primer render (y en cualquier transición cerrado→abierto) tomamos como
  // línea base lo que YA existía, para que solo se avise de lo que llegue
  // de ahora en adelante.
  React.useEffect(() => {
    if (open && !wasOpenRef.current) {
      lastUnknownRef.current = unknownTags && unknownTags.length > 0
        ? unknownTags[unknownTags.length - 1]
        : null
      lastSeenScanRef.current = lastScan ? `${lastScan.epc}-${lastScan.timestamp}` : null
    }
    wasOpenRef.current = open
  }, [open, unknownTags, lastScan])

  // ── 1) ROJO: tag no registrado ──
  React.useEffect(() => {
    if (!open || !unknownTags || unknownTags.length === 0) return
    const epc = unknownTags[unknownTags.length - 1]
    if (lastUnknownRef.current === epc) return
    lastUnknownRef.current = epc
    setScanAlert({
      severity: 'error',
      tone: 'red',
      msg: 'Tag no registrado',
      detail: { sku: null, name: null, tag: epc }
    })
  }, [unknownTags, open])

  // ── Tag resuelto por el bridge (lastScan.sku = unitId) ──
  React.useEffect(() => {
    if (!lastScan || !open) return
    const scanKey = `${lastScan.epc}-${lastScan.timestamp}`
    if (lastSeenScanRef.current === scanKey) return // ya estaba ahí cuando se abrió este modal
    lastSeenScanRef.current = scanKey
    const unitId = lastScan.sku

    // 1) Coincidencia exacta con una unidad preasignada (o, en fases
    //    posteriores a F1, con el tag FÍSICO real que ya quedó asignado) —
    //    camino normal.
    let item = allItems.find(it => it.id === unitId)
    let quotaFull = false

    // 2) Si no coincide exactamente, puede ser el MISMO producto pero una
    //    unidad física distinta (dos micrófonos iguales, se tomó el tag
    //    equivocado por error). Esto SOLO se permite mientras todavía no se
    //    ha fijado qué unidad física específica corresponde a este cupo —
    //    es decir, únicamente en la fase donde el artículo sale por primera
    //    vez de bodega (F1 en eventos y arriendos). Una vez que esa unidad
    //    salió con un tag concreto, las fases siguientes deben exigir ESE
    //    MISMO tag — de lo contrario se podría dar por recibido/devuelto un
    //    artículo que en realidad nunca salió, mientras el que sí salió
    //    queda sin rastro.
    if (!item && allowSkuFallback) {
      const productId = Number(String(unitId).split('-')[0])
      const productItems = allItems.filter(it => it.productId === productId)
      if (productItems.length > 0) {
        item = productItems.find(it => !isAlreadyHandled(it))
        if (!item) quotaFull = true // el producto es correcto, pero ya no quedan cupos libres de él
      }
    }

    // ── 2) AZUL con letra blanca: existe pero el SKU no corresponde a esta
    // operación ── Se busca a qué producto pertenece el tag escaneado (aunque
    // no sea de esta operación) para poder mostrar su SKU/nombre real — el
    // bodeguero necesita saber DE INMEDIATO qué pasó por la antena, no solo
    // que "algo" no correspondía.
    if (!item) {
      const productId = Number(String(unitId).split('-')[0])
      const scannedProduct = products.find(p => p.id === productId)
      setScanAlert({
        severity: 'info', tone: 'doesntBelong',
        msg: quotaFull ? 'Este SKU ya completó su cupo en esta fase' : 'Este SKU no corresponde a esta operación',
        detail: { sku: scannedProduct?.sku || '—', name: scannedProduct?.name || 'Producto no identificado', tag: lastScan.epc },
        extra: quotaFull
          ? 'Ya se completaron todas las unidades de este producto en esta fase.'
          : (notBelongMsg || 'Este tag no pertenece a este evento')
      })
      clearLastScan()
      return
    }
    // Aviso menor (no es uno de los 3 estados pedidos): ya fue escaneado antes
    if (isAlreadyHandled(item)) {
      setScanAlert({
        severity: 'info', tone: 'alreadyScanned',
        msg: 'Este tag ya fue escaneado en esta fase',
        detail: { sku: item.sku, name: item.name, tag: item.realRfid || item.rfid || lastScan.epc }
      })
      clearLastScan()
      return
    }
    // Se registra con la identidad REAL del tag físico leído (realId/realRfid),
    // además de la del cupo — así las fases siguientes pueden exigir
    // exactamente este mismo tag en vez de aceptar cualquier gemelo del
    // mismo producto.
    item = { ...item, realId: unitId, realRfid: lastScan.epc }
    // ── 3) VERDE: pertenece y queda registrado correctamente ──
    onValidScan(item)
    setScanAlert({
      severity: 'success', tone: 'green',
      msg: 'Registrado correctamente',
      detail: { sku: item.sku, name: item.name, tag: item.realRfid }
    })
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

  const d = alert.detail
  return (
    <Fade in>
      <Alert severity={alert.severity} onClose={onClose} sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography component="span" variant="body2" fontWeight={600}>{alert.msg}</Typography>
          {d?.sku && (
            <Chip
              label={d.sku} size="small"
              color={alert.severity === 'success' ? 'success' : 'default'}
              sx={{ fontWeight: 800, fontSize: 13 }}
            />
          )}
          {d?.name && (
            <Typography component="span" variant="caption" color="text.secondary">{d.name}</Typography>
          )}
        </Box>
      </Alert>
    </Fade>
  )
}

/* ─── Modal grande: tag no registrado (ROJO) / SKU no corresponde a esta
 * operación (AZUL con letra blanca) ──────────────────── */
function ScanAlertModal({ alert, onClose }) {
  const isRed = alert.tone === 'red'
  const palette = isRed
    ? { titleBg: 'rgba(211,47,47,0.12)', titleColor: '#C62828', bodyBg: 'background.paper', textColor: 'text.primary', boxBg: 'rgba(211,47,47,0.08)', boxBorder: '#E57373', boxText: '#C62828' }
    : { titleBg: '#0D47A1', titleColor: '#FFFFFF', bodyBg: '#1565C0', textColor: '#FFFFFF', boxBg: 'rgba(255,255,255,0.14)', boxBorder: 'rgba(255,255,255,0.5)', boxText: '#FFFFFF' }
  const d = alert.detail

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        bgcolor: palette.titleBg, color: palette.titleColor
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {isRed ? <ErrorOutlineIcon /> : <WarningAmberIcon />}
          {isRed ? 'Tag no registrado' : 'SKU no corresponde a esta operación'}
        </Box>
        <IconButton size="small" onClick={onClose} sx={{ color: palette.titleColor }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ pt: 3, bgcolor: palette.bodyBg }}>
        <Typography variant="body1" fontWeight={600} sx={{ mb: 2, color: palette.textColor }}>
          {alert.msg}
        </Typography>
        {d && (
          <Box sx={{ p: 2, borderRadius: 1, bgcolor: palette.boxBg, border: `1px solid ${palette.boxBorder}`, mb: 1.5 }}>
            {d.sku && (
              <>
                <Typography variant="caption" sx={{ color: palette.boxText, opacity: 0.8, letterSpacing: 0.5 }}>SKU</Typography>
                <Typography variant="h5" fontWeight={800} sx={{ color: palette.boxText, lineHeight: 1.25, mb: 0.5 }}>{d.sku}</Typography>
              </>
            )}
            {d.name && (
              <Typography variant="body2" sx={{ color: palette.boxText, mb: 0.5 }}>{d.name}</Typography>
            )}
            <Typography variant="caption" sx={{ color: palette.boxText, opacity: 0.85, fontFamily: 'monospace', wordBreak: 'break-all' }}>
              Tag: {d.tag}
            </Typography>
          </Box>
        )}
        <Typography variant="body2" sx={{ color: palette.boxText }}>
          {isRed
            ? 'Este tag no está registrado en el sistema. Por favor, ve a "Registrar RFID" para registrarlo antes de continuar.'
            : (alert.extra || 'Verifica que estás escaneando el tag correcto para esta operación.')}
        </Typography>
      </DialogContent>
    </Dialog>
  )
}

/* ─── Modal "ticket": Elementos pasados (fase completada) ───────────────────
 * Detalla cada artículo que pasó (SKU, nombre, tag) — no solo el conteo —
 * para que el bodeguero pueda verificar rápido qué se registró. */
function CompletionTicketModal({ open, onClose, title, subtitle, items = [], color }) {
  const count = items.length
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
      <DialogContent dividers sx={{ pt: 3 }}>
        <Box sx={{ textAlign: 'center', mb: 2 }}>
          <CheckCircleIcon sx={{ fontSize: 48, color, mb: 1 }} />
          <Typography variant="h6" fontWeight={700}>{title}</Typography>
          {subtitle && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{subtitle}</Typography>
          )}
          <Typography variant="h4" fontWeight={800} sx={{ color, mt: 1 }}>
            {count} / {count}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Todos los tags pasaron por la antena correctamente.
          </Typography>
        </Box>
        <Divider sx={{ mb: 1.5 }} />
        <List dense disablePadding sx={{ maxHeight: 280, overflowY: 'auto' }}>
          {items.map((it, i) => (
            <ListItem key={i} sx={{ py: 0.7, px: 1, mb: 0.6, borderRadius: 1, bgcolor: 'action.hover' }}>
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip label={it.sku || '—'} size="small" sx={{ fontWeight: 800, fontSize: 12, color, bgcolor: `${color}20` }} />
                    <Typography variant="body2" fontWeight={600}>{it.name}</Typography>
                  </Box>
                }
                secondary={
                  <Typography component="span" variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
                    Tag: {it.tag || '—'}
                  </Typography>
                }
              />
            </ListItem>
          ))}
        </List>
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
  const navigate = useNavigate()
  const { products, closeRentalToHistory } = useInventory()
  const { role, currentUser: authUser } = useAuth()
  const roleLabel = authUser ? `${authUser.nombre} ${authUser.apellido}` : (role === 'admin' ? 'Administrador' : 'Operador')
  const [openModal, setOpenModal] = React.useState(false)
  const [phase, setPhase] = React.useState(null)
  const [snack, setSnack] = React.useState({ open: false, msg: '', severity: 'success', action: null })
  // scannedItems guarda los IDs de unidad ya escaneados por fase (no solo un contador)
  // para poder hacer matching real contra el tag leído por la antena.
  const [scannedItems, setScannedItems] = React.useState({ f1: [], f4: [] })
  // activePhase: misma idea de "gating" que en eventos — hay que pulsar
  // "Iniciar" antes de poder escanear esa fase, en vez de saltar directo
  // a los botones de fase.
  const [activePhase, setActivePhase] = React.useState(null)

  const totalItems = (rental.assignments || []).reduce((s, a) => s + a.qty, 0)
  const progress = rental.status === 'Concluido'
    ? { f1: 100, f4: 100 }
    : {
      f1: totalItems ? Math.min(Math.round((scannedItems.f1.length / totalItems) * 100), 100) : 0,
      f4: totalItems ? Math.min(Math.round((scannedItems.f4.length / totalItems) * 100), 100) : 0,
    }
  const phaseDone = (key) => totalItems > 0 && scannedItems[key].length >= totalItems
  // rental.status === 'Concluido' cubre el caso de un arriendo ya cerrado en
  // una sesión anterior: su progreso de escaneo (scannedItems) vive solo en
  // este componente y no se persiste, así que al volver a montarse (por
  // ejemplo al cambiar de pestaña En curso/Próximos/Todos) partiría de
  // cero — sin este chequeo, un arriendo ya archivado en el Historial
  // volvería a mostrar el botón "Iniciar" como si nada se hubiera hecho.
  const isDone = rental.status === 'Concluido' || (phaseDone('f1') && phaseDone('f4'))
  const nextPhase = RENTAL_PHASES.find(ph => !phaseDone(ph.key))?.key

  const openPhase = (ph) => { setPhase(ph); setOpenModal(true) }

  /* ── Cerrar arriendo: mover de Operaciones a Historial de Rentas ── */
  const finalizeRental = () => {
    closeRentalToHistory(rental, totalItems, roleLabel)
    setOpenModal(false)
    setSnack({
      open: true, severity: 'success', msg: 'Arriendo guardado en el Historial de Rentas.',
      action: {
        label: 'Ver detalle',
        onClick: () => navigate('/history', { state: { tab: 1, expandOrderNumber: rental?.orderNumber } })
      }
    })
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
          const done = phaseDone(ph.key) || isDone
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

      <Snackbar
        open={snack.open} autoHideDuration={snack.action ? 8000 : 4000}
        onClose={() => setSnack(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          severity={snack.severity}
          onClose={() => setSnack(s => ({ ...s, open: false }))}
          action={snack.action && (
            <Button color="inherit" size="small" onClick={() => { snack.action.onClick(); setSnack(s => ({ ...s, open: false })) }}>
              {snack.action.label}
            </Button>
          )}
        >
          {snack.msg}
        </Alert>
      </Snackbar>
    </Paper>
  )
}

/* ─── RentalPhaseModal ────────────────────────────────────────────────────── */
function RentalPhaseModal({ open, phase, rental, products, totalItems, scannedItems, setScannedItems, onClose, onFinalizeRental }) {
  const { markUnitBackFromRental } = useInventory()
  const phaseObj = RENTAL_PHASES.find(p => p.key === phase)

  // Cupos preasignados al crear el arriendo (por producto, no por tag físico
  // todavía) — es el pool del que F1 elige qué unidad concreta sale.
  const preassignedItems = (rental.assignments || []).flatMap(a => {
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
      productId: prod.id,
    }))
  })

  // F4 (vuelta a bodega) debe exigir el MISMO tag físico que realmente
  // salió en F1 — no cualquier gemelo del mismo producto — para que el
  // artículo que vuelve sea de verdad el que salió.
  // `slotId` viaja aparte: es la unidad preasignada original (la que pasó
  // de Disponible a Rental al crear el arriendo) — se necesita en F4 para
  // poder liberar ESA, ya que el tag real (id) puede ser un gemelo que
  // nunca quedó marcado en estado Rental.
  const f1RealItems = (scannedItems.f1 || []).map(s => ({
    id: s.realId || s.id, slotId: s.id, rfid: s.realRfid || s.rfid, name: s.name, sku: s.sku, productId: s.productId,
  }))
  const items = phase === 'f1' ? preassignedItems : f1RealItems

  const scannedList = (phase && scannedItems?.[phase]) || []
  const scannedIds = scannedList.map(s => s.id)
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
      if (list.some(s => s.id === item.id)) return prev
      return { ...prev, [phase]: [...list, item] }
    })
    // F1 "Salida de bodega": la unidad ya pasó a Rental al crear el arriendo.
    // F4 "Entrada a bodega": vuelve de Rental a Disponible — se libera el
    // slotId (la unidad que de verdad quedó en estado Rental), no el tag
    // real si fue un gemelo distinto el que se escaneó.
    if (phase === 'f4') markUnitBackFromRental(item.slotId || item.id)
  }

  // ── Conexión RFID real — escucha la antena igual que el modal de eventos ──
  const { isConnected, scanAlert, setScanAlert } = useRfidScanMatcher({
    open,
    allItems: items,
    isAlreadyHandled: (item) => scannedIds.includes(item.id),
    onValidScan: markScanned,
    notBelongMsg: phase === 'f1'
      ? 'Este tag no pertenece a este arriendo'
      : 'Este tag no es uno de los que salieron de bodega para este arriendo',
    allowSkuFallback: phase === 'f1',
    products
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
            label={isConnected ? '🟢 Antena/lector conectado' : '⚫ Sin antena ni lector conectado'}
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
            Pasa cada tag por la antena o el lector — se registra solo. Si ninguno está disponible, puedes marcar manualmente cada artículo abajo.
          </Typography>
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
        items={(scannedItems[phase] || []).map(s => ({ sku: s.sku, name: s.name, tag: s.realRfid || s.rfid }))}
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
  role,
  onClose, onCompletePhase, onFinalizeEvent,
  onManualScan, onForceOpen, onIncidentOpen, onUpdateOp
}) {
  if (!open || !activeModal) return null
  const { eventId, phase } = activeModal
  const ev = events.find(e => e.id === eventId)
  if (!ev) return null
  const op = opStates[eventId] || { phases: { f1: { scanned: [], done: false, incidents: [] }, f2: { scanned: [], done: false, incidents: [] }, f3: { scanned: [], done: false, incidents: [] }, f4: { scanned: [], done: false, incidents: [] } }, totalItems: 0, lostItems: [] }
  const phaseObj = PHASES.find(p => p.key === phase)
  const phState = op.phases[phase]

  // Cupos preasignados al crear el evento (por producto, no por tag físico
  // todavía) — es el pool del que F1 elige qué unidad concreta sale.
  const preassignedItems = (ev.assignments || []).flatMap(a => {
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

  // A partir de F2, los artículos "del evento" ya no son el pool genérico —
  // son EXACTAMENTE los tags físicos que quedaron confirmados al salir de
  // bodega en F1 (realId/realRfid). Así, si en F2/F3/F4 se pasa un tag
  // de un gemelo del mismo producto que nunca salió, no se acepta como si
  // fuera el que sí salió.
  // `slotId` viaja aparte: es el cupo preasignado original, el que
  // realmente quedó "Ocupado" en el inventario al salir en F1 — se
  // necesita en F4 para poder liberarlo (ver manualScanItem), ya que el
  // tag real (id) puede ser un gemelo que nunca quedó marcado Ocupado.
  const f1RealItems = op.phases.f1.scanned.map(s => ({
    id: s.realId || s.id, slotId: s.id, rfid: s.realRfid || s.rfid, name: s.name, sku: s.sku, productId: s.productId,
  }))
  const allItems = phase === 'f1' ? preassignedItems : f1RealItems

  const scannedIds = phState.scanned.map(s => s.id)
  // incidentIds vive a nivel de EVENTO (op.lostItems), no por fase — así un
  // artículo perdido en una fase anterior sigue excluido de "pendiente" acá.
  const incidentIds = (op.lostItems || []).map(i => i.id)
  const pendingItems = allItems.filter(i => !scannedIds.includes(i.id) && !incidentIds.includes(i.id))
  const phasePct = op.totalItems
    ? Math.min(Math.round(((phState.scanned.length + incidentIds.length) / op.totalItems) * 100), 100)
    : 0
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
    notBelongMsg: phase === 'f1'
      ? 'Este tag no pertenece a este evento'
      : 'Este tag no es uno de los que salieron de bodega para este evento',
    allowSkuFallback: phase === 'f1',
    products
  })

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ color: phaseObj.color }}>{phaseObj.icon}</Box>
          {phaseObj.label} — {ev.name}
          <Chip label={ev.orderNumber} size="small" color="primary" variant="outlined" sx={{ fontSize: 10, ml: 1 }} />
          <Chip
            label={isConnected ? '🟢 Antena/lector conectado' : '⚫ Sin antena ni lector conectado'}
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
              {incidentIds.length > 0 && ` · ${incidentIds.length} con incidencia`}
            </Typography>
            <Typography variant="body2" fontWeight={600} sx={{ color: phaseObj.color }}>{phasePct}%</Typography>
          </Box>
          <LinearProgress variant="determinate" value={phasePct}
            sx={{ height: 12, borderRadius: 6, '& .MuiLinearProgress-bar': { bgcolor: phaseObj.color } }} />
        </Box>
        {(op.lostItems || []).length > 0 && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            <Typography variant="caption" fontWeight={600}>Artículos con incidencia:</Typography>
            {(op.lostItems || []).map((inc, i) => (
              <Box key={i} sx={{ fontSize: 12 }}>• {inc.name} ({inc.rfid}) → <strong>{inc.state}</strong>: {inc.reason}</Box>
            ))}
          </Alert>
        )}
        {!phState.done && (
          <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>
              Pasa cada tag por la antena o el lector — se registra solo.
            </Typography>
            <Button variant="outlined" size="small" startIcon={<EditNoteIcon />}
              onClick={() => { onUpdateOp(eventId, op => ({ ...op, scanMode: 'manual' })) }}>
              Modo manual
            </Button>
            {role === 'admin' && (
              <Tooltip title="Forzar cierre de esta fase (admin)">
                <Button variant="outlined" size="small" color="error" startIcon={<LockIcon />}
                  onClick={() => onForceOpen(eventId, phase)}>
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
              const incident = (op.lostItems || []).find(i => i.id === item.id)
              return (
                <ListItem key={item.id} sx={{
                  py: 0.5, px: 1, mb: 0.3, borderRadius: 1,
                  bgcolor: scanned ? 'rgba(99,153,34,0.08)' : incident ? 'rgba(186,117,23,0.1)' : 'background.paper',
                  border: '1px solid', borderColor: scanned ? '#639922' : incident ? '#BA7517' : 'divider'
                }}
                  secondaryAction={!scanned && !incident && (
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      {!phState.done && op.scanMode === 'manual' && (
                        <Button size="small" variant="outlined" sx={{ fontSize: 10, py: 0.2 }}
                          onClick={() => onManualScan(eventId, phase, item)}>Marcar</Button>
                      )}
                      {/* El botón Incidencia queda visible AUNQUE la fase ya
                          esté forzada/cerrada (phState.done) — así, tras
                          "Forzar fase", el usuario todavía puede registrar
                          el motivo del artículo faltante (flujo: 1. forzar
                          fase → 2. registrar incidencia). */}
                      <Button size="small" color="warning" variant="outlined" sx={{ fontSize: 10, py: 0.2 }}
                        onClick={() => onIncidentOpen({ ...item, eventId, phaseKey: phase })}>
                        Incidencia
                      </Button>
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
            disabled={pendingItems.length > 0}
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
        items={phState.scanned.map(s => ({ sku: s.sku, name: s.name, tag: s.realRfid || s.rfid }))}
        color={phaseObj.color}
      />
      <CloseOperationModal
        open={showCloseModal}
        kind="event"
        summary={{
          orderNumber: ev.orderNumber,
          name: ev.name,
          totalItems: op.totalItems,
          incidentsCount: (op.lostItems || []).length
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
 * IncidentDialogExternal — componente EXTERNO al padre, mismo patrón que
 * ForceDialogExternal. Antes "Registrar incidencia" era un componente
 * inline redefinido en cada render de Operations, así que React lo
 * remontaba (perdiendo el foco del textarea) en CADA tecleo — por eso el
 * motivo solo dejaba escribir un carácter. Acá el estado y motivo viven
 * LOCALES a este componente y solo suben al padre al confirmar.
 * ═══════════════════════════════════════════════════════════════════════════ */
const IncidentDialogExternal = React.memo(function IncidentDialogExternal({ open, item, onClose, onConfirm }) {
  const [state, setState] = React.useState('Perdido')
  const [reason, setReason] = React.useState('')

  // Limpiar al cerrar
  React.useEffect(() => {
    if (!open) { setState('Perdido'); setReason('') }
  }, [open])

  const handleConfirm = () => {
    onConfirm(item, state, reason)
    setState('Perdido')
    setReason('')
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ color: 'warning.main', display: 'flex', alignItems: 'center', gap: 1 }}>
        <WarningAmberIcon /> Registrar incidencia
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
        {item && (
          <Alert severity="info" sx={{ py: 0.5 }}>
            <Typography variant="caption"><strong>{item.name}</strong> · {item.rfid}</Typography>
          </Alert>
        )}
        <TextField
          select label="Estado del artículo" value={state}
          onChange={e => setState(e.target.value)}
          SelectProps={{ native: true }}
        >
          <option value="Perdido">Perdido</option>
          <option value="En Mantenimiento">En Mantenimiento</option>
        </TextField>
        <TextField
          fullWidth label="Descripción de la incidencia" multiline minRows={2}
          value={reason} onChange={e => setReason(e.target.value)}
          placeholder="Ej: No se encontró al cargar el camión..."
          autoFocus
        />
        <Alert severity="warning" sx={{ py: 0.5 }}>
          Se enviará notificación automática vía WhatsApp y correo electrónico.
        </Alert>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="contained" color="warning" disabled={!reason.trim()} onClick={handleConfirm}>
          Registrar y notificar
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
