import React from 'react'
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  TextField, MenuItem, Button, Chip, Dialog, DialogTitle, DialogContent,
  DialogActions, Select, Alert, Tooltip, Pagination, Autocomplete
} from '@mui/material'
import CalendarTodayIcon from '@mui/icons-material/CalendarToday'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import { useInventory } from '../context/InventoryContext'
import { useAuth } from '../context/AuthContext'

const STATES = ['Disponible', 'Reservado', 'Ocupado', 'Rental', 'En Mantenimiento', 'Perdido']
const ROWS_PER_PAGE = 15

const stateColors = {
  Disponible: 'success',
  Reservado: 'secondary',
  Ocupado: 'warning',
  Rental: 'info',
  'En Mantenimiento': 'info',
  Perdido: 'error'
}

const todayStr = () => new Date().toISOString().slice(0, 10)

export default function Inventory() {
  const {
    products, setProducts, getAvailableQty, getReservedQty,
    addProduct, deleteProduct, requestDeleteProduct, cancelDeleteProduct, nextSkuForFamily
  } = useInventory()
  const { role } = useAuth()
  const currentUser = role === 'admin' ? 'Administrador' : 'Operador'

  const [categories, setCategories] = React.useState([])
  const [filter, setFilter] = React.useState({ sku: '', category: '', state: '' })
  const [consulDate, setConsulDate] = React.useState(todayStr())
  const [detail, setDetail] = React.useState(null)
  const [draftDetail, setDraftDetail] = React.useState(null)
  const [openAdd, setOpenAdd] = React.useState(false)
  const [confirmDeleteProduct, setConfirmDeleteProduct] = React.useState(false)
  // 'direct' (admin elimina ya) | 'request' (operador solo solicita) | 'approve' (admin aprueba una solicitud pendiente)
  const [deleteMode, setDeleteMode] = React.useState('direct')
  const [newProduct, setNewProduct] = React.useState({ name: '', skuFamily: '', sku: '', category: '', qty: '', description: '' })
  const [page, setPage] = React.useState(1)

  React.useEffect(() => {
    const cats = [...new Set(products.map(p => p.category).filter(Boolean))]
    setCategories(cats)
  }, [products])

  // Familias de SKU existentes (ej. "ILU", "AUD") para sugerir mientras se escribe
  const skuFamilies = React.useMemo(() => {
    return [...new Set(products.map(p => p.sku?.split('-')[0]).filter(Boolean))]
  }, [products])

  // Reset page when filter changes
  React.useEffect(() => { setPage(1) }, [filter, consulDate])

  const countForDate = (product, state) => {
    // Vista de "hoy": refleja el estado físico real de cada unidad —
    // siempre suma exactamente el total del producto, sin doble conteo.
    if (consulDate === todayStr()) {
      return product.units.filter(u => u.state === state).length
    }
    // Vista a una fecha futura: proyección basada en reservas de eventos
    // activos para esa fecha (no hay forma de saber el estado físico real
    // de algo que aún no ocurre).
    if (state === 'Disponible') return getAvailableQty(product.id, consulDate)
    if (state === 'Reservado') return getReservedQty(product.id, consulDate)
    return product.units.filter(u => u.state === state).length
  }

  const filteredProducts = products.filter(p =>
    (filter.sku ? (
      p.sku.toLowerCase().includes(filter.sku.toLowerCase()) ||
      p.name.toLowerCase().includes(filter.sku.toLowerCase())
    ) : true) &&
    (filter.category ? p.category === filter.category : true) &&
    (filter.state ? countForDate(p, filter.state) > 0 : true)
  )

  const totalPages = Math.ceil(filteredProducts.length / ROWS_PER_PAGE)
  const paginated = filteredProducts.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE)

  const isToday = consulDate === todayStr()
  const isFuture = consulDate > todayStr()

  const updateUnitState = (unitId, newState) => {
    setDraftDetail(prev => ({
      ...prev,
      units: prev.units.map(u => u.id === unitId ? { ...u, state: newState } : u)
    }))
  }

  const saveDetailChanges = () => {
    setProducts(products.map(p => p.id === draftDetail.id ? draftDetail : p))
    setDetail(null)
    setDraftDetail(null)
  }

  const openDeleteProductModal = (mode) => {
    setDeleteMode(mode)
    setConfirmDeleteProduct(true)
  }

  const handleDeleteProduct = () => {
    if (deleteMode === 'request') {
      requestDeleteProduct(detail.id, currentUser)
    } else {
      deleteProduct(detail.id)
    }
    setConfirmDeleteProduct(false)
    setDetail(null)
    setDraftDetail(null)
  }

  const handleRejectDeleteProduct = (p, e) => {
    e.stopPropagation()
    cancelDeleteProduct(p.id)
  }

  const handleAddProduct = () => {
    // El código RFID base usa el mismo SKU (misma nomenclatura), no se pide por separado
    addProduct({ ...newProduct, rfid: newProduct.sku }, currentUser)
    setOpenAdd(false)
    setNewProduct({ name: '', skuFamily: '', sku: '', category: '', qty: '', description: '' })
  }

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>Inventario General</Typography>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <TextField label="SKU o nombre" size="small" sx={{ minWidth: 160 }}
              value={filter.sku} onChange={e => setFilter({ ...filter, sku: e.target.value })} />
            <TextField select label="Categoría" size="small" sx={{ minWidth: 160 }}
              value={filter.category} onChange={e => setFilter({ ...filter, category: e.target.value })}>
              <MenuItem value="">Todas</MenuItem>
              {categories.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </TextField>
            <TextField select label="Estado" size="small" sx={{ minWidth: 180 }}
              value={filter.state} onChange={e => setFilter({ ...filter, state: e.target.value })}>
              <MenuItem value="">Todos</MenuItem>
              {STATES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
            </TextField>

            <Tooltip title="Consulta la disponibilidad para una fecha específica.">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CalendarTodayIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                <TextField
                  type="date"
                  size="small"
                  label="Disponibilidad al día"
                  InputLabelProps={{ shrink: true }}
                  value={consulDate}
                  onChange={e => setConsulDate(e.target.value)}
                  sx={{ width: 200 }}
                />
                <InfoOutlinedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
              </Box>
            </Tooltip>
          </Box>

          <Button variant="contained" color="success" onClick={() => setOpenAdd(true)} sx={{ whiteSpace: 'nowrap' }}>
            Agregar producto
          </Button>
        </Box>

        {!isToday && (
          <Alert severity={isFuture ? 'info' : 'warning'} sx={{ mt: 2, py: 0.5 }} icon={<CalendarTodayIcon fontSize="small" />}>
            {isFuture
              ? `Mostrando disponibilidad para el ${consulDate} — los artículos reservados para esa fecha están descontados.`
              : `Fecha pasada (${consulDate}). La disponibilidad mostrada es histórica.`
            }
          </Alert>
        )}
      </Paper>

      <Paper sx={{ p: 2 }}>
        {/* Info de paginación */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Mostrando {((page - 1) * ROWS_PER_PAGE) + 1}–{Math.min(page * ROWS_PER_PAGE, filteredProducts.length)} de {filteredProducts.length} productos
          </Typography>
          {totalPages > 1 && (
            <Pagination
              count={totalPages}
              page={page}
              onChange={(_, val) => setPage(val)}
              color="primary"
              size="small"
            />
          )}
        </Box>

        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Producto</TableCell>
              <TableCell>SKU</TableCell>
              <TableCell>Categoría</TableCell>
              <TableCell align="center">Total</TableCell>
              {STATES.map(s => (
                <TableCell key={s} align="center">
                  <Tooltip title={
                    s === 'Disponible' ? `Libre para el ${consulDate}` :
                      s === 'Reservado' ? `Comprometido para el ${consulDate}` : s
                  }>
                    <span>{s}</span>
                  </Tooltip>
                </TableCell>
              ))}
              <TableCell>Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {paginated.map(p => (
              <TableRow key={p.id} sx={
                p.pendingDelete
                  ? { bgcolor: 'rgba(244,67,54,0.1)', borderLeft: '3px solid #f44336' }
                  : p.total === 0 ? { opacity: 0.5, bgcolor: 'rgba(244,67,54,0.06)' } : {}
              }>
                <TableCell>
                  {p.name}
                  {p.total === 0 && (
                    <Chip size="small" label="Sin stock" color="error" sx={{ ml: 1 }} />
                  )}
                  {p.pendingDelete && (
                    <Tooltip title={`Solicitado por ${p.pendingDeleteBy || 'Operador'}`}>
                      <Chip size="small" label="Pendiente de eliminación" color="error" sx={{ ml: 1, fontWeight: 600 }} />
                    </Tooltip>
                  )}
                </TableCell>
                <TableCell>{p.sku}</TableCell>
                <TableCell>{p.category}</TableCell>
                <TableCell align="center">{p.total}</TableCell>
                {STATES.map(s => (
                  <TableCell key={s} align="center">
                    <Chip size="small" label={countForDate(p, s)}
                      color={stateColors[s]}
                      sx={s === 'Rental' ? { bgcolor: '#7F77DD', color: '#fff', '& .MuiChip-label': { color: '#fff' } } : {}}
                    />
                  </TableCell>
                ))}
                <TableCell>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Button size="small" variant="outlined"
                      onClick={() => { setDetail(p); setDraftDetail(JSON.parse(JSON.stringify(p))) }}>
                      Detalle
                    </Button>
                    {role === 'admin' && p.pendingDelete && (
                      <>
                        <Button size="small" variant="contained" color="error"
                          onClick={() => { setDetail(p); openDeleteProductModal('approve') }}>
                          Aprobar
                        </Button>
                        <Button size="small" variant="outlined"
                          onClick={(e) => handleRejectDeleteProduct(p, e)}>
                          Rechazar
                        </Button>
                      </>
                    )}
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Paginación abajo */}
        {totalPages > 1 && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
            <Pagination
              count={totalPages}
              page={page}
              onChange={(_, val) => { setPage(val); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
              color="primary"
            />
          </Box>
        )}
      </Paper>

      {/* ═══ MODAL DETALLE DE UNIDADES ═══ */}
      <Dialog open={Boolean(detail)} onClose={() => { setDetail(null); setDraftDetail(null) }} fullWidth maxWidth="md">
        <DialogTitle>Unidades — {detail?.name}</DialogTitle>
        <DialogContent>
          {draftDetail && (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>ID Unidad</TableCell>
                  <TableCell>Código RFID</TableCell>
                  <TableCell>Estado actual</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {draftDetail.units.map(u => (
                  <TableRow key={u.id}>
                    <TableCell>{u.id}</TableCell>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{u.rfid}</TableCell>
                    <TableCell>
                      <Select size="small" value={u.state}
                        onChange={e => updateUnitState(u.id, e.target.value)}>
                        {STATES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
        <DialogActions>
          {detail?.pendingDelete ? (
            role === 'admin' ? (
              <Box sx={{ mr: 'auto', display: 'flex', gap: 1 }}>
                <Button variant="contained" color="error" onClick={() => openDeleteProductModal('approve')}>
                  Aprobar y eliminar
                </Button>
                <Button variant="outlined" onClick={(e) => handleRejectDeleteProduct(detail, e)}>
                  Rechazar solicitud
                </Button>
              </Box>
            ) : (
              <Chip label="Pendiente de aprobación del administrador" color="error" sx={{ mr: 'auto' }} />
            )
          ) : (
            <Button color="error" onClick={() => openDeleteProductModal(role === 'admin' ? 'direct' : 'request')} sx={{ mr: 'auto' }}>
              {role === 'admin' ? 'Eliminar producto' : 'Solicitar eliminación'}
            </Button>
          )}
          <Button onClick={() => { setDetail(null); setDraftDetail(null) }}>Cancelar</Button>
          <Button variant="contained" onClick={saveDetailChanges}>Guardar cambios</Button>
        </DialogActions>
      </Dialog>

      {/* ═══ MODAL CONFIRMAR ELIMINACIÓN DE PRODUCTO ═══ */}
      <Dialog open={confirmDeleteProduct} onClose={() => setConfirmDeleteProduct(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ color: 'error.main' }}>
          {deleteMode === 'request' ? 'Solicitar eliminación' : 'Eliminar producto'}
        </DialogTitle>
        <DialogContent>
          {deleteMode === 'request' ? (
            <>
              <Typography gutterBottom>
                ¿Enviar solicitud de eliminación de <strong>{detail?.name}</strong>?
              </Typography>
              <Alert severity="info" sx={{ mt: 1 }}>
                Quedará marcado en rojo en el inventario hasta que un administrador la apruebe o la rechace. No se elimina todavía.
              </Alert>
            </>
          ) : (
            <Typography>
              ¿Seguro que quieres eliminar <strong>{detail?.name}</strong> y todas sus unidades del inventario?
              Esta acción no se puede deshacer.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDeleteProduct(false)}>Cancelar</Button>
          <Button variant="contained" color="error" onClick={handleDeleteProduct}>
            {deleteMode === 'request' ? 'Enviar solicitud' : 'Eliminar definitivamente'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ═══ MODAL AGREGAR PRODUCTO ═══ */}
      <Dialog open={openAdd} onClose={() => setOpenAdd(false)} fullWidth>
        <DialogTitle>Agregar producto</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <TextField label="Nombre" value={newProduct.name}
            onChange={e => setNewProduct({ ...newProduct, name: e.target.value })} />
          <Autocomplete
            freeSolo
            options={skuFamilies}
            inputValue={newProduct.skuFamily}
            onInputChange={(_, value) => setNewProduct(prev => ({
              ...prev, skuFamily: value, sku: nextSkuForFamily(value)
            }))}
            renderInput={(params) => (
              <TextField {...params} label="Familia SKU"
                helperText="Escribe la familia (ej: ILU, AUD) — el número correlativo se asigna solo" />
            )}
          />
          <TextField label="SKU asignado" value={newProduct.sku} disabled
            helperText={newProduct.sku ? 'Se generó automáticamente, no se puede editar' : 'Aparece al elegir la familia'} />
          <TextField label="Descripción" value={newProduct.description}
            onChange={e => setNewProduct({ ...newProduct, description: e.target.value })} />
          <TextField select label="Categoría" value={newProduct.category}
            onChange={e => setNewProduct({ ...newProduct, category: e.target.value })}>
            {['Audio', 'Iluminacion', 'Pantalla', 'Efectos', 'Estructuras', 'Energía', 'Tecnologia', 'Otros'].map(c => (
              <MenuItem key={c} value={c}>{c}</MenuItem>
            ))}
          </TextField>
          <TextField type="number" label="Cantidad" value={newProduct.qty}
            onChange={e => setNewProduct({ ...newProduct, qty: e.target.value })} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenAdd(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleAddProduct}
            disabled={!newProduct.name || !newProduct.sku || !newProduct.qty}>
            Guardar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}