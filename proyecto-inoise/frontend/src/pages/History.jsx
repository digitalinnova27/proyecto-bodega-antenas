import React from 'react'
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  Tabs, Tab, Chip, IconButton, Collapse, TextField, InputAdornment
} from '@mui/material'
import EventIcon from '@mui/icons-material/Event'
import HandshakeIcon from '@mui/icons-material/Handshake'
import Inventory2Icon from '@mui/icons-material/Inventory2'
import SearchIcon from '@mui/icons-material/Search'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import { useInventory } from '../context/InventoryContext'

const fmtDateTime = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('es-CL') + ' ' + d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
}

const matchesQuery = (h, q) => {
  if (!q) return true
  const needle = q.trim().toLowerCase()
  return [h.orderNumber, h.name, h.location, h.clientName, h.productName, h.sku]
    .filter(Boolean)
    .some(v => String(v).toLowerCase().includes(needle))
}

/* ─── Historial de Eventos ─── */
// Cada evento cerrado se puede expandir (click en la fila) para ver el
// detalle completo: artículos asignados, fases aprobadas con su estado
// (forzada o no) y, si hubo pérdidas, el detalle por artículo (fase exacta,
// estado y motivo) — antes esto solo se podía ver en el PDF mensual de
// Reporte de Operaciones, filtrado por mes.
function EventRow({ h }) {
  const [open, setOpen] = React.useState(false)
  return (
    <React.Fragment>
      <TableRow hover onClick={() => setOpen(o => !o)} sx={{ cursor: 'pointer', '& > *': { borderBottom: 'unset' } }}>
        <TableCell sx={{ width: 40 }}>
          <IconButton size="small">
            {open ? <KeyboardArrowUpIcon fontSize="small" /> : <KeyboardArrowDownIcon fontSize="small" />}
          </IconButton>
        </TableCell>
        <TableCell>{fmtDateTime(h.closedAt)}</TableCell>
        <TableCell>{h.orderNumber}</TableCell>
        <TableCell>{h.name}</TableCell>
        <TableCell>{h.date}</TableCell>
        <TableCell>{h.location || '—'}</TableCell>
        <TableCell align="right">{h.totalItems}</TableCell>
        <TableCell align="right">{h.incidentsCount || 0}</TableCell>
        <TableCell>{h.closedBy}</TableCell>
        <TableCell>
          {h.forcedClose
            ? <Chip label="Forzado" size="small" color="warning" />
            : <Chip label="Normal" size="small" color="success" variant="outlined" />}
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={10} sx={{ p: 0, borderBottom: open ? undefined : 'none' }}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ p: 2, bgcolor: 'background.default' }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                FASES APROBADAS
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5, mb: 2, flexWrap: 'wrap' }}>
                {(h.phasesApproved || []).length === 0 && (
                  <Typography variant="body2" color="text.secondary">Sin información de fases (datos incompletos de una versión anterior del sistema).</Typography>
                )}
                {(h.phasesApproved || []).map(p => (
                  <Chip
                    key={p.key}
                    label={`${p.key.toUpperCase()} · ${p.label}${p.forced ? ' (forzada)' : ''}`}
                    size="small"
                    color={p.done ? (p.forced ? 'warning' : 'success') : 'default'}
                    variant={p.done ? 'filled' : 'outlined'}
                  />
                ))}
              </Box>

              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                ARTÍCULOS ASIGNADOS
              </Typography>
              {(h.items || []).length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ mb: (h.lossDetails || []).length > 0 ? 2 : 0 }}>
                  Este evento se cerró sin artículos registrados (datos incompletos de una versión anterior del sistema).
                </Typography>
              ) : (
                <Table size="small" sx={{ mb: (h.lossDetails || []).length > 0 ? 2 : 0 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Producto</TableCell>
                      <TableCell>SKU</TableCell>
                      <TableCell align="right">Cantidad</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {h.items.map((it, i) => (
                      <TableRow key={i}>
                        <TableCell>{it.name}</TableCell>
                        <TableCell>{it.sku}</TableCell>
                        <TableCell align="right">{it.qty}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              {(h.lossDetails || []).length > 0 && (
                <>
                  <Typography variant="caption" color="warning.main" sx={{ display: 'block', mb: 0.5 }}>
                    INCIDENCIAS / PÉRDIDAS
                  </Typography>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Artículo</TableCell>
                        <TableCell>Fase</TableCell>
                        <TableCell>Estado</TableCell>
                        <TableCell>Ubicación</TableCell>
                        <TableCell>Motivo</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {h.lossDetails.map((l, i) => (
                        <TableRow key={i}>
                          <TableCell>{l.item}</TableCell>
                          <TableCell>{l.phase || '—'}</TableCell>
                          <TableCell>
                            <Chip label={l.state} size="small" color="warning" variant="outlined" />
                          </TableCell>
                          <TableCell>{l.location || '—'}</TableCell>
                          <TableCell>{l.reason || '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </>
              )}
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </React.Fragment>
  )
}

function EventsHistoryTable({ rows, query }) {
  const filtered = React.useMemo(() => rows.filter(h => matchesQuery(h, query)), [rows, query])

  if (rows.length === 0) {
    return (
      <Box sx={{ p: 6, textAlign: 'center' }}>
        <EventIcon sx={{ fontSize: 40, color: 'text.secondary', mb: 1 }} />
        <Typography color="text.secondary">Aún no hay eventos cerrados.</Typography>
      </Box>
    )
  }
  if (filtered.length === 0) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography color="text.secondary">No se encontró ningún evento que coincida con "{query}".</Typography>
      </Box>
    )
  }
  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell sx={{ width: 40 }} />
          <TableCell>Fecha de cierre</TableCell>
          <TableCell>N° orden</TableCell>
          <TableCell>Evento</TableCell>
          <TableCell>Fecha evento</TableCell>
          <TableCell>Lugar</TableCell>
          <TableCell align="right">Artículos</TableCell>
          <TableCell align="right">Incidencias</TableCell>
          <TableCell>Cerrado por</TableCell>
          <TableCell>Cierre</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {filtered.map(h => <EventRow key={h.id} h={h} />)}
      </TableBody>
    </Table>
  )
}

/* ─── Historial de Rentas ─── */
function RentalsHistoryTable({ rows, query }) {
  const filtered = React.useMemo(() => rows.filter(h => matchesQuery(h, query)), [rows, query])

  if (rows.length === 0) {
    return (
      <Box sx={{ p: 6, textAlign: 'center' }}>
        <HandshakeIcon sx={{ fontSize: 40, color: 'text.secondary', mb: 1 }} />
        <Typography color="text.secondary">Aún no hay arriendos cerrados.</Typography>
      </Box>
    )
  }
  if (filtered.length === 0) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography color="text.secondary">No se encontró ningún arriendo que coincida con "{query}".</Typography>
      </Box>
    )
  }
  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>Fecha de cierre</TableCell>
          <TableCell>N° orden</TableCell>
          <TableCell>Arriendo</TableCell>
          <TableCell>Cliente</TableCell>
          <TableCell>Inicio</TableCell>
          <TableCell>Término</TableCell>
          <TableCell align="right">Artículos</TableCell>
          <TableCell>Cerrado por</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {filtered.map(h => (
          <TableRow key={h.id}>
            <TableCell>{fmtDateTime(h.closedAt)}</TableCell>
            <TableCell>{h.orderNumber}</TableCell>
            <TableCell>{h.name}</TableCell>
            <TableCell>{h.clientName || '—'}</TableCell>
            <TableCell>{h.date}</TableCell>
            <TableCell>{h.endDate || '—'}</TableCell>
            <TableCell align="right">{h.totalItems}</TableCell>
            <TableCell>{h.closedBy}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

/* ─── Historial de Compras (ingreso de stock) ─── */
function PurchasesHistoryTable({ rows, query }) {
  const filtered = React.useMemo(() => rows.filter(h => matchesQuery(h, query)), [rows, query])

  if (rows.length === 0) {
    return (
      <Box sx={{ p: 6, textAlign: 'center' }}>
        <Inventory2Icon sx={{ fontSize: 40, color: 'text.secondary', mb: 1 }} />
        <Typography color="text.secondary">Aún no se ha ingresado stock nuevo.</Typography>
      </Box>
    )
  }
  if (filtered.length === 0) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography color="text.secondary">No se encontró ningún ingreso que coincida con "{query}".</Typography>
      </Box>
    )
  }
  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>Fecha de ingreso</TableCell>
          <TableCell>Producto</TableCell>
          <TableCell>SKU</TableCell>
          <TableCell>Categoría</TableCell>
          <TableCell align="right">Cantidad ingresada</TableCell>
          <TableCell>Ingresado por</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {filtered.map(h => (
          <TableRow key={h.id}>
            <TableCell>{fmtDateTime(h.date)}</TableCell>
            <TableCell>{h.productName}</TableCell>
            <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{h.sku}</TableCell>
            <TableCell>{h.category || '—'}</TableCell>
            <TableCell align="right">+{h.qty}</TableCell>
            <TableCell>{h.user}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

export default function History() {
  const { eventHistory, rentalHistory, purchaseHistory } = useInventory()
  const [tab, setTab] = React.useState(0)
  const [query, setQuery] = React.useState('')

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>Historial</Typography>

      <Paper sx={{ p: 2, mb: 2 }}>
        <TextField
          fullWidth size="small" placeholder="Buscar por N° orden, nombre, lugar, cliente, producto o SKU…"
          value={query} onChange={e => setQuery(e.target.value)}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
        />
      </Paper>

      <Paper sx={{ mb: 0 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 1 }}>
          <Tab icon={<EventIcon sx={{ fontSize: 18 }} />} iconPosition="start" label={`Historial de Eventos (${eventHistory.length})`} />
          <Tab icon={<HandshakeIcon sx={{ fontSize: 18 }} />} iconPosition="start" label={`Historial de Rentas (${rentalHistory.length})`} />
          <Tab icon={<Inventory2Icon sx={{ fontSize: 18 }} />} iconPosition="start" label={`Historial de Compras (${purchaseHistory.length})`} />
        </Tabs>
      </Paper>

      <Paper sx={{ p: 2, borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
        {tab === 0 && <EventsHistoryTable rows={eventHistory} query={query} />}
        {tab === 1 && <RentalsHistoryTable rows={rentalHistory} query={query} />}
        {tab === 2 && <PurchasesHistoryTable rows={purchaseHistory} query={query} />}
      </Paper>
    </Box>
  )
}
