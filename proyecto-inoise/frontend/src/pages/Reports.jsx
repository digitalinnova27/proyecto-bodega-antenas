import React from 'react'
import {
  Box, Typography, Paper, Button, TextField, Divider,
  Table, TableBody, TableCell, TableHead, TableRow, Chip, Alert
} from '@mui/material'
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf'
import BarChartIcon from '@mui/icons-material/BarChart'
import { useInventory } from '../context/InventoryContext'
import { generateMonthlyReportPDF } from '../utils/generatePDF'

// "2026-06-15T..." → "2026-06"
const monthOf = (isoOrDate) => {
  if (!isoOrDate) return null
  return String(isoOrDate).slice(0, 7)
}

export default function Reports() {
  const { eventHistory, rentalHistory } = useInventory()
  const todayMonth = new Date().toISOString().slice(0, 7)
  const [month, setMonth] = React.useState(todayMonth)
  const [generating, setGenerating] = React.useState(false)

  // Se filtra por la fecha del evento/arriendo (cuándo se retiró el
  // material), no por cuándo se cerró el ciclo — así el reporte de "junio"
  // muestra lo que salió de bodega en junio, aunque se haya cerrado/recibido
  // de vuelta más tarde.
  const eventEntries = React.useMemo(
    () => eventHistory.filter(e => monthOf(e.date) === month),
    [eventHistory, month]
  )
  const rentalEntries = React.useMemo(
    () => rentalHistory.filter(r => monthOf(r.date) === month),
    [rentalHistory, month]
  )

  const totalItems = eventEntries.reduce((s, e) => s + (e.totalItems || 0), 0) +
    rentalEntries.reduce((s, r) => s + (r.totalItems || 0), 0)
  const totalLosses = eventEntries.reduce((s, e) => s + ((e.lossDetails || []).length), 0)

  // Detalle plano de pérdidas para la tabla de "Incidencias y pérdidas" de
  // la vista — antes esta info solo se veía en el PDF descargado (un chip
  // con el conteo era lo único que mostraba la vista).
  const allLosses = React.useMemo(
    () => eventEntries.flatMap(ev => (ev.lossDetails || []).map(l => ({ ...l, eventLabel: `${ev.orderNumber || ''} · ${ev.name}` }))),
    [eventEntries]
  )

  const genPDF = async () => {
    setGenerating(true)
    try {
      await generateMonthlyReportPDF(month, eventEntries, rentalEntries)
    } finally {
      setGenerating(false)
    }
  }

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <BarChartIcon /> Reporte de operaciones
      </Typography>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <TextField
            label="Mes" type="month" size="small"
            value={month} onChange={e => setMonth(e.target.value)}
          />
          <Button
            variant="contained" startIcon={<PictureAsPdfIcon />}
            onClick={genPDF} disabled={generating}
          >
            {generating ? 'Generando…' : 'Descargar PDF mensual'}
          </Button>
          <Typography variant="caption" color="text.secondary">
            Incluye productos retirados/arrendados, fases aprobadas por evento, e incidencias de pérdida con su fase y ubicación.
          </Typography>
        </Box>
      </Paper>

      {eventEntries.length === 0 && rentalEntries.length === 0 ? (
        <Alert severity="info">No hay eventos ni arriendos cerrados con fecha en este mes.</Alert>
      ) : (
        <>
          <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
            <Chip label={`${eventEntries.length} eventos cerrados`} color="primary" variant="outlined" />
            <Chip label={`${rentalEntries.length} arriendos cerrados`} sx={{ borderColor: '#EF9F27', color: '#EF9F27' }} variant="outlined" />
            <Chip label={`${totalItems} artículos movidos`} color="success" variant="outlined" />
            <Chip label={`${totalLosses} incidencias/pérdidas`} color={totalLosses > 0 ? 'warning' : 'default'} variant="outlined" />
          </Box>

          {eventEntries.length > 0 && (
            <Paper sx={{ p: 2, mb: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Eventos</Typography>
              <Divider sx={{ mb: 1 }} />
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Evento</TableCell>
                    <TableCell>Ubicación</TableCell>
                    <TableCell>Artículos</TableCell>
                    <TableCell>Fases aprobadas</TableCell>
                    <TableCell>Pérdidas</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {eventEntries.map(ev => (
                    <TableRow key={ev.id}>
                      <TableCell>{ev.orderNumber} · {ev.name}</TableCell>
                      <TableCell>{ev.location || '—'}</TableCell>
                      <TableCell>{ev.totalItems}</TableCell>
                      <TableCell>
                        {(ev.phasesApproved || []).filter(p => p.done).map(p => (
                          <Chip key={p.key} label={p.key.toUpperCase() + (p.forced ? '*' : '')}
                            size="small" sx={{ mr: 0.5, fontSize: 10 }} />
                        ))}
                      </TableCell>
                      <TableCell>
                        {(ev.lossDetails || []).length > 0
                          ? <Chip label={ev.lossDetails.length} size="small" color="warning" />
                          : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
          )}

          {rentalEntries.length > 0 && (
            <Paper sx={{ p: 2, mb: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Arriendos</Typography>
              <Divider sx={{ mb: 1 }} />
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Arriendo</TableCell>
                    <TableCell>Cliente</TableCell>
                    <TableCell>Artículos</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rentalEntries.map(r => (
                    <TableRow key={r.id}>
                      <TableCell>{r.orderNumber} · {r.name}</TableCell>
                      <TableCell>{r.clientName || '—'}</TableCell>
                      <TableCell>{r.totalItems}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
          )}

          {allLosses.length > 0 && (
            <Paper sx={{ p: 2, mb: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1, color: 'warning.main' }}>
                Incidencias y pérdidas
              </Typography>
              <Divider sx={{ mb: 1 }} />
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Evento</TableCell>
                    <TableCell>Artículo</TableCell>
                    <TableCell>Fase</TableCell>
                    <TableCell>Estado</TableCell>
                    <TableCell>Ubicación</TableCell>
                    <TableCell>Motivo</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {allLosses.map((l, i) => (
                    <TableRow key={i}>
                      <TableCell>{l.eventLabel}</TableCell>
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
            </Paper>
          )}
        </>
      )}
    </Box>
  )
}
