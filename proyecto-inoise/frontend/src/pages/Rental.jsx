import React from 'react'
import {
    Box, Typography, Paper, List, ListItem, ListItemText,
    Button, Dialog, DialogTitle, DialogContent, DialogActions,
    TextField, MenuItem, Divider, Chip, CircularProgress,
    InputAdornment, Tooltip, Alert, Snackbar
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import AddIcon from '@mui/icons-material/Add'
import EventIcon from '@mui/icons-material/Event'
import PersonIcon from '@mui/icons-material/Person'
import DeleteIcon from '@mui/icons-material/Delete'
import HandshakeIcon from '@mui/icons-material/Handshake'
import { generateRentalPDF } from '../utils/generatePDF'
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf'
import { useInventory } from '../context/InventoryContext'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'

const CATEGORIES = ['Audio', 'Iluminacion', 'Pantalla', 'Efectos', 'Estructuras', 'Energía', 'Tecnologia', 'Otros']
const ASSIGN_PAGE_SIZE = 10
const RENTAL_STATUS_COLORS = { Programado: 'warning', 'En curso': 'warning', Realizado: 'default', Concluido: 'success', Cancelado: 'default' }

const AssignPanel = React.memo(({
    products, assignSkuSearch, setAssignSkuSearch,
    assignCategory, setAssignCategory,
    assignPage, setAssignPage,
    assignmentsDraft, totalAssigned,
    setQty, availableFor
}) => {
    const filtered = products.filter(p => {
        const available = availableFor(p)
        return (
            available > 0 &&
            (!assignCategory || p.category === assignCategory) &&
            (!assignSkuSearch ||
                p.sku.toLowerCase().includes(assignSkuSearch.toLowerCase()) ||
                p.name.toLowerCase().includes(assignSkuSearch.toLowerCase()))
        )
    })
    const totalPages = Math.ceil(filtered.length / ASSIGN_PAGE_SIZE)
    const paginated = filtered.slice(assignPage * ASSIGN_PAGE_SIZE, (assignPage + 1) * ASSIGN_PAGE_SIZE)

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <TextField label="Buscar SKU o categoría" size="small" value={assignSkuSearch}
                onChange={e => { setAssignSkuSearch(e.target.value); setAssignPage(0) }}
                placeholder="ej: AUD-001 o micrófono" autoComplete="off" />
            <TextField select label="Filtrar categoría" size="small" value={assignCategory}
                onChange={e => { setAssignCategory(e.target.value); setAssignPage(0) }}>
                <MenuItem value="">Todas las categorías</MenuItem>
                {CATEGORIES.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </TextField>
            {totalAssigned > 0 && (
                <Alert severity="info" sx={{ py: 0.5, fontSize: 12 }}>
                    {totalAssigned} artículo{totalAssigned !== 1 ? 's' : ''} seleccionado{totalAssigned !== 1 ? 's' : ''}
                </Alert>
            )}
            {paginated.map(p => {
                const available = availableFor(p)
                const current = assignmentsDraft.find(a => a.productId === p.id)?.qty || 0
                return (
                    <Box key={p.id} sx={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        p: 1.5, borderRadius: 1,
                        backgroundColor: current > 0 ? 'rgba(102,252,241,0.06)' : 'background.paper',
                        border: '1px solid', borderColor: current > 0 ? 'primary.main' : 'divider'
                    }}>
                        <Box>
                            <Typography variant="body2" fontWeight={current > 0 ? 600 : 400}>{p.name}</Typography>
                            <Typography variant="caption" color="text.secondary">
                                {p.sku} · {p.category} ·{' '}
                                <span style={{ color: available > 0 ? '#66FCF1' : '#f44336' }}>
                                    {available} disponible{available !== 1 ? 's' : ''} (con tag)
                                </span>
                            </Typography>
                        </Box>
                        <TextField type="number" size="small" sx={{ width: 80 }}
                            inputProps={{ min: 0, max: available }} value={current}
                            disabled={available === 0 && current === 0}
                            onChange={e => setQty(p.id, Number(e.target.value), available)} />
                    </Box>
                )
            })}
            {totalPages > 1 && (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1, mt: 1 }}>
                    <button onClick={() => setAssignPage(p => Math.max(0, p - 1))} disabled={assignPage === 0}
                        style={{ background: 'none', border: '1px solid rgba(102,252,241,0.3)', color: '#66FCF1', borderRadius: 4, padding: '2px 10px', cursor: assignPage === 0 ? 'not-allowed' : 'pointer', opacity: assignPage === 0 ? 0.4 : 1 }}>‹</button>
                    <span style={{ fontSize: 12, color: '#C5C6C7' }}>{assignPage + 1} / {totalPages}</span>
                    <button onClick={() => setAssignPage(p => Math.min(totalPages - 1, p + 1))} disabled={assignPage >= totalPages - 1}
                        style={{ background: 'none', border: '1px solid rgba(102,252,241,0.3)', color: '#66FCF1', borderRadius: 4, padding: '2px 10px', cursor: assignPage >= totalPages - 1 ? 'not-allowed' : 'pointer', opacity: assignPage >= totalPages - 1 ? 0.4 : 1 }}>›</button>
                </Box>
            )}
        </Box>
    )
})

export default function Rental() {
    const { role, currentUser: authUser } = useAuth()
    const {
        products, rentals, epcMap, createRental, updateRental,
        requestDeleteRental, cancelDeleteRental, cancelRental
    } = useInventory()
    // Mismo fix que ya se aplicó en Operations.jsx/Events.jsx: el registro
    // de auditoría debe guardar quién hizo la acción realmente, no un rol genérico.
    const roleLabel = authUser ? `${authUser.nombre} ${authUser.apellido}` : (role === 'admin' ? 'Administrador' : 'Operador')

    const [search, setSearch] = React.useState('')
    const [guideSearch, setGuideSearch] = React.useState('')
    const [openCreate, setOpenCreate] = React.useState(false)
    const [openEdit, setOpenEdit] = React.useState(false)
    const [openDetail, setOpenDetail] = React.useState(false)
    const [openDeleteConfirm, setOpenDeleteConfirm] = React.useState(false)
    const [deleteMode, setDeleteMode] = React.useState('direct') // 'direct' | 'request' | 'approve'
    const [cancelReason, setCancelReason] = React.useState('')
    const [rentalToDelete, setRentalToDelete] = React.useState(null)
    const [currentRental, setCurrentRental] = React.useState(null)
    const [snack, setSnack] = React.useState({ open: false, msg: '', severity: 'success' })
    const [pdfLoading, setPdfLoading] = React.useState(false)
    const [staffList, setStaffList] = React.useState([])

    React.useEffect(() => {
        api.get('/api/staff').then(r => setStaffList((r && r.ok && Array.isArray(r.data)) ? r.data : [])).catch(() => {})
    }, [])

    const emptyForm = { name: '', date: '', endDate: '', clientName: '', staffIds: [], notes: '' }
    const [form, setForm] = React.useState(emptyForm)
    const [assignCategory, setAssignCategory] = React.useState('')
    const [assignSkuSearch, setAssignSkuSearch] = React.useState('')
    const [assignPage, setAssignPage] = React.useState(0)
    const [assignmentsDraft, setAssignmentsDraft] = React.useState([])
    // Al editar un arriendo existente, sus propias unidades ya asignadas
    // tienen state==='Rental' (no 'Disponible') — hay que contarlas igual
    // como "disponibles para este arriendo" o editar sin cambiar nada
    // mostraría todo en 0. Se guarda por producto: productId → unitIds.
    const [editingOwnUnitIds, setEditingOwnUnitIds] = React.useState(null)

    // Disponibilidad ASIGNABLE: solo unidades con tag RFID vinculado (igual
    // que Events.jsx) — antes esta página dejaba asignar cualquier unidad
    // "Disponible" sin importar si tenía o no un tag, lo que hacía que esas
    // unidades fueran imposibles de escanear después en Operaciones.
    const availableFor = React.useCallback((product) => {
        const linkedUnitIds = new Set(Object.values(epcMap || {}))
        const ownIds = editingOwnUnitIds?.[product.id] || []
        return product.units.filter(u =>
            linkedUnitIds.has(u.id) && (u.state === 'Disponible' || ownIds.includes(u.id))
        ).length
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [epcMap, editingOwnUnitIds])

    const totalAssigned = assignmentsDraft.reduce((s, a) => s + a.qty, 0)

    const setQty = React.useCallback((productId, qty, maxAvail) => {
        const clamped = Math.min(Math.max(0, qty), maxAvail)
        setAssignmentsDraft(prev => {
            const existing = prev.find(a => a.productId === productId)
            if (existing) return prev.map(a => a.productId === productId ? { ...a, qty: clamped } : a)
            return [...prev, { productId, qty: clamped }]
        })
    }, [])

    const handleDownloadPDF = async (rental) => {
        setPdfLoading(true)
        try {
            await generateRentalPDF(rental, products)
            setSnack({ open: true, msg: `PDF generado: ${rental.orderNumber}`, severity: 'success' })
        } catch (err) {
            setSnack({ open: true, msg: 'Error al generar el PDF', severity: 'error' })
        } finally { setPdfLoading(false) }
    }

    const openCreateModal = () => {
        setForm(emptyForm); setAssignmentsDraft([]); setEditingOwnUnitIds(null)
        setAssignCategory(''); setAssignSkuSearch(''); setAssignPage(0)
        setOpenCreate(true)
    }

    const handleCreate = () => {
        const created = createRental(form, assignmentsDraft)
        setOpenCreate(false)
        setSnack({ open: true, msg: `Arriendo ${created.orderNumber} creado.`, severity: 'success' })
    }

    /* EDITAR — antes no existía ninguna forma de editar un arriendo creado,
       solo anularlo y crear uno nuevo desde cero. */
    const openEditModal = () => {
        setForm({
            name: currentRental.name, date: currentRental.date, endDate: currentRental.endDate || '',
            clientName: currentRental.clientName || '', staffIds: currentRental.staffIds || [],
            notes: currentRental.notes || ''
        })
        setAssignmentsDraft(currentRental.assignments || [])
        const ownIds = {}
        for (const a of (currentRental.assignments || [])) ownIds[a.productId] = a.unitIds || []
        setEditingOwnUnitIds(ownIds)
        setAssignCategory(''); setAssignSkuSearch(''); setAssignPage(0)
        setOpenDetail(false); setOpenEdit(true)
    }

    const handleSaveEdit = () => {
        updateRental(currentRental.id, form, assignmentsDraft)
        setOpenEdit(false); setEditingOwnUnitIds(null); setCurrentRental(null)
        setSnack({ open: true, msg: 'Arriendo actualizado. Inventario recalculado.', severity: 'info' })
    }

    /* CANCELAR / SOLICITAR CANCELACIÓN — mismo flujo de 3 modos que Events.jsx:
       admin cancela directo, operador solicita y admin aprueba/rechaza.
       Antes "Anular" era un borrado directo sin motivo y solo para admin,
       sin dejar ningún rastro ni darle al operador ninguna vía. */
    const openDeleteModal = (r, mode = 'direct') => {
        setRentalToDelete(r); setDeleteMode(mode)
        setCancelReason(mode === 'approve' ? (r.pendingDeleteReason || '') : '')
        setOpenDeleteConfirm(true)
    }
    const handleDeleteConfirm = () => {
        if (deleteMode === 'request') {
            requestDeleteRental(rentalToDelete.id, roleLabel, cancelReason.trim())
            setSnack({ open: true, msg: 'Solicitud de cancelación enviada. Un administrador debe aprobarla.', severity: 'info' })
        } else {
            cancelRental(rentalToDelete.id, cancelReason.trim(), roleLabel)
            setSnack({ open: true, msg: 'Arriendo cancelado. Inventario restaurado a disponible.', severity: 'warning' })
        }
        setOpenDeleteConfirm(false); setRentalToDelete(null); setOpenDetail(false); setCancelReason('')
    }
    const handleRejectDelete = (r) => {
        cancelDeleteRental(r.id)
        setSnack({ open: true, msg: 'Solicitud de cancelación rechazada.', severity: 'success' })
    }

    const filteredRentals = rentals.filter(r =>
        !search ||
        r.name?.toLowerCase().includes(search.toLowerCase()) ||
        r.orderNumber?.toLowerCase().includes(search.toLowerCase()) ||
        r.clientName?.toLowerCase().includes(search.toLowerCase())
    )

    const getProduct = id => products.find(p => p.id === id)
    const isFinal = (r) => ['Realizado', 'Concluido', 'Cancelado'].includes(r?.status)

    const assignPanelProps = React.useMemo(() => ({
        products, assignSkuSearch, setAssignSkuSearch,
        assignCategory, setAssignCategory,
        assignPage, setAssignPage,
        assignmentsDraft, totalAssigned, setQty, availableFor
    }), [products, assignSkuSearch, assignCategory, assignPage, assignmentsDraft, totalAssigned, setQty, availableFor])

    return (
        <Box>
            <Typography variant="h5" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <HandshakeIcon /> Rental
            </Typography>

            <Paper sx={{ p: 2, mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                    <TextField size="small" placeholder="Buscar por nombre, cliente o N° guía…"
                        value={search} onChange={e => setSearch(e.target.value)} sx={{ minWidth: 260 }}
                        InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }} />
                    <TextField size="small" placeholder="N° de guía (ej: RNT-201)"
                        value={guideSearch} onChange={e => setGuideSearch(e.target.value)} sx={{ width: 200 }}
                        InputProps={{ startAdornment: <InputAdornment position="start"><EventIcon fontSize="small" /></InputAdornment> }} />
                    <Button variant="contained" size="small" startIcon={<SearchIcon />} sx={{ height: 40 }}
                        onClick={() => {
                            const q = guideSearch.trim().toUpperCase()
                            const found = rentals.find(r => r.orderNumber?.toUpperCase().includes(q))
                            if (found) { setCurrentRental(found); setOpenDetail(true) }
                            else setSnack({ open: true, msg: `No se encontró "${guideSearch}"`, severity: 'warning' })
                        }}>
                        Buscar
                    </Button>
                </Box>
                <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateModal}
                    sx={{ background: '#66FCF1', color: '#0B0C10', '&:hover': { background: '#45e8d5' } }}>
                    Nuevo Arriendo
                </Button>
            </Paper>

            <Paper sx={{ p: 2 }}>
                {filteredRentals.length === 0 ? (
                    <Box sx={{ textAlign: 'center', py: 6 }}>
                        <HandshakeIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                        <Typography color="text.secondary">No hay arriendos. Crea el primero.</Typography>
                    </Box>
                ) : (
                    <List disablePadding>
                        {filteredRentals.map((r, idx) => (
                            <React.Fragment key={r.id}>
                                {idx > 0 && <Divider />}
                                <ListItem sx={{ py: 1.5 }}
                                    secondaryAction={
                                        <Box sx={{ display: 'flex', gap: 1 }}>
                                            <Tooltip title="Descargar PDF"><span>
                                                <Button size="small" variant="outlined" color="primary"
                                                    onClick={() => handleDownloadPDF(r)} disabled={pdfLoading}
                                                    startIcon={pdfLoading ? <CircularProgress size={14} /> : <PictureAsPdfIcon />}>
                                                    PDF
                                                </Button>
                                            </span></Tooltip>
                                            <Button size="small" variant="outlined" onClick={() => { setCurrentRental(r); setOpenDetail(true) }}>Detalle</Button>

                                            {role === 'admin' && !r.pendingDelete && !isFinal(r) && (
                                                <Tooltip title="Cancelar arriendo y restaurar inventario">
                                                    <Button size="small" variant="outlined" color="error" startIcon={<DeleteIcon />}
                                                        onClick={() => openDeleteModal(r, 'direct')}>
                                                        Anular
                                                    </Button>
                                                </Tooltip>
                                            )}
                                            {role === 'admin' && r.pendingDelete && (
                                                <>
                                                    <Tooltip title={`Solicitado por ${r.pendingDeleteBy || 'Operador'}`}>
                                                        <Button size="small" variant="contained" color="error"
                                                            startIcon={<DeleteIcon />} onClick={() => openDeleteModal(r, 'approve')}>
                                                            Aprobar y anular
                                                        </Button>
                                                    </Tooltip>
                                                    <Button size="small" variant="outlined" onClick={() => handleRejectDelete(r)}>
                                                        Rechazar
                                                    </Button>
                                                </>
                                            )}
                                            {role === 'operador' && !r.pendingDelete && !isFinal(r) && (
                                                <Tooltip title="Enviar solicitud de cancelación a un administrador">
                                                    <Button size="small" variant="outlined" color="error" startIcon={<DeleteIcon />}
                                                        onClick={() => openDeleteModal(r, 'request')}>
                                                        Solicitar cancelación
                                                    </Button>
                                                </Tooltip>
                                            )}
                                        </Box>
                                    }>
                                    <ListItemText
                                        primary={
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                                                <Typography variant="body1" fontWeight={600}>{r.name}</Typography>
                                                <Chip label={r.orderNumber} size="small" color="warning" variant="outlined" sx={{ fontSize: 10 }} />
                                                <Chip label={r.status} size="small" color={RENTAL_STATUS_COLORS[r.status] || 'warning'} />
                                                {r.pendingDelete && (
                                                    <Chip label={`Pendiente de cancelación${r.pendingDeleteReason ? ': ' + r.pendingDeleteReason : ''}`} size="small" color="error"
                                                        sx={{ fontWeight: 600 }} />
                                                )}
                                            </Box>
                                        }
                                        secondary={
                                            <Box>
                                                <Box sx={{ display: 'flex', gap: 2, mt: 0.5, flexWrap: 'wrap' }}>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                        <EventIcon sx={{ fontSize: 13 }} />
                                                        <Typography variant="caption">{r.date}{r.endDate ? ` → ${r.endDate}` : ''}</Typography>
                                                    </Box>
                                                    {r.clientName && (
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                            <PersonIcon sx={{ fontSize: 13 }} />
                                                            <Typography variant="caption">{r.clientName}</Typography>
                                                        </Box>
                                                    )}
                                                    <Typography variant="caption" color="warning.main">
                                                        {(r.assignments || []).reduce((s, a) => s + a.qty, 0)} artículos
                                                    </Typography>
                                                </Box>
                                                {r.status === 'Cancelado' && (
                                                    <Typography variant="caption" color="error.main" sx={{ display: 'block', mt: 0.5 }}>
                                                        Motivo de cancelación: {r.cancelReason || 'Sin motivo especificado'}
                                                        {r.cancelledBy ? ` — ${r.cancelledBy}` : ''}
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

            {/* MODAL DETALLE */}
            <Dialog open={openDetail} onClose={() => setOpenDetail(false)} fullWidth maxWidth="sm">
                <DialogTitle>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {currentRental?.name}
                        <Chip label={currentRental?.orderNumber} size="small" color="warning" variant="outlined" />
                    </Box>
                </DialogTitle>
                <DialogContent>
                    {currentRental && (() => {
                        const grouped = {}
                        for (const a of (currentRental.assignments || [])) {
                            if (a.qty === 0) continue
                            const p = getProduct(a.productId); if (!p) continue
                            if (!grouped[p.category]) grouped[p.category] = []
                            grouped[p.category].push({ p, qty: a.qty })
                        }
                        return (
                            <>
                                <Box sx={{ display: 'flex', gap: 3, mb: 2, flexWrap: 'wrap' }}>
                                    <Box><Typography variant="caption" color="text.secondary">FECHA INICIO</Typography><Typography>{currentRental.date}</Typography></Box>
                                    <Box><Typography variant="caption" color="text.secondary">FECHA FIN</Typography><Typography>{currentRental.endDate || '—'}</Typography></Box>
                                    <Box><Typography variant="caption" color="text.secondary">CLIENTE</Typography><Typography>{currentRental.clientName || '—'}</Typography></Box>
                                </Box>
                                {currentRental.notes && <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{currentRental.notes}</Typography>}
                                {currentRental.staffIds?.length > 0 && (
                                    <Box sx={{ mb: 2 }}>
                                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>PERSONAL ASIGNADO</Typography>
                                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                                            {currentRental.staffIds.map(id => {
                                                const p = staffList.find(s => s.id === id)
                                                return p ? <Chip key={id} label={`${p.nombre} ${p.apellido}`} size="small" variant="outlined" /> : null
                                            })}
                                        </Box>
                                    </Box>
                                )}
                                {currentRental.status === 'Cancelado' && (
                                    <Alert severity="error" sx={{ mb: 2 }}>
                                        Cancelado por {currentRental.cancelledBy || 'Administrador'}: {currentRental.cancelReason || 'Sin motivo especificado'}
                                    </Alert>
                                )}
                                <Divider sx={{ mb: 1.5 }} />
                                <Typography variant="subtitle2" gutterBottom>Equipos arrendados</Typography>
                                {Object.entries(grouped).map(([cat, items]) => (
                                    <Box key={cat} sx={{ mb: 1.5 }}>
                                        <Typography variant="caption" color="warning.main" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>{cat}</Typography>
                                        {items.map(({ p, qty }) => (
                                            <Box key={p.id} sx={{ display: 'flex', justifyContent: 'space-between', pl: 1 }}>
                                                <Typography variant="body2">{p.name}</Typography>
                                                <Typography variant="body2" color="warning.main">×{qty}</Typography>
                                            </Box>
                                        ))}
                                    </Box>
                                ))}
                            </>
                        )
                    })()}
                </DialogContent>
                <DialogActions>
                    <Button startIcon={pdfLoading ? <CircularProgress size={16} /> : <PictureAsPdfIcon />}
                        onClick={() => handleDownloadPDF(currentRental)} disabled={pdfLoading}>
                        {pdfLoading ? 'Generando…' : 'Descargar PDF'}
                    </Button>
                    {role === 'admin' && !isFinal(currentRental) && (
                        <Button onClick={openEditModal}>Editar</Button>
                    )}
                    {role === 'admin' && !isFinal(currentRental) && (
                        <Button color="error" startIcon={<DeleteIcon />}
                            onClick={() => { setOpenDetail(false); openDeleteModal(currentRental, 'direct') }}>
                            Anular arriendo
                        </Button>
                    )}
                    <Button onClick={() => setOpenDetail(false)}>Cerrar</Button>
                </DialogActions>
            </Dialog>

            {/* MODAL CANCELAR / SOLICITAR CANCELACIÓN — pide motivo obligatorio,
                igual que Events.jsx, con sus 3 modos (directo/solicitar/aprobar). */}
            <Dialog open={openDeleteConfirm} onClose={() => setOpenDeleteConfirm(false)} maxWidth="xs" fullWidth>
                <DialogTitle sx={{ color: 'error.main', display: 'flex', alignItems: 'center', gap: 1 }}>
                    <DeleteIcon /> {deleteMode === 'request' ? 'Solicitar cancelación' : deleteMode === 'approve' ? 'Aprobar cancelación' : 'Anular arriendo'}
                </DialogTitle>
                <DialogContent>
                    {deleteMode === 'request' ? (
                        <>
                            <Typography variant="body1" gutterBottom>
                                ¿Enviar solicitud de cancelación para <strong>{rentalToDelete?.name}</strong> ({rentalToDelete?.orderNumber})?
                            </Typography>
                            <Alert severity="info" sx={{ mt: 1, mb: 2 }}>
                                El arriendo quedará marcado en rojo hasta que un administrador la apruebe o la rechace. No se cancela todavía.
                            </Alert>
                        </>
                    ) : (
                        <>
                            <Typography variant="body1" gutterBottom>
                                {deleteMode === 'approve' ? '¿Aprobar la cancelación de ' : '¿Estás seguro de anular '}
                                <strong>{rentalToDelete?.name}</strong> ({rentalToDelete?.orderNumber})?
                            </Typography>
                            <Alert severity="warning" sx={{ mt: 1, mb: 2 }}>
                                Los equipos en Rental volverán a estar <strong>Disponibles</strong> en el inventario. El arriendo
                                queda visible como "Cancelado" con el motivo que escribas abajo.
                            </Alert>
                        </>
                    )}
                    <TextField
                        label="Motivo de la cancelación" required autoFocus fullWidth multiline minRows={2}
                        value={cancelReason} onChange={e => setCancelReason(e.target.value)}
                        placeholder="Ej: el cliente canceló el arriendo"
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenDeleteConfirm(false)}>Volver</Button>
                    <Button variant="contained" color="error" startIcon={<DeleteIcon />}
                        disabled={!cancelReason.trim()} onClick={handleDeleteConfirm}>
                        {deleteMode === 'request' ? 'Enviar solicitud' : deleteMode === 'approve' ? 'Aprobar y anular' : 'Anular y restaurar inventario'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* MODAL CREAR */}
            <Dialog open={openCreate} onClose={() => setOpenCreate(false)} fullWidth maxWidth="sm">
                <DialogTitle>Nuevo Arriendo</DialogTitle>
                <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
                    <TextField label="Nombre del arriendo" value={form.name}
                        onChange={e => setForm({ ...form, name: e.target.value })} />
                    <Box sx={{ display: 'flex', gap: 2 }}>
                        <TextField type="date" label="Fecha inicio" InputLabelProps={{ shrink: true }}
                            value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} sx={{ flex: 1 }} />
                        <TextField type="date" label="Fecha fin" InputLabelProps={{ shrink: true }}
                            value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} sx={{ flex: 1 }} />
                    </Box>
                    <TextField label="Nombre cliente" value={form.clientName}
                        onChange={e => setForm({ ...form, clientName: e.target.value })}
                        InputProps={{ startAdornment: <InputAdornment position="start"><PersonIcon fontSize="small" /></InputAdornment> }} />
                    <TextField label="Notas" multiline minRows={2} value={form.notes}
                        onChange={e => setForm({ ...form, notes: e.target.value })} />
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
                    <Typography variant="subtitle2" color="warning.main">Asignar equipos</Typography>
                    <AssignPanel {...assignPanelProps} />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenCreate(false)}>Cancelar</Button>
                    <Button variant="contained" onClick={handleCreate}
                        disabled={!form.name || !form.date}
                        sx={{ background: '#66FCF1', color: '#0B0C10', '&:hover': { background: '#45e8d5' } }}>
                        Guardar arriendo
                    </Button>
                </DialogActions>
            </Dialog>

            {/* MODAL EDITAR — antes no existía ninguna forma de editar un
                arriendo ya creado. */}
            <Dialog open={openEdit} onClose={() => setOpenEdit(false)} fullWidth maxWidth="sm">
                <DialogTitle>Editar arriendo</DialogTitle>
                <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
                    <TextField label="Nombre del arriendo" value={form.name}
                        onChange={e => setForm({ ...form, name: e.target.value })} />
                    <Box sx={{ display: 'flex', gap: 2 }}>
                        <TextField type="date" label="Fecha inicio" InputLabelProps={{ shrink: true }}
                            value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} sx={{ flex: 1 }} />
                        <TextField type="date" label="Fecha fin" InputLabelProps={{ shrink: true }}
                            value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} sx={{ flex: 1 }} />
                    </Box>
                    <TextField label="Nombre cliente" value={form.clientName}
                        onChange={e => setForm({ ...form, clientName: e.target.value })}
                        InputProps={{ startAdornment: <InputAdornment position="start"><PersonIcon fontSize="small" /></InputAdornment> }} />
                    <TextField label="Notas" multiline minRows={2} value={form.notes}
                        onChange={e => setForm({ ...form, notes: e.target.value })} />
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
                    <Typography variant="subtitle2" color="warning.main">Equipos asignados</Typography>
                    <AssignPanel {...assignPanelProps} />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenEdit(false)}>Cancelar</Button>
                    <Button variant="contained" onClick={handleSaveEdit} disabled={!form.name || !form.date}>Guardar cambios</Button>
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
