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

const CATEGORIES = ['Audio', 'Iluminacion', 'Pantalla', 'Efectos', 'Estructuras', 'Energía', 'Tecnologia', 'Otros']

const STATUS_COLORS = {
  Programado: 'primary',
  Confirmado: 'success',
  Suspendido: 'error',
  Realizado: 'default',
  Concluido: 'success'
}

const ASSIGN_PAGE_SIZE = 10

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
        // maxAvail = solo unidades CON sticker vinculado — es lo único que
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
                    {maxAvail} disponible{maxAvail !== 1 ? 's' : ''} con sticker
                  </span>
                )}
                {!noStock && unlinkedCount > 0 && (
                  <span style={{ color: '#f44336' }}> · {unlinkedCount} sin sticker (no asignable{unlinkedCount !== 1 ? 's' : ''})</span>
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
    createEvent, updateEvent, deleteEvent, requestDeleteEvent, cancelDeleteEvent
  } = useInventory()

  const [search, setSearch] = React.useState('')
  const [orderSearch, setOrderSearch] = React.useState('')
  const [openCreate, setOpenCreate] = React.useState(false)
  const [openDetail, setOpenDetail] = React.useState(false)
  const [openEdit, setOpenEdit] = React.useState(false)
  const [openAssign, setOpenAssign] = React.useState(false)
  const [openOrderResult, setOpenOrderResult] = React.useState(false)
  const [openDeleteConfirm, setOpenDeleteConfirm] = React.useState(false)
  const [eventToDelete, setEventToDelete] = React.useState(null)
  const [orderResultEvent, setOrderResultEvent] = React.useState(null)
  const [currentEvent, setCurrentEvent] = React.useState(null)

  const emptyForm = { name: '', date: '', location: '', notes: '' }
  const [form, setForm] = React.useState(emptyForm)
  const [assignCategory, setAssignCategory] = React.useState('')
  const [assignSkuSearch, setAssignSkuSearch] = React.useState('')
  const [assignPage, setAssignPage] = React.useState(0)
  const [assignmentsDraft, setAssignmentsDraft] = React.useState([])
  const [pdfLoading, setPdfLoading] = React.useState(false)
  const [snack, setSnack] = React.useState({ open: false, msg: '', severity: 'success' })

  const getProduct = id => products.find(p => p.id === id)

  // Disponibilidad ASIGNABLE: solo unidades con sticker RFID vinculado.
  // No se puede asignar una unidad sin sticker a un evento — si no tiene
  // sticker no hay forma de rastrearla por RFID en Operaciones, y eso
  // permitiría crear eventos con equipos "asignados" que en realidad no
  // existen vinculados (información falsa).
  const availableForDraft = React.useCallback((product) => {
    // Si estamos editando un evento existente, excluimos su propia reserva
    // y consultamos disponibilidad para la fecha específica del evento
    const forDate = form.date || new Date().toISOString().slice(0, 10)
    return getLinkedAvailableQty(product.id, forDate, currentEvent?.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.date, currentEvent, getLinkedAvailableQty])

  // Disponibilidad FÍSICA total (incluye unidades sin sticker) — solo para
  // mostrar el aviso informativo de "X sin sticker, no asignables".
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
    setForm({ name: currentEvent.name, date: currentEvent.date, location: currentEvent.location || '', notes: currentEvent.notes || '' })
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

  /* ELIMINAR EVENTO — flujo de aprobación.
   * 'direct'  → admin elimina de inmediato (su botón "Deshacer" de siempre).
   * 'request' → operador solo solicita; el evento queda marcado en rojo
   *             hasta que un admin lo apruebe o lo rechace.
   * 'approve' → admin aprueba una solicitud ya pendiente (elimina de verdad). */
  const [deleteMode, setDeleteMode] = React.useState('direct')
  const openDeleteModal = (ev, e, mode = 'direct') => {
    e.stopPropagation(); setEventToDelete(ev); setDeleteMode(mode); setOpenDeleteConfirm(true)
  }
  const handleDeleteConfirm = () => {
    if (deleteMode === 'request') {
      requestDeleteEvent(eventToDelete.id, 'Operador')
      setSnack({ open: true, msg: 'Solicitud de eliminación enviada. Un administrador debe aprobarla.', severity: 'info' })
    } else {
      deleteEvent(eventToDelete.id)
      setSnack({ open: true, msg: 'Evento eliminado. Inventario restaurado a disponible.', severity: 'warning' })
    }
    setOpenDeleteConfirm(false); setEventToDelete(null); setOpenDetail(false)
  }
  const handleRejectDelete = (ev, e) => {
    e.stopPropagation()
    cancelDeleteEvent(ev.id)
    setSnack({ open: true, msg: 'Solicitud de eliminación rechazada.', severity: 'success' })
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

  // Próximos/en curso primero; los Concluidos (ya pasaron por todas las
  // fases de Operaciones) quedan al final, pero siguen visibles acá —
  // antes desaparecían por completo al cerrarse.
  const filteredEvents = events
    .filter(e =>
      !search || e.name.toLowerCase().includes(search.toLowerCase()) || e.orderNumber?.toLowerCase().includes(search.toLowerCase())
    )
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

                      {role === 'admin' && !ev.pendingDelete && ev.status !== 'Concluido' && (
                        <>
                          <Button size="small" variant="outlined" onClick={() => openAssignModal(ev)}>Equipos</Button>
                          <Tooltip title="Deshacer evento y restaurar inventario">
                            <Button size="small" variant="outlined" color="error"
                              startIcon={<DeleteIcon />} onClick={(e) => openDeleteModal(ev, e, 'direct')}>
                              Deshacer
                            </Button>
                          </Tooltip>
                        </>
                      )}

                      {role === 'admin' && ev.pendingDelete && (
                        <>
                          <Tooltip title={`Solicitado por ${ev.pendingDeleteBy || 'Operador'}`}>
                            <Button size="small" variant="contained" color="error"
                              startIcon={<DeleteIcon />} onClick={(e) => openDeleteModal(ev, e, 'approve')}>
                              Aprobar y eliminar
                            </Button>
                          </Tooltip>
                          <Button size="small" variant="outlined" onClick={(e) => handleRejectDelete(ev, e)}>
                            Rechazar
                          </Button>
                        </>
                      )}

                      {role === 'operator' && !ev.pendingDelete && ev.status !== 'Concluido' && (
                        <Tooltip title="Enviar solicitud de eliminación a un administrador">
                          <Button size="small" variant="outlined" color="error"
                            startIcon={<DeleteIcon />} onClick={(e) => openDeleteModal(ev, e, 'request')}>
                            Solicitar eliminación
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
                          <Chip label="Pendiente de eliminación" size="small" color="error"
                            sx={{ fontWeight: 600 }} />
                        )}
                      </Box>
                    }
                    secondary={
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

      {/* MODAL CONFIRMAR ELIMINACIÓN */}
      <Dialog open={openDeleteConfirm} onClose={() => setOpenDeleteConfirm(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ color: 'error.main', display: 'flex', alignItems: 'center', gap: 1 }}>
          <DeleteIcon /> {deleteMode === 'request' ? 'Solicitar eliminación' : 'Deshacer Evento'}
        </DialogTitle>
        <DialogContent>
          {deleteMode === 'request' ? (
            <>
              <Typography variant="body1" gutterBottom>
                ¿Enviar solicitud de eliminación para <strong>{eventToDelete?.name}</strong> ({eventToDelete?.orderNumber})?
              </Typography>
              <Alert severity="info" sx={{ mt: 1 }}>
                El evento quedará marcado en rojo hasta que un administrador la apruebe o la rechace. No se elimina todavía.
              </Alert>
            </>
          ) : (
            <>
              <Typography variant="body1" gutterBottom>
                {deleteMode === 'approve' ? '¿Aprobar la eliminación de ' : '¿Estás seguro de eliminar '}
                <strong>{eventToDelete?.name}</strong> ({eventToDelete?.orderNumber})
                {deleteMode === 'approve' ? '?' : '?'}
              </Typography>
              <Alert severity="warning" sx={{ mt: 1 }}>
                Todos los equipos reservados volverán a estar <strong>Disponibles</strong> en el inventario.
              </Alert>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDeleteConfirm(false)}>Cancelar</Button>
          <Button variant="contained" color="error" startIcon={<DeleteIcon />} onClick={handleDeleteConfirm}>
            {deleteMode === 'request' ? 'Enviar solicitud' : 'Eliminar y restaurar inventario'}
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
