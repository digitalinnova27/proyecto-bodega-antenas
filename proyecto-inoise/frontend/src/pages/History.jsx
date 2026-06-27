import React from 'react'
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  Tabs, Tab, Chip
} from '@mui/material'
import EventIcon from '@mui/icons-material/Event'
import HandshakeIcon from '@mui/icons-material/Handshake'
import Inventory2Icon from '@mui/icons-material/Inventory2'
import { useInventory } from '../context/InventoryContext'

const fmtDateTime = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('es-CL') + ' ' + d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
}

/* ─── Historial de Eventos ─── */
function EventsHistoryTable({ rows }) {
  if (rows.length === 0) {
    return (
      <Box sx={{ p: 6, textAlign: 'center' }}>
        <EventIcon sx={{ fontSize: 40, color: 'text.secondary', mb: 1 }} />
        <Typography color="text.secondary">Aún no hay eventos cerrados.</Typography>
      </Box>
    )
  }
  return (
    <Table size="small">
      <TableHead>
        <TableRow>
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
        {rows.map(h => (
          <TableRow key={h.id}>
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
        ))}
      </TableBody>
    </Table>
  )
}

/* ─── Historial de Rentas ─── */
function RentalsHistoryTable({ rows }) {
  if (rows.length === 0) {
    return (
      <Box sx={{ p: 6, textAlign: 'center' }}>
        <HandshakeIcon sx={{ fontSize: 40, color: 'text.secondary', mb: 1 }} />
        <Typography color="text.secondary">Aún no hay arriendos cerrados.</Typography>
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
        {rows.map(h => (
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
function PurchasesHistoryTable({ rows }) {
  if (rows.length === 0) {
    return (
      <Box sx={{ p: 6, textAlign: 'center' }}>
        <Inventory2Icon sx={{ fontSize: 40, color: 'text.secondary', mb: 1 }} />
        <Typography color="text.secondary">Aún no se ha ingresado stock nuevo.</Typography>
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
        {rows.map(h => (
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

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>Historial</Typography>

      <Paper sx={{ mb: 0 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 1 }}>
          <Tab icon={<EventIcon sx={{ fontSize: 18 }} />} iconPosition="start" label={`Historial de Eventos (${eventHistory.length})`} />
          <Tab icon={<HandshakeIcon sx={{ fontSize: 18 }} />} iconPosition="start" label={`Historial de Rentas (${rentalHistory.length})`} />
          <Tab icon={<Inventory2Icon sx={{ fontSize: 18 }} />} iconPosition="start" label={`Historial de Compras (${purchaseHistory.length})`} />
        </Tabs>
      </Paper>

      <Paper sx={{ p: 2, borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
        {tab === 0 && <EventsHistoryTable rows={eventHistory} />}
        {tab === 1 && <RentalsHistoryTable rows={rentalHistory} />}
        {tab === 2 && <PurchasesHistoryTable rows={purchaseHistory} />}
      </Paper>
    </Box>
  )
}
