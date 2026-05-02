import React from 'react'
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  TextField, MenuItem, Button, Chip, Dialog, DialogTitle, DialogContent,
  DialogActions, Select, Alert, Tooltip, Pagination
} from '@mui/material'
import CalendarTodayIcon from '@mui/icons-material/CalendarToday'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import { useInventory } from '../context/InventoryContext'

const STATES = ['Disponible', 'Reservado', 'Ocupado', 'En Mantenimiento', 'Perdido']
const ROWS_PER_PAGE = 15

const stateColors = {
  Disponible: 'success',
  Reservado: 'secondary',
  Ocupado: 'warning',
  'En Mantenimiento': 'info',
  Perdido: 'error'
}

const todayStr = () => new Date().toISOString().slice(0, 10)

export default function Inventory() {
  const { products, setProducts, getAvailableQty, addProduct } = useInventory()

  const [categories, setCategories] = React.useState([])
  const [filter, setFilter] = React.useState({ sku: '', category: '', state: '' })
  const [consulDate, setConsulDate] = React.useState(todayStr())
  const [detail, setDetail] = React.useState(null)
  const [draftDetail, setDraftDetail] = React.useState(null)
  const [openAdd, setOpenAdd] = React.useState(false)
  const [newProduct, setNewProduct] = React.useState({ name: '', sku: '', category: '', qty: '', rfid: '', description: '' })
  const [page, setPage] = React.useState(1)

  React.useEffect(() => {
    const cats = [...new Set(products.map(p => p.category).filter(Boolean))]
    setCategories(cats)
  }, [products])

  // Reset page when filter changes
  React.useEffect(() => { setPage(1) }, [filter, consulDate])

  const countForDate = (product, state) => {
    if (state === 'Disponible') return getAvailableQty(product.id, consulDate)
    if (state === 'Reservado') {
      const avail = getAvailableQty(product.id, consulDate)
      const blocked = product.units.filter(u =>
        ['Ocupado', 'En Mantenimiento', 'Perdido'].includes(u.state)
      ).length
      return Math.max(product.total - avail - blocked, 0)
    }
    return product.units.filter(u => u.state === state).length
  }

  const filteredProducts = products.filter(p =>
    (filter.sku ? p.sku.toLowerCase().includes(filter.sku.toLowerCase()) : true) &&
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

  const handleAddProduct = () => {
    addProduct(newProduct)
    setOpenAdd(false)
    setNewProduct({ name: '', sku: '', category: '', qty: '', rfid: '', description: '' })
  }

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>Inventario General</Typography>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <TextField label="SKU" size="small" sx={{ minWidth: 140 }}
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
                    s === 'Reservado'  ? `Comprometido para el ${consulDate}` : s
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
              <TableRow key={p.id}>
                <TableCell>{p.name}</TableCell>
                <TableCell>{p.sku}</TableCell>
                <TableCell>{p.category}</TableCell>
                <TableCell align="center">{p.total}</TableCell>
                {STATES.map(s => (
                  <TableCell key={s} align="center">
                    <Chip size="small" label={countForDate(p, s)} color={stateColors[s]} />
                  </TableCell>
                ))}
                <TableCell>
                  <Button size="small" variant="outlined"
                    onClick={() => { setDetail(p); setDraftDetail(JSON.parse(JSON.stringify(p))) }}>
                    Detalle
                  </Button>
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
          <Button onClick={() => { setDetail(null); setDraftDetail(null) }}>Cancelar</Button>
          <Button variant="contained" onClick={saveDetailChanges}>Guardar cambios</Button>
        </DialogActions>
      </Dialog>

      {/* ═══ MODAL AGREGAR PRODUCTO ═══ */}
      <Dialog open={openAdd} onClose={() => setOpenAdd(false)} fullWidth>
        <DialogTitle>Agregar producto</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <TextField label="Nombre" value={newProduct.name}
            onChange={e => setNewProduct({ ...newProduct, name: e.target.value })} />
          <TextField label="SKU" value={newProduct.sku}
            onChange={e => setNewProduct({ ...newProduct, sku: e.target.value })} />
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
          <TextField label="RFID base" value={newProduct.rfid}
            helperText="Ej: RFID-AUD-010"
            onChange={e => setNewProduct({ ...newProduct, rfid: e.target.value })} />
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
