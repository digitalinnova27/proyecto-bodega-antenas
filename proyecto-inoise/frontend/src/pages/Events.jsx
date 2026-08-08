import React from 'react'
import {
  Box, Typography, Paper, List, ListItem, ListItemText,
  Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, Divider, Chip, CircularProgress,
  InputAdornment, Tooltip, Alert, Snackbar
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf'
import AddIcon from '@mui/icons-material/Add'
import EventIcon from '@mui/icons-material/Event'
import PlaceIcon from '@mui/icons-material/Place'
import DeleteIcon from '@mui/icons-material/Delete'
import WhatsAppIcon from '@mui/icons-material/WhatsApp'
import EmailIcon from '@mui/icons-material/Email'
import { useAuth } from '../context/AuthContext'
import { useInventory } from '../context/InventoryContext'
import { generateEventPDF } from '../utils/generatePDF'
import { api } from '../lib/api'

const CATEGORIES = ['Audio', 'Iluminacion', 'Pantalla', 'Efectos', 'Estructuras', 'Energía', 'Tecnologia', 'Otros']

const STATUS_COLORS = {
  Programado: 'primary',
  Confirmado: 'success',
  Suspendido: 'error',
  Realizado: 'default',
  Concluido: 'success',
  Cancelado: 'error'
}

const ASSIGN_PAGE_SIZE = 10

const todayStr = () => new Date().toISOString().slice(0, 10)

// "2026-08-09" → "2026-W32" (semana ISO, lunes a domingo) — mismo cálculo
// que se usa en Operations.jsx para el filtro "Todos".
const isoWeekKey = (dateStr) => {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  if (isNaN(d)) return ''
  const target = new Date(d.valueOf())
  const dayNr = (d.getDay() + 6) % 7
  target.setDate(target.getDate() - dayNr + 3)
  const firstThursday = new Date(target.getFullYear(), 0, 4)
  const diff = target - firstThursday
  const week = 1 + Math.round(diff / (7 * 24 * 3600 * 1000))
  return `${target.getFullYear()}-W${String(week).padStart(2, '0')}`
}

const yearOf = (dateStr) => (dateStr ? String(dateStr).slice(0, 4) : '')

const SUMMARY_STATUS_ORDER = ['Programado', 'Confirmado', 'En curso', 'Realizado', 'Concluido', 'Cancelado', 'Suspendido']

const AssignPanel = React.memo(function AssignPanel({
  products, assignSkuSearch, setAssignSkuSearch,
  assignCategory, setAssignCategory,
  assignPage, setAssignPage,
  assignmentsDraft, totalAssigned,
  availableForDraft, physicalAvailableForDraft, setQty
}) {
  const filtered = products.filter(p =>
    (!assignCategory || p.category === assignCategory) &&
    (!assignSkuSearch ||
      p.sku.toLowerCase().includes(assignSkuSearch.toLowerCase()) ||
      p.name.toLowerCase().includes(assignSkuSearch.toLowerCase()))
  )
  const totalPages = Math.ceil(filtered.length / ASSIGN_PAGE_SIZE)
  const paginated = filtered.slice(assignPage * ASSIGN_PAGE_SIZE, (assignPage + 1) * ASSIGN_PAGE_SIZE)
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <TextField
        label="Buscar SKU o nombre" size="small"
        value={assignSkuSearch}
        onChange={e => { setAssignSkuSearch(e.target.value); setAssignPage(0) }}
        placeholder="ej: AUD-001 o micrófono"
        autoComplete="off"
      />
      <TextField select label="Filtrar categoría" size="small" value={assignCategory}
        onChange={e => { setAssignCategory(e.target.value); setAssignPage(0) }}>
        <MenuItem value="">Todas las categorías</MenuItem>
        {CATEGORIES.map(cat => <MenuItem key={cat} value={cat}>{cat}</MenuItem>)}
      </TextField>
      {totalAssigned > 0 && (
        <Alert severity="info" sx={{ py: 0.5, fontSize: 12 }}>
          {totalAssigned} artículo{totalAssigned !== 1 ? 's' : ''} seleccionado{totalAssigned !== 1 ? 's' : ''}
        </Alert>
      )}
      {paginated.map(p => {
        // maxAvail = solo unidades CON tag vinculado — es lo único que
        // se puede asignar a un evento (así no se crean eventos con
        // equipos "fantasma" que luego no se pueden rastrear por RFID).
        const maxAvail = availableForDraft(p)
        const physicalAvail = physicalAvailableForDraft ? physicalAvailableForDraft(p) : maxAvail
        const unlinkedCount = Math.max(physicalAvail - maxAvail, 0)
        const current = assignmentsDraft.find(a => a.productId === p.id)?.qty || 0
        const noStock = (p.total || 0) === 0
        return (
          <Box key={p.id} sx={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            p: 1.5, borderRadius: 1, opacity: noStock ? 0.5 : 1,
            backgroundColor: current > 0 ? 'rgba(102,252,241,0.06)' : 'background.paper',
            border: '1px solid', borderColor: current > 0 ? 'primary.main' : 'divider'
          }}>
            <Box>
              <Typography variant="body2" fontWeight={current > 0 ? 600 : 400}>{p.name}</Typography>
              <Typography variant="caption" color="text.secondary">
                {p.sku} · {p.category} ·{' '}
                {noStock ? (
                  <span style={{ color: '#f44336', fontWeight: 600 }}>Sin stock</span>
                ) : (
                  <span style={{ color: maxAvail === 0 ? '#f44336' : '#3DDC84', fontWeight: 600 }}>
                    {maxAvail} disponible{maxAvail !== 1 ? 's' : ''} con tag
                  </span>
                )}
                {!noStock && unlinkedCount > 0 && (
                  <span style={{ color: '#f44336' }}> · {unlinkedCount} sin tag (no asignable{unlinkedCount !== 1 ? 's' : ''})</span>
                )}
              </Typography>
            </Box>
            <TextField type="number" size="small" sx={{ width: 80 }}
              inputProps={{ min: 0, max: maxAvail }} value={current}
              disabled={noStock || (maxAvail === 0 && current === 0)}
              onChange={e => setQty(p.id, Number(e.target.value))} />
          </Box>
        )
      })}
      {totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1, mt: 1 }}>
          <button onClick={() => setAssignPage(p => Math.max(0, p - 1))} disabled={assignPage === 0}
            style={{ background: 'none', border: '1px solid rgba(102,252,241,0.3)', color: '#66FCF1', borderRadius: 4, padding: '2px 10px', cursor: assignPage === 0 ? 'not-allowed' : 'pointer', opacity: assignPage === 0 ? 0.4 : 1 }}>&#8249;</button>
          <span style={{ fontSize: 12, color: '#C5C6C7' }}>{assignPage + 1} / {totalPages}</span>
          <button onClick={() => setAssignPage(p => Math.min(totalPages - 1, p + 1))} disabled={assignPage >= totalPages - 1}
            style={{ background: 'none', border: '1px solid rgba(102,252,241,0.3)', color: '#66FCF1', borderRadius: 4, padding: '2px 10px', cursor: assignPage >= totalPages - 1 ? 'not-allowed' : 'pointer', opacity: assignPage >= totalPages - 1 ? 0.4 : 1 }}>&#8250;</button>
        </Box>
      )}
    </Box>
  )
})

export default function Events() {
  const { role } = useAuth()
  const {
    products, events, getAvailableQty, getAvailableQtyForEvent, getLinkedAvailableQty,
    createEvent, updateEvent, cancelEvent, requestDeleteEvent, cancelDeleteEvent
  } = useInventory()

  const [search, setSearch] = React.useState('')
  const [orderSearch, setOrderSearch] = React.useState('')
  // Resumen Hoy/Semana/Año — filtro rápido por período, independiente del
  // buscador por nombre/N° de orden (se pueden combinar).
  const [summaryScope, setSummaryScope] = React.useState(null) // null|'hoy'|'semana'|'año'
  const [openCreate, setOpenCreate] = React.useState(false)
  const [openDetail, setOpenDetail] = React.useState(false)
  const [openEdit, setOpenEdit] = React.useState(false)
  const [openAssign, setOpenAssign] = React.useState(false)
  const [openOrderResult, setOpenOrderResult] = React.useState(false)
  const [openDeleteConfirm, setOpenDeleteConfirm] = React.useState(false)
  const [eventToDelete, setEventToDelete] = React.useState(null)
  const [orderResultEvent, setOrderResultEvent] = React.useState(null)
  const [currentEvent, setCurrentEvent] = React.useState(null)

  const emptyForm = { name: '', date: '', location: '', notes: '', staffIds: [] }
  const [form, setForm] = React.useState(emptyForm)
  const [staffList, setStaffList] = React.useState([])

  React.useEffect(() => {
    api.get('/api/staff').then(r => setStaffList((r && r.ok && Array.isArray(r.data)) ? r.data : [])).catch(() => {})
  }, [])
  const [assignCategory, setAssignCategory] = React.useState('')
  const [assignSkuSearch, setAssignSkuSearch] = React.useState('')
  const [assignPage, setAssignPage] = React.useState(0)
  const [assignmentsDraft, setAssignmentsDraft] = React.useState([])
  const [pdfLoading, setPdfLoading] = React.useState(false)
  const [snack, setSnack] = React.useState({ open: false, msg: '', severity: 'success' })

  const getProduct = id => products.find(p => p.id === id)

  // Disponibilidad ASIGNABLE: solo unidades con tag RFID vinculado.
  // No se puede asignar una unidad sin tag a un evento — si no tiene
  // tag no hay forma de rastrearla por RFID en Operaciones, y eso
  // permitiría crear eventos con equipos "asignados" que en realidad no
  // existen vinculados (información falsa).
  const availableForDraft = React.useCallback((product) => {
    // Si estamos editando un evento existente, excluimos su propia reserva
    // y consultamos disponibilidad para la fecha específica del evento
    const forDate = form.date || new Date().toISOString().slice(0, 10)
    return getLinkedAvailableQty(product.id, forDate, currentEvent?.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.date, currentEvent, getLinkedAvailableQty])

  // Disponibilidad FÍSICA total (incluye unidades sin tag) — solo para
  // mostrar el aviso informativo de "X sin tag, no asignables".
  const physicalAvailableForDraft = React.useCallback((product) => {
    const forDate = form.date || new Date().toISOString().slice(0, 10)
    if (currentEvent) {
      return getAvailableQtyForEvent(product.id, currentEvent.id, forDate)
    }
    return getAvailableQty(product.id, forDate)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.date, currentEvent, getAvailableQty, getAvailableQtyForEvent])

  const setQty = React.useCallback((productId, qty) => {
    const product = products.find(p => p.id === productId)
    const maxAvail = availableForDraft(product)
    const clamped = Math.min(Math.max(0, qty), maxAvail)
    setAssignmentsDraft(prev => {
      const existing = prev.find(a => a.productId === productId)
      if (existing) return prev.map(a => a.productId === productId ? { ...a, qty: clamped } : a)
      return [...prev, { productId, qty: clamped }]
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, availableForDraft])

  const totalAssigned = assignmentsDraft.reduce((s, a) => s + a.qty, 0)

  const assignPanelProps = React.useMemo(() => ({
    products, assignSkuSearch, setAssignSkuSearch,
    assignCategory, setAssignCategory,
    assignPage, setAssignPage,
    assignmentsDraft, totalAssigned,
    availableForDraft, physicalAvailableForDraft, setQty
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [products, assignSkuSearch, assignCategory, assignPage, assignmentsDraft, totalAssigned, availableForDraft, physicalAvailableForDraft, setQty])

  const filteredProductsByCategory = (cat) => products.filter(p =>
    (!cat || p.category === cat) &&
    (!assignSkuSearch || p.sku.toLowerCase().includes(assignSkuSearch.toLowerCase()) || p.name.toLowerCase().includes(assignSkuSearch.toLowerCase()))
  )

  /* BUSCAR POR N° DE ORDEN */
  const handleOrderSearch = () => {
    const q = orderSearch.trim().toUpperCase()
    if (!q) return
    const found = events.find(e =>
      e.orderNumber?.toUpperCase() === q ||
      e.orderNumber?.toUpperCase().includes(q)
    )
    if (found) {
      setOrderResultEvent(found)
      setOpenOrderResult(true)
    } else {
      setSnack({ open: true, msg: `No se encontró el evento "${orderSearch}"`, severity: 'warning' })
    }
  }

  /* CREAR */
  const openCreateModal = () => {
    setForm(emptyForm); setAssignmentsDraft([]); setAssignCategory(''); setCurrentEvent(null); setOpenCreate(true)
  }
  const handleCreate = () => {
    const created = createEvent(form, assignmentsDraft)
    setOpenCreate(false)
    setSnack({ open: true, msg: `Evento ${created.orderNumber} creado. Inventario actualizado.`, severity: 'success' })
  }

  /* DETALLE */
  const openDetailModal = (ev) => { setCurrentEvent(ev); setOpenDetail(true) }

  /* EDITAR */
  const openEditModal = () => {
    setForm({ name: currentEvent.name, date: currentEvent.date, location: currentEvent.location || '', notes: currentEvent.notes || '', staffIds: currentEvent.staffIds || [] })
    setAssignmentsDraft(currentEvent.assignments || [])
    setAssignCategory('')
    setOpenDetail(false); setOpenEdit(true)
  }
  const handleSaveEdit = () => {
    updateEvent(currentEvent.id, form, assignmentsDraft)
    setOpenEdit(false); setCurrentEvent(null)
    setSnack({ open: true, msg: 'Evento actualizado. Inventario recalculado.', severity: 'info' })
  }

  /* ASIGNAR */
  const openAssignModal = (ev) => {
    setCurrentEvent(ev); setAssignmentsDraft(ev.assignments || []); setAssignCategory(''); setOpenAssign(true)
  }
  const handleSaveAssignments = () => {
    updateEvent(currentEvent.id, {
      name: currentEvent.name, date: currentEvent.date,
      location: currentEvent.location, notes: currentEvent.notes, status: currentEvent.status
    }, assignmentsDraft)
    setOpenAssign(false)
    setSnack({ open: true, msg: 'Equipos actualizados. Inventario sincronizado.', severity: 'success' })
  }

  /* CANCELAR EVENTO — flujo de aprobación, con motivo obligatorio.
   * 'direct'  → admin cancela de inmediato (su botón "Cancelar evento" de siempre).
   * 'request' → operador solo solicita, con su motivo; el evento queda
   *             marcado en rojo hasta que un admin lo apruebe o lo rechace.
   * 'approve' → admin aprueba una solicitud ya pendiente (cancela de verdad,
   *             reutilizando el motivo que escribió el operador, editable).
   * A diferencia del viejo "Deshacer" (que borraba el evento sin dejar
   * rastro), ahora el evento queda con status "Cancelado" + el motivo,
   * visible en el filtro "Todos" de Operaciones y en el Reporte mensual. */
  const [deleteMode, setDeleteMode] = React.useState('direct')
  const [cancelReason, setCancelReason] = React.useState('')
  const openDeleteModal = (ev, e, mode = 'direct') => {
    e.stopPropagation(); setEventToDelete(ev); setDeleteMode(mode)
    setCancelReason(mode === 'approve' ? (ev.pendingDeleteReason || '') : '')
    setOpenDeleteConfirm(true)
  }
  const handleDeleteConfirm = () => {
    if (deleteMode === 'request') {
      requestDeleteEvent(eventToDelete.id, 'Operador', cancelReason.trim())
      setSnack({ open: true, msg: 'Solicitud de cancelación enviada. Un administrador debe aprobarla.', severity: 'info' })
    } else {
      cancelEvent(eventToDelete.id, cancelReason.trim(), 'Administrador')
      setSnack({ open: true, msg: 'Evento cancelado. Inventario restaurado a disponible.', severity: 'warning' })
    }
    setOpenDeleteConfirm(false); setEventToDelete(null); setOpenDetail(false); setCancelReason('')
  }
  const handleRejectDelete = (ev, e) => {
    e.stopPropagation()
    cancelDeleteEvent(ev.id)
    setSnack({ open: true, msg: 'Solicitud de cancelación rechazada.', severity: 'success' })
  }

  /* PDF */
  const handleDownloadPDF = async (ev) => {
    setPdfLoading(true)
    try {
      await generateEventPDF(ev, products)
      setSnack({ open: true, msg: `PDF generado: ${ev.orderNumber}`, severity: 'success' })
    } catch (err) {
      console.error(err)
      setSnack({ open: true, msg: 'Error al generar el PDF', severity: 'error' })
    } finally { setPdfLoading(false) }
  }

  /* COMPARTIR */
  const buildShareText = (ev) => {
    const items = (ev.assignments || []).filter(a => a.qty > 0).map(a => {
      const p = getProduct(a.productId); return p ? `• ${p.name} x${a.qty}` : null
    }).filter(Boolean).join('\n')
    return `Evento: ${ev.name}\nN° Orden: ${ev.orderNumber}\nFecha: ${ev.date}${ev.location ? '\nLugar: ' + ev.location : ''}\nEstado: ${ev.status}\n\nEquipos asignados:\n${items || 'Sin equipos'}`
  }
  const handleShareWhatsApp = (ev) => {
    window.open(`https://wa.me/?text=${encodeURIComponent(buildShareText(ev))}`, '_blank')
  }
  const handleShareMail = (ev) => {
    window.open(`mailto:?subject=${encodeURIComponent(`Evento ${ev.orderNumber} - ${ev.name}`)}&body=${encodeURIComponent(buildShareText(ev))}`, '_blank')
  }

  // ── Resumen Hoy / Semana / Año — cuenta eventos por período y por
  // estado, para dar una vista rápida sin tener que revisar la lista
  // completa. `today`/`thisWeek`/`thisYear` son las 3 pestañas del
  // resumen; cada una trae también su desglose por estado. ──
  const today = todayStr()
  const thisWeekKey = isoWeekKey(today)
  const thisYear = yearOf(today)
  const summaryBuckets = React.useMemo(() => {
    const buckets = {
      hoy: events.filter(e => e.date === today),
      semana: events.filter(e => isoWeekKey(e.date) === thisWeekKey),
      año: events.filter(e => yearOf(e.date) === thisYear),
    }
    const withBreakdown = {}
    for (const [key, list] of Object.entries(buckets)) {
      const byStatus = {}
      list.forEach(e => { byStatus[e.status] = (byStatus[e.status] || 0) + 1 })
      withBreakdown[key] = { list, count: list.length, byStatus }
    }
    return withBreakdown
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, today, thisWeekKey, thisYear])

  // Próximos/en curso primero; los Concluidos (ya pasaron por todas las
  // fases de Operaciones) quedan al final, pero siguen visibles acá —
  // antes desaparecían por completo al cerrarse.
  const filteredEvents = events
    .filter(e =>
      !search || e.name.toLowerCase().includes(search.toLowerCase()) || e.orderNumber?.toLowerCase().includes(search.toLowerCase())
    )
    .filter(e => {
      if (summaryScope === 'hoy') return e.date === today
      if (summaryScope === 'semana') return isoWeekKey(e.date) === thisWeekKey
      if (summaryScope === 'año') return yearOf(e.date) === thisYear
      return true
    })
    .sort((a, b) => {
      const aDone = a.status === 'Concluido' ? 1 : 0
      const bDone = b.status === 'Concluido' ? 1 : 0
      if (aDone !== bDone) return aDone - bDone
      return a.date > b.date ? 1 : -1
    })

  const EventDetailContent = ({ ev }) => {
    if (!ev) return null
    const grouped = {}
    for (const a of (ev.assignments || [])) {
      if (a.qty === 0) continue
      const p = getProduct(a.productId)
      if (!p) continue
      if (!grouped[p.category]) grouped[p.category] = []
      grouped[p.category].push({ p, qty: a.qty })
    }
    return (
      <>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, flexWrap: 'wrap' }}>
          <Typography variant="h6" fontWeight={700}>{ev.name}</Typography>
          <Chip label={ev.orderNumber} size="small" color="primary" variant="outlined" />
          <Chip label={ev.status} size="small" color={STATUS_COLORS[ev.status] || 'default'} />
        </Box>
        <Box sx={{ display: 'flex', gap: 3, mb: 2, flexWrap: 'wrap' }}>
          <Box><Typography variant="caption" color="text.secondary">FECHA</Typography><Typography>{ev.date}</Typography></Box>
          <Box><Typography variant="caption" color="text.secondary">LUGAR</Typography><Typography>{ev.location || '—'}</Typography></Box>
          <Box><Typography variant="caption" color="text.secondary">ARTÍCULOS</Typography><Typography>{(ev.assignments || []).reduce((s, a) => s + a.qty, 0)}</Typography></Box>
        </Box>
        {ev.notes && <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{ev.notes}</Typography>}
        {ev.staffIds?.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>PERSONAL ASIGNADO</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
              {ev.staffIds.map(id => {
                const p = staffList.find(s => s.id === id)
                return p ? <Chip key={id} label={`${p.nombre} ${p.apellido}`} size="small" variant="outlined" /> : null
              })}
            </Box>
          </Box>
        )}
        <Divider sx={{ mb: 1.5 }} />
        <Typography variant="subtitle2" gutterBottom>Equipos asignados</Typography>
        {Object.keys(grouped).length === 0
          ? <Typography variant="caption" color="text.secondary">Sin equipos asignados</Typography>
          : Object.entries(grouped).map(([cat, items]) => (
            <Box key={cat} sx={{ mb: 1.5 }}>
              <Typography variant="caption" color="primary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>{cat}</Typography>
              {items.map(({ p, qty }) => (
                <Box key={p.id} sx={{ display: 'flex', justifyContent: 'space-between', pl: 1 }}>
                  <Typography variant="body2">{p.name}</Typography>
                  <Typography variant="body2" color="primary">×{qty}</Typography>
                </Box>
              ))}
            </Box>
          ))
        }
      </>
    )
  }

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>Eventos</Typography>

      {/* ── Resumen Hoy / Semana / Año ──────────────────────────────────
       * 3 pestañas con el conteo total y el desglose por estado de ese
       * período. Tocar una además filtra la lista de abajo; tocarla de
       * nuevo (o "Quitar filtro") vuelve a mostrar todo. */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, mb: summaryScope ? 1.5 : 0 }}>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {[
              { key: 'hoy', label: 'Hoy' },
              { key: 'semana', label: 'Semana' },
              { key: 'año', label: 'Año' },
            ].map(s => (
              <Button
                key={s.key}
                size="small"
                variant={summaryScope === s.key ? 'contained' : 'outlined'}
                onClick={() => setSummaryScope(prev => prev === s.key ? null : s.key)}
                sx={{ fontSize: 12 }}
              >
                {s.label} ({summaryBuckets[s.key].count})
              </Button>
            ))}
          </Box>
          {summaryScope && (
            <Button size="small" onClick={() => setSummaryScope(null)} sx={{ fontSize: 11 }}>
              Quitar filtro
            </Button>
          )}
        </Box>
        {summaryScope && (
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {summaryBuckets[summaryScope].count === 0 ? (
              <Typography variant="caption" color="text.secondary">Sin eventos en este período.</Typography>
            ) : (
              SUMMARY_STATUS_ORDER
                .filter(st => summaryBuckets[summaryScope].byStatus[st])
                .map(st => (
                  <Chip
                    key={st}
                    label={`${st}: ${summaryBuckets[summaryScope].byStatus[st]}`}
                    size="small"
                    color={STATUS_COLORS[st] || 'default'}
                    variant="outlined"
                  />
                ))
            )}
          </Box>
        )}
      </Paper>

      <Paper sx={{ p: 2, mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          <TextField size="small" placeholder="Buscar por nombre o N° de orden…"
            value={search} onChange={e => setSearch(e.target.value)} sx={{ minWidth: 240 }}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }} />
          <TextField
            size="small" placeholder="N° de evento (ej: EVT-101)"
            value={orderSearch} onChange={e => setOrderSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleOrderSearch()}
            sx={{ width: 220 }}
            InputProps={{ startAdornment: <InputAdornment position="start"><EventIcon fontSize="small" /></InputAdornment> }}
          />
          <Button variant="contained" size="small" onClick={handleOrderSearch}
            startIcon={<SearchIcon />} sx={{ height: 40, whiteSpace: 'nowrap' }}>
            Buscar
          </Button>
        </Box>
        {role === 'admin' && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateModal}>Nuevo Evento</Button>
        )}
      </Paper>

      <Paper sx={{ p: 2 }}>
        {filteredEvents.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <EventIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
            <Typography color="text.secondary">No hay eventos. Crea el primero.</Typography>
          </Box>
        ) : (
          <List disablePadding>
            {filteredEvents.map((ev, idx) => (
              <React.Fragment key={ev.id}>
                {idx > 0 && <Divider />}
                <ListItem sx={{
                  py: 1.5,
                  ...(ev.pendingDelete ? {
                    bgcolor: 'rgba(244,67,54,0.08)',
                    borderLeft: '3px solid #f44336'
                  } : {})
                }}
                  secondaryAction={
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                      <Tooltip title="Descargar PDF"><span>
                        <Button size="small" variant="outlined" color="primary"
                          onClick={() => handleDownloadPDF(ev)} disabled={pdfLoading}
                          startIcon={pdfLoading ? <CircularProgress size={14} /> : <PictureAsPdfIcon />}>PDF</Button>
                      </span></Tooltip>
                      <Button size="small" variant="outlined" onClick={() => openDetailModal(ev)}>Detalle</Button>

                      {role === 'admin' && !ev.pendingDelete && ev.status !== 'Concluido' && ev.status !== 'Cancelado' && (
                        <>
                          <Button size="small" variant="outlined" onClick={() => openAssignModal(ev)}>Equipos</Button>
                          <Tooltip title="Cancelar evento y restaurar inventario">
                            <Button size="small" variant="outlined" color="error"
                              startIcon={<DeleteIcon />} onClick={(e) => openDeleteModal(ev, e, 'direct')}>
                              Cancelar evento
                            </Button>
                          </Tooltip>
                        </>
                      )}

                      {role === 'admin' && ev.pendingDelete && (
                        <>
                          <Tooltip title={`Solicitado por ${ev.pendingDeleteBy || 'Operador'}`}>
                            <Button size="small" variant="contained" color="error"
                              startIcon={<DeleteIcon />} onClick={(e) => openDeleteModal(ev, e, 'approve')}>
                              Aprobar y cancelar
                            </Button>
                          </Tooltip>
                          <Button size="small" variant="outlined" onClick={(e) => handleRejectDelete(ev, e)}>
                            Rechazar
                          </Button>
                        </>
                      )}

                      {role === 'operador' && !ev.pendingDelete && ev.status !== 'Concluido' && ev.status !== 'Cancelado' && (
                        <Tooltip title="Enviar solicitud de cancelación a un administrador">
                          <Button size="small" variant="outlined" color="error"
                            startIcon={<DeleteIcon />} onClick={(e) => openDeleteModal(ev, e, 'request')}>
                            Solicitar cancelación
                          </Button>
                        </Tooltip>
                      )}
                    </Box>
                  }>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        <Typography variant="body1" fontWeight={600}>{ev.name}</Typography>
                        <Chip label={ev.orderNumber} size="small" color="primary" variant="outlined" sx={{ fontSize: 10 }} />
                        <Chip label={ev.status} size="small" color={STATUS_COLORS[ev.status] || 'default'} />
                        {ev.pendingDelete && (
                          <Chip label={`Pendiente de cancelación${ev.pendingDeleteReason ? ': ' + ev.pendingDeleteReason : ''}`} size="small" color="error"
                            sx={{ fontWeight: 600 }} />
                        )}
                      </Box>
                    }
                    secondary={
                      <Box>
                        <Box sx={{ display: 'flex', gap: 2, mt: 0.5, flexWrap: 'wrap' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <EventIcon sx={{ fontSize: 13 }} /><Typography variant="caption">{ev.date}</Typography>
                          </Box>
                          {ev.location && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <PlaceIcon sx={{ fontSize: 13 }} /><Typography variant="caption">{ev.location}</Typography>
                            </Box>
                          )}
                          <Typography variant="caption" color="primary">
                            {(ev.assignments || []).reduce((s, a) => s + a.qty, 0)} artículos
                          </Typography>
                        </Box>
                        {ev.status === 'Cancelado' && (
                          <Typography variant="caption" color="error.main" sx={{ display: 'block', mt: 0.5 }}>
                            Motivo de cancelación: {ev.cancelReason || 'Sin motivo especificado'}
                            {ev.cancelledBy ? ` — ${ev.cancelledBy}` : ''}
                          </Typography>
                        )}
                      </Box>
                    }
                  />
                </ListItem>
              </React.Fragment>
            ))}
          </List>
        )}
      </Paper>

      {/* MODAL BÚSQUEDA POR N° */}
      <Dialog open={openOrderResult} onClose={() => setOpenOrderResult(false)} fullWidth maxWidth="sm">
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <EventIcon color="primary" /> Evento encontrado
          </Box>
        </DialogTitle>
        <DialogContent>
          <EventDetailContent ev={orderResultEvent} />
          {orderResultEvent && (
            <>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle2" gutterBottom>Acciones</Typography>
              <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                <Button variant="contained"
                  startIcon={pdfLoading ? <CircularProgress size={16} /> : <PictureAsPdfIcon />}
                  onClick={() => handleDownloadPDF(orderResultEvent)} disabled={pdfLoading}>
                  Descargar PDF
                </Button>
                <Button variant="outlined" startIcon={<WhatsAppIcon />}
                  onClick={() => handleShareWhatsApp(orderResultEvent)}
                  sx={{ color: '#25D366', borderColor: '#25D366', '&:hover': { borderColor: '#1ebe57', bgcolor: 'rgba(37,211,102,0.08)' } }}>
                  WhatsApp
                </Button>
                <Button variant="outlined" startIcon={<EmailIcon />}
                  onClick={() => handleShareMail(orderResultEvent)}>
                  Correo
                </Button>
              </Box>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenOrderResult(false)}>Cerrar</Button>
        </DialogActions>
      </Dialog>

      {/* MODAL CANCELAR EVENTO — pide motivo obligatorio, así queda visible
          después en "Todos" (Operaciones) y en el Reporte de operaciones. */}
      <Dialog open={openDeleteConfirm} onClose={() => setOpenDeleteConfirm(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ color: 'error.main', display: 'flex', alignItems: 'center', gap: 1 }}>
          <DeleteIcon /> {deleteMode === 'request' ? 'Solicitar cancelación' : deleteMode === 'approve' ? 'Aprobar cancelación' : 'Cancelar evento'}
        </DialogTitle>
        <DialogContent>
          {deleteMode === 'request' ? (
            <>
              <Typography variant="body1" gutterBottom>
                ¿Enviar solicitud de cancelación para <strong>{eventToDelete?.name}</strong> ({eventToDelete?.orderNumber})?
              </Typography>
              <Alert severity="info" sx={{ mt: 1, mb: 2 }}>
                El evento quedará marcado en rojo hasta que un administrador la apruebe o la rechace. No se cancela todavía.
              </Alert>
            </>
          ) : (
            <>
              <Typography variant="body1" gutterBottom>
                {deleteMode === 'approve' ? '¿Aprobar la cancelación de ' : '¿Estás seguro de cancelar '}
                <strong>{eventToDelete?.name}</strong> ({eventToDelete?.orderNumber})?
              </Typography>
              <Alert severity="warning" sx={{ mt: 1, mb: 2 }}>
                Todos los equipos reservados volverán a estar <strong>Disponibles</strong> en el inventario. El evento
                queda visible como "Cancelado" en Operaciones y en el Reporte, con el motivo que escribas abajo.
              </Alert>
            </>
          )}
          <TextField
            label="Motivo de la cancelación" required autoFocus fullWidth multiline minRows={2}
            value={cancelReason} onChange={e => setCancelReason(e.target.value)}
            placeholder="Ej: el cliente canceló el arriendo del recinto"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDeleteConfirm(false)}>Volver</Button>
          <Button variant="contained" color="error" startIcon={<DeleteIcon />}
            disabled={!cancelReason.trim()} onClick={handleDeleteConfirm}>
            {deleteMode === 'request' ? 'Enviar solicitud' : deleteMode === 'approve' ? 'Aprobar y cancelar' : 'Cancelar y restaurar inventario'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* MODAL CREAR */}
      <Dialog open={openCreate} onClose={() => setOpenCreate(false)} fullWidth maxWidth="sm">
        <DialogTitle>Nuevo evento</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <TextField label="Nombre del evento" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField type="date" label="Fecha" InputLabelProps={{ shrink: true }}
              value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} sx={{ flex: 1 }} />
            <TextField label="Lugar" value={form.location}
              onChange={e => setForm({ ...form, location: e.target.value })} sx={{ flex: 1 }} />
          </Box>
          <TextField label="Notas" multiline minRows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
          {staffList.length > 0 && (
            <TextField
              select label="Personal asignado" SelectProps={{ multiple: true }}
              value={form.staffIds || []}
              onChange={e => setForm({ ...form, staffIds: typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value })}
              helperText="Puedes seleccionar varios"
            >
              {staffList.map(s => (
                <MenuItem key={s.id} value={s.id}>{s.nombre} {s.apellido}</MenuItem>
              ))}
            </TextField>
          )}
          <Divider sx={{ my: 0.5 }} />
          <Typography variant="subtitle2" color="primary">Asignar equipos</Typography>
          <AssignPanel {...assignPanelProps} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenCreate(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleCreate} disabled={!form.name || !form.date}>Guardar evento</Button>
        </DialogActions>
      </Dialog>

      {/* MODAL DETALLE */}
      <Dialog open={openDetail} onClose={() => setOpenDetail(false)} fullWidth maxWidth="sm">
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            {currentEvent?.name}
            <Chip label={currentEvent?.orderNumber} size="small" color="primary" variant="outlined" />
          </Box>
        </DialogTitle>
        <DialogContent>
          {currentEvent && (() => {
            const grouped = {}
            for (const a of (currentEvent.assignments || [])) {
              if (a.qty === 0) continue
              const p = getProduct(a.productId); if (!p) continue
              if (!grouped[p.category]) grouped[p.category] = []
              grouped[p.category].push({ p, qty: a.qty })
            }
            return (
              <>
                <Box sx={{ display: 'flex', gap: 3, mb: 2, flexWrap: 'wrap' }}>
                  <Box><Typography variant="caption" color="text.secondary">FECHA</Typography><Typography>{currentEvent.date}</Typography></Box>
                  <Box><Typography variant="caption" color="text.secondary">LUGAR</Typography><Typography>{currentEvent.location || '—'}</Typography></Box>
                  <Box><Typography variant="caption" color="text.secondary">ESTADO</Typography><Box sx={{ mt: 0.5 }}><Chip label={currentEvent.status} size="small" color={STATUS_COLORS[currentEvent.status] || 'default'} /></Box></Box>
                </Box>
                {currentEvent.notes && <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{currentEvent.notes}</Typography>}
                {currentEvent.status === 'Cancelado' && (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    Motivo de cancelación: {currentEvent.cancelReason || 'Sin motivo especificado'}
                    {currentEvent.cancelledBy ? ` — ${currentEvent.cancelledBy}` : ''}
                  </Alert>
                )}
                <Divider sx={{ mb: 1.5 }} />
                <Typography variant="subtitle2" gutterBottom>Equipos asignados</Typography>
                {Object.keys(grouped).length === 0
                  ? <Typography variant="caption" color="text.secondary">Sin equipos asignados</Typography>
                  : Object.entries(grouped).map(([cat, items]) => (
                    <Box key={cat} sx={{ mb: 1.5 }}>
                      <Typography variant="caption" color="primary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>{cat}</Typography>
                      {items.map(({ p, qty }) => (
                        <Box key={p.id} sx={{ display: 'flex', justifyContent: 'space-between', pl: 1 }}>
                          <Typography variant="body2">{p.name}</Typography>
                          <Typography variant="body2" color="primary">×{qty}</Typography>
                        </Box>
                      ))}
                    </Box>
                  ))
                }
              </>
            )
          })()}
        </DialogContent>
        <DialogActions>
          <Button startIcon={<PictureAsPdfIcon />} onClick={() => handleDownloadPDF(currentEvent)} disabled={pdfLoading}>
            {pdfLoading ? 'Generando…' : 'Descargar PDF'}
          </Button>
          {role === 'admin' && <Button onClick={openEditModal} variant="outlined">Editar</Button>}
          <Button onClick={() => setOpenDetail(false)}>Cerrar</Button>
        </DialogActions>
      </Dialog>

      {/* MODAL EDITAR */}
      <Dialog open={openEdit} onClose={() => setOpenEdit(false)} fullWidth maxWidth="sm">
        <DialogTitle>Editar evento — {currentEvent?.orderNumber}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <TextField label="Nombre" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField type="date" label="Fecha" InputLabelProps={{ shrink: true }}
              value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} sx={{ flex: 1 }} />
            <TextField label="Lugar" value={form.location}
              onChange={e => setForm({ ...form, location: e.target.value })} sx={{ flex: 1 }} />
          </Box>
          <TextField label="Notas" multiline minRows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
          {staffList.length > 0 && (
            <TextField
              select label="Personal asignado" SelectProps={{ multiple: true }}
              value={form.staffIds || []}
              onChange={e => setForm({ ...form, staffIds: typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value })}
              helperText="Puedes seleccionar varios"
            >
              {staffList.map(s => (
                <MenuItem key={s.id} value={s.id}>{s.nombre} {s.apellido}</MenuItem>
              ))}
            </TextField>
          )}
          <Divider />
          <Typography variant="subtitle2" color="primary">Equipos asignados</Typography>
          <AssignPanel {...assignPanelProps} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenEdit(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleSaveEdit}>Guardar cambios</Button>
        </DialogActions>
      </Dialog>

      {/* MODAL ASIGNAR */}
      <Dialog open={openAssign} onClose={() => setOpenAssign(false)} fullWidth maxWidth="sm">
        <DialogTitle>Asignar equipos — {currentEvent?.name}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <AssignPanel {...assignPanelProps} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenAssign(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleSaveAssignments}>Guardar</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snack.open} autoHideDuration={4000}
        onClose={() => setSnack(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snack.severity} onClose={() => setSnack(s => ({ ...s, open: false }))}>{snack.msg}</Alert>
      </Snackbar>
    </Box>
  )
}
