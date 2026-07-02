import React from 'react'
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  Tabs, Tab, Chip, IconButton, Collapse, TextField, InputAdornment, Stack
} from '@mui/material'
import EventIcon from '@mui/icons-material/Event'
import HandshakeIcon from '@mui/icons-material/Handshake'
import Inventory2Icon from '@mui/icons-material/Inventory2'
import AssessmentIcon from '@mui/icons-material/Assessment'
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

/* ─── Auditoría ─── */
const AUDIT_CATEGORY_COLORS = {
  evento: 'primary',
  arriendo: 'secondary',
  producto: 'success',
  sistema: 'default'
}

const AUDIT_CATEGORY_LABELS = {
  evento: 'Evento',
  arriendo: 'Arriendo',
  producto: 'Producto',
  sistema: 'Sistema'
}

function filterByPeriod(entries, period) {
  if (period === 'all') return entries
  const now = new Date()
  const startOf = (unit) => {
    const d = new Date(now)
    if (unit === 'day') { d.setHours(0, 0, 0, 0) }
    else if (unit === 'week') { d.setDate(d.getDate() - d.getDay()); d.setHours(0, 0, 0, 0) }
    else if (unit === 'month') { d.setDate(1); d.setHours(0, 0, 0, 0) }
    return d
  }
  const since = period === 'day' ? startOf('day') : period === 'week' ? startOf('week') : startOf('month')
  return entries.filter(e => e.timestamp && new Date(e.timestamp) >= since)
}

function AuditTable({ entries }) {
  const [period, setPeriod] = React.useState('all')
  const [catFilter, setCatFilter] = React.useState('all')

  const filtered = React.useMemo(() => {
    let list = filterByPeriod(entries, period)
    if (catFilter !== 'all') list = list.filter(e => e.category === catFilter)
    return list
  }, [entries, period, catFilter])

  const periodOptions = [
    { value: 'day', label: 'Hoy' },
    { value: 'week', label: 'Esta semana' },
    { value: 'month', label: 'Este mes' },
    { value: 'all', label: 'Todo' }
  ]
  const catOptions = [
    { value: 'all', label: 'Todos' },
    { value: 'evento', label: 'Eventos' },
    { value: 'arriendo', label: 'Arriendos' },
    { value: 'producto', label: 'Productos' },
    { value: 'sistema', label: 'Sistema' }
  ]

  if (entries.length === 0) {
    return (
      <Box sx={{ p: 6, textAlign: 'center' }}>
        <AssessmentIcon sx={{ fontSize: 40, color: 'text.secondary', mb: 1 }} />
        <Typography color="text.secondary">Aún no hay movimientos registrados.</Typography>
      </Box>
    )
  }

  return (
    <Box>
      {/* Filtro período */}
      <Stack direction="row" spacing={0.5} sx={{ mb: 1 }} flexWrap="wrap">
        <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center', mr: 0.5 }}>Período:</Typography>
        {periodOptions.map(o => (
          <Chip
            key={o.value}
            label={o.label}
            size="small"
            onClick={() => setPeriod(o.value)}
            color={period === o.value ? 'primary' : 'default'}
            variant={period === o.value ? 'filled' : 'outlined'}
            sx={{ cursor: 'pointer' }}
          />
        ))}
      </Stack>

      {/* Filtro categoría */}
      <Stack direction="row" spacing={0.5} sx={{ mb: 2 }} flexWrap="wrap">
        <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center', mr: 0.5 }}>Categoría:</Typography>
        {catOptions.map(o => (
          <Chip
            key={o.value}
            label={o.label}
            size="small"
            onClick={() => setCatFilter(o.value)}
            color={catFilter === o.value ? (o.value === 'all' ? 'primary' : AUDIT_CATEGORY_COLORS[o.value] || 'primary') : 'default'}
            variant={catFilter === o.value ? 'filled' : 'outlined'}
            sx={{ cursor: 'pointer' }}
          />
        ))}
      </Stack>

      {filtered.length === 0 ? (
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <Typography color="text.secondary">Sin movimientos para los filtros seleccionados.</Typography>
        </Box>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Fecha / Hora</TableCell>
              <TableCell>Usuario</TableCell>
              <TableCell>Acción</TableCell>
              <TableCell>Detalle</TableCell>
              <TableCell>Categoría</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map(e => (
              <TableRow key={e.id} hover>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{fmtDateTime(e.timestamp)}</TableCell>
                <TableCell>{e.user || 'Sistema'}</TableCell>
                <TableCell>{e.action}</TableCell>
                <TableCell sx={{ color: 'text.secondary', fontSize: 13 }}>{e.detail || '—'}</TableCell>
                <TableCell>
                  <Chip
                    label={AUDIT_CATEGORY_LABELS[e.category] || e.category || '—'}
                    size="small"
                    color={AUDIT_CATEGORY_COLORS[e.category] || 'default'}
                    variant="outlined"
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Box>
  )
}

export default function History() {
  const { eventHistory, rentalHistory, purchaseHistory, auditLog } = useInventory()
  const [tab, setTab] = React.useState(0)
  const [query, setQuery] = React.useState('')

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>Historial</Typography>

      {tab !== 3 && (
        <Paper sx={{ p: 2, mb: 2 }}>
          <TextField
            fullWidth size="small" placeholder="Buscar por N° orden, nombre, lugar, cliente, producto o SKU…"
            value={query} onChange={e => setQuery(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
          />
        </Paper>
      )}

      <Paper sx={{ mb: 0 }}>
        <Tabs value={tab} onChange={(_, v) => { setTab(v); setQuery('') }} sx={{ px: 1 }}>
          <Tab icon={<EventIcon sx={{ fontSize: 18 }} />} iconPosition="start" label={`Historial de Eventos (${eventHistory.length})`} />
          <Tab icon={<HandshakeIcon sx={{ fontSize: 18 }} />} iconPosition="start" label={`Historial de Rentas (${rentalHistory.length})`} />
          <Tab icon={<Inventory2Icon sx={{ fontSize: 18 }} />} iconPosition="start" label={`Historial de Compras (${purchaseHistory.length})`} />
          <Tab icon={<AssessmentIcon sx={{ fontSize: 18 }} />} iconPosition="start" label={`Auditoría (${(auditLog || []).length})`} />
        </Tabs>
      </Paper>

      <Paper sx={{ p: 2, borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
        {tab === 0 && <EventsHistoryTable rows={eventHistory} query={query} />}
        {tab === 1 && <RentalsHistoryTable rows={rentalHistory} query={query} />}
        {tab === 2 && <PurchasesHistoryTable rows={purchaseHistory} query={query} />}
        {tab === 3 && <AuditTable entries={auditLog || []} />}
      </Paper>
    </Box>
  )
}
