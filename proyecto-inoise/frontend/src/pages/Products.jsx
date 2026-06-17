import React from 'react'
import {
  Box, Typography, Paper, List, ListItem, ListItemText,
  Chip, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, Checkbox, Alert, Divider, TextField,
  InputAdornment, LinearProgress
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import LinkIcon from '@mui/icons-material/Link'
import LinkOffIcon from '@mui/icons-material/LinkOff'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked'
import { useInventory } from '../context/InventoryContext'

// "3-5" → "Unidad 5"
const unitLabel = (id) => {
  const parts = String(id).split('-')
  return `Unidad ${parts[parts.length - 1]}`
}

export default function Products() {
  const { products, epcMap, unlinkEpc, unlinkAllForProduct } = useInventory()

  const [search, setSearch] = React.useState('')
  const [openModal, setOpenModal] = React.useState(false)
  const [modalProduct, setModalProduct] = React.useState(null)
  const [toUnlink, setToUnlink] = React.useState([])

  // Mapa inverso unitId → epc
  const unitToEpc = React.useMemo(() => {
    const map = {}
    Object.entries(epcMap || {}).forEach(([epc, uid]) => { map[uid] = epc })
    return map
  }, [epcMap])

  const getLinkedCount = (product) =>
    product.units.filter(u => unitToEpc[u.id]).length

  const filteredProducts = products.filter(p =>
    !search ||
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku.toLowerCase().includes(search.toLowerCase()) ||
    p.category.toLowerCase().includes(search.toLowerCase())
  )

  const openReview = (product) => {
    setModalProduct(product)
    setToUnlink([])
    setOpenModal(true)
  }

  const handleUnlinkSelected = () => {
    toUnlink.forEach(unitId => {
      const epc = unitToEpc[unitId]
      if (epc) unlinkEpc(epc)
    })
    setToUnlink([])
    setOpenModal(false)
  }

  const handleUnlinkAll = () => {
    unlinkAllForProduct(modalProduct.id)
    setToUnlink([])
    setOpenModal(false)
  }

  const toggleUnit = (unitId) => {
    setToUnlink(prev =>
      prev.includes(unitId) ? prev.filter(id => id !== unitId) : [...prev, unitId]
    )
  }

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>Productos Vinculados</Typography>

      <Paper sx={{ p: 2, mb: 2 }}>
        <TextField fullWidth size="small" placeholder="Buscar por nombre, SKU o categoría..."
          value={search} onChange={e => setSearch(e.target.value)}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }} />
      </Paper>

      <Paper sx={{ p: 2 }}>
        <List disablePadding>
          {filteredProducts.map((p, idx) => {
            const linked = getLinkedCount(p)
            const total = p.units.length
            const allLinked = linked === total && total > 0
            const pct = total > 0 ? Math.round((linked / total) * 100) : 0

            return (
              <React.Fragment key={p.id}>
                {idx > 0 && <Divider />}
                <ListItem sx={{ py: 1.5 }}
                  secondaryAction={
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                      <Button size="small" variant="outlined" onClick={() => openReview(p)}>
                        Revisar
                      </Button>
                      <Chip
                        icon={allLinked
                          ? <CheckCircleIcon sx={{ fontSize: 14 }} />
                          : <LinkIcon sx={{ fontSize: 14 }} />}
                        label={`${linked}/${total} vinculadas`}
                        size="small"
                        color={linked === 0 ? 'default' : allLinked ? 'success' : 'warning'}
                        variant={linked === 0 ? 'outlined' : 'filled'}
                      />
                      <Button size="small" variant="outlined" color="error"
                        startIcon={<LinkOffIcon sx={{ fontSize: 14 }} />}
                        onClick={() => openReview(p)}
                        disabled={linked === 0}>
                        Desvincular
                      </Button>
                    </Box>
                  }>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" fontWeight={600}>{p.name}</Typography>
                        <Chip label={p.sku} size="small" variant="outlined" sx={{ fontSize: 10 }} />
                        <Chip label={p.category} size="small" color="primary" variant="outlined" sx={{ fontSize: 10 }} />
                      </Box>
                    }
                    secondary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 0.5 }}>
                        <Typography variant="caption" color="text.secondary">
                          {total} unidades totales
                        </Typography>
                        <Box sx={{ flex: 1, maxWidth: 120 }}>
                          <LinearProgress variant="determinate" value={pct}
                            color={allLinked ? 'success' : linked > 0 ? 'warning' : 'inherit'}
                            sx={{ height: 5, borderRadius: 3 }} />
                        </Box>
                        <Typography variant="caption" color={allLinked ? 'success.main' : linked > 0 ? 'warning.main' : 'text.secondary'}>
                          {pct}%
                        </Typography>
                      </Box>
                    }
                  />
                </ListItem>
              </React.Fragment>
            )
          })}
        </List>
      </Paper>

      {/* Modal revisar/desvincular */}
      <Dialog open={openModal} onClose={() => setOpenModal(false)} fullWidth maxWidth="sm">
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <LinkIcon color="primary" />
            {modalProduct?.name}
            <Chip label={modalProduct?.sku} size="small" variant="outlined" sx={{ fontSize: 10 }} />
          </Box>
        </DialogTitle>
        <DialogContent>
          {modalProduct && (() => {
            const units = modalProduct.units
            const linked = units.filter(u => unitToEpc[u.id])
            const unlinked = units.filter(u => !unitToEpc[u.id])
            return (
              <>
                <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                  <Chip icon={<CheckCircleIcon />} label={`${linked.length} vinculadas`} color="success" />
                  <Chip label={`${unlinked.length} sin vincular`} color="default" variant="outlined" />
                </Box>
                {linked.length === 0 && (
                  <Alert severity="info" sx={{ mb: 1 }}>
                    Ninguna unidad vinculada aún. Ve a "Registrar RFID" para vincular.
                  </Alert>
                )}
                <List dense disablePadding>
                  {units.map((u, idx) => {
                    const epc = unitToEpc[u.id]
                    const isLinked = Boolean(epc)
                    return (
                      <ListItem key={u.id} sx={{
                        py: 0.8, px: 1.5, mb: 0.3, borderRadius: 1,
                        bgcolor: isLinked ? 'rgba(29,158,117,0.08)' : 'background.paper',
                        border: '1px solid',
                        borderColor: isLinked ? '#1D9E75' : 'divider',
                        transition: 'all .12s'
                      }}
                        secondaryAction={
                          isLinked && (
                            <Checkbox size="small" checked={toUnlink.includes(u.id)}
                              onChange={() => toggleUnit(u.id)} color="error" />
                          )
                        }>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              {isLinked
                                ? <CheckCircleIcon sx={{ fontSize: 16, color: '#1D9E75' }} />
                                : <RadioButtonUncheckedIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
                              }
                              <Typography variant="body2" fontWeight={isLinked ? 600 : 400}
                                sx={{ color: isLinked ? '#1D9E75' : 'text.secondary' }}>
                                {unitLabel(u.id)}
                              </Typography>
                              {isLinked && (
                                <Chip label="Vinculada" size="small" color="success"
                                  sx={{ fontSize: 10, height: 20, ml: 0.5 }} />
                              )}
                            </Box>
                          }
                          secondary={
                            isLinked
                              ? <Typography variant="caption" color="text.secondary" fontFamily="monospace"
                                sx={{ fontSize: 10 }}>EPC: {epc}</Typography>
                              : <Typography variant="caption" color="text.disabled">Sin sticker asignado</Typography>
                          }
                        />
                      </ListItem>
                    )
                  })}
                </List>
                {toUnlink.length > 0 && (
                  <Alert severity="warning" sx={{ mt: 1.5 }}>
                    Se desvincularán {toUnlink.length} unidad{toUnlink.length > 1 ? 'es' : ''}.
                    Los stickers físicos conservarán su EPC grabado.
                  </Alert>
                )}
              </>
            )
          })()}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenModal(false)}>Cancelar</Button>
          {toUnlink.length > 0 && (
            <Button variant="outlined" color="error" startIcon={<LinkOffIcon />}
              onClick={handleUnlinkSelected}>
              Desvincular seleccionados ({toUnlink.length})
            </Button>
          )}
          <Button variant="contained" color="error" startIcon={<LinkOffIcon />}
            onClick={handleUnlinkAll}
            disabled={!modalProduct || getLinkedCount(modalProduct) === 0}>
            Desvincular todos
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
