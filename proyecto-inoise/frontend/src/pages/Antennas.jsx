import React from 'react'
import {
  Box, Typography, Paper, Chip, LinearProgress, Alert, Divider,
  Button, Dialog, DialogTitle, DialogContent, IconButton,
  List, ListItem, ListItemText, ListItemIcon
} from '@mui/material'
import WifiIcon from '@mui/icons-material/Wifi'
import WifiOffIcon from '@mui/icons-material/WifiOff'
import CloseIcon from '@mui/icons-material/Close'
import HistoryIcon from '@mui/icons-material/History'
import NfcIcon from '@mui/icons-material/Nfc'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CancelIcon from '@mui/icons-material/Cancel'
import { useRfidSocket } from '../hooks/useRfidSocket'
import { useInventory } from '../context/InventoryContext'

// Convierte "3-5" → "Unidad 5"
const unitNumberLabel = (id) => {
  const parts = String(id).split('-')
  return `Unidad ${parts[parts.length - 1]}`
}

// Marca cada lectura como "única" (primera vez que se ve ese EPC en la sesión)
// o "repetida" (el mismo EPC ya había sido leído antes). El array llega
// ordenado de más reciente a más antigua, así que se recorre al revés
// para detectar cuál fue la primera lectura cronológica de cada tag.
const flagDuplicateScans = (scans) => {
  const seen = new Set()
  return [...scans].reverse().map(scan => {
    const isUnique = !seen.has(scan.epc)
    seen.add(scan.epc)
    return { ...scan, isUnique }
  }).reverse()
}

export default function Antennas() {
  const { isConnected: bridgeUp, lastScan, lastReadAt } = useRfidSocket()
  const { products, epcMap } = useInventory()

  // "isConnected" del hook solo dice que el WebSocket llegó al bridge —
  // y el bridge corre siempre dentro de Electron, conectado o no haya
  // ninguna antena física enchufada al PC. La única señal de que existe
  // hardware real es haber recibido al menos un paquete UDP desde que se
  // abrió la app (lastReadAt). Sin esto, "Activa" se mostraba en verde
  // aunque no hubiera ningún lector conectado.
  const isConnected = bridgeUp && lastReadAt !== null

  // Modal "Revisar lecturas"
  const [reviewAntenna, setReviewAntenna] = React.useState(null) // antena cuyas lecturas se están revisando

  /* ── Resuelve a qué elemento/unidad pertenece un EPC ── */
  const resolveAssignedElement = (epc) => {
    const unitId = epcMap?.[epc]
    if (!unitId) return 'Sticker no vinculado a ningún elemento'
    const productId = String(unitId).split('-')[0]
    const product = products.find(p => String(p.id) === productId)
    if (!product) return 'Sticker no vinculado a ningún elemento'
    return `${product.name} — ${unitNumberLabel(unitId)}`
  }

  const [stats, setStats] = React.useState({
    totalScans: 0,
    uniqueTags: 0,
    lastSignal: null,
    lastScanTime: null,
    recentScans: []
  })

  // Cargar stats del bridge cada 2 segundos
  React.useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('http://localhost:3002/api/stats')
        const data = await res.json()
        setStats(data)
      } catch (e) { }
    }
    fetchStats()
    const interval = setInterval(fetchStats, 2000)
    return () => clearInterval(interval)
  }, [])

  const fmtDate = (iso) => {
    if (!iso) return '—'
    const d = new Date(iso)
    return d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
      ' ' + d.toLocaleTimeString('es-CL')
  }

  // Señal: RSSI viene en dBm (negativo), convertir a porcentaje
  // RSSI típico: -30 dBm (excelente) a -90 dBm (muy débil)
  const rssiToPct = (rssi) => {
    if (rssi === null || rssi === undefined) return null
    const clamped = Math.max(-90, Math.min(-30, rssi))
    return Math.round(((clamped + 90) / 60) * 100)
  }

  const signalPct = rssiToPct(stats.lastSignal)
  const signalLabel = signalPct !== null
    ? `${signalPct}% (${stats.lastSignal} dBm)`
    : isConnected ? 'Sin datos RSSI' : '0%'

  const antennas = [
    {
      id: 1,
      name: 'Antena 1 — VF-747 / VA-991R 9dBi',
      active: isConnected,
      signalPct: isConnected ? (signalPct ?? 0) : 0,
      signalLabel,
      lastRead: fmtDate(stats.lastScanTime),
      totalScans: stats.totalScans,
      uniqueTags: stats.uniqueTags,
      recentScans: stats.recentScans
    },
    { id: 2, name: 'Antena 2', active: false, signalPct: 0, signalLabel: '0%', lastRead: '—', totalScans: 0, uniqueTags: 0, recentScans: [] },
    { id: 3, name: 'Antena 3', active: false, signalPct: 0, signalLabel: '0%', lastRead: '—', totalScans: 0, uniqueTags: 0, recentScans: [] },
  ]

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <WifiIcon /> Lectores RFID
      </Typography>

      <Alert severity={isConnected ? 'success' : bridgeUp ? 'warning' : 'error'} sx={{ mb: 2 }} icon={<WifiIcon />}>
        {isConnected
          ? '🟢 Lector VF-747 conectado — recibiendo lecturas reales'
          : bridgeUp
            ? '⚪ Bridge activo, pero no se detecta ninguna antena física enviando datos'
            : '⚫ Bridge RFID desconectado'}
      </Alert>

      {antennas.map((ant) => (
        <Paper key={ant.id} sx={{
          p: 2, mb: 2, border: '1px solid',
          borderColor: ant.active ? 'success.light' : 'divider',
          opacity: ant.active ? 1 : 0.6
        }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              {ant.active
                ? <WifiIcon sx={{ color: 'success.main', fontSize: 22 }} />
                : <WifiOffIcon sx={{ color: 'text.disabled', fontSize: 22 }} />
              }
              <Box>
                <Typography variant="body1" fontWeight={600}>{ant.name}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {ant.active ? 'UDP puerto 6001 · WS puerto 3001 · HTTP puerto 3002' : 'Sin conexión'}
                </Typography>
              </Box>
            </Box>
            <Chip label={ant.active ? 'Activa' : 'Offline'} color={ant.active ? 'success' : 'default'} size="small" />
          </Box>

          <Divider sx={{ mb: 1.5 }} />

          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2, mb: 1.5 }}>
            <Box>
              <Typography variant="caption" color="text.secondary">SEÑAL</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                <LinearProgress variant="determinate" value={ant.signalPct}
                  color={ant.signalPct > 60 ? 'success' : ant.signalPct > 30 ? 'warning' : 'error'}
                  sx={{ flex: 1, height: 8, borderRadius: 4 }} />
                <Typography variant="body2" fontWeight={600} sx={{ minWidth: 80, fontSize: 11 }}>
                  {ant.signalLabel}
                </Typography>
              </Box>
              {ant.active && stats.lastSignal === null && (
                <Typography variant="caption" color="text.disabled" sx={{ fontSize: 10 }}>
                  RSSI no disponible — activa RSSI=1 en Reader.ini
                </Typography>
              )}
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">ÚLTIMA LECTURA</Typography>
              <Typography variant="body2" fontFamily="monospace" sx={{ mt: 0.5, fontSize: 11 }}>
                {ant.lastRead}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">SCANS EN SESIÓN</Typography>
              <Typography variant="h6" fontWeight={700} color={ant.active ? 'primary' : 'text.disabled'} sx={{ mt: 0.5 }}>
                {ant.totalScans}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">TAGS ÚNICOS</Typography>
              <Typography variant="h6" fontWeight={700} color={ant.active ? 'success.main' : 'text.disabled'} sx={{ mt: 0.5 }}>
                {ant.uniqueTags}
              </Typography>
            </Box>
          </Box>

          {/* Botón para revisar lecturas (en vez de lista creciente inline) */}
          {ant.active && ant.recentScans.length > 0 && (
            <Box sx={{ mt: 1, display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                size="small"
                variant="outlined"
                startIcon={<HistoryIcon />}
                onClick={() => setReviewAntenna(ant)}
              >
                Revisar lecturas ({ant.recentScans.length})
              </Button>
            </Box>
          )}
        </Paper>
      ))}

      {/* Modal "Revisar lecturas" */}
      <Dialog
        open={!!reviewAntenna}
        onClose={() => setReviewAntenna(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <HistoryIcon />
            Lecturas — {reviewAntenna?.name}
          </Box>
          <IconButton size="small" onClick={() => setReviewAntenna(null)}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {(!reviewAntenna?.recentScans || reviewAntenna.recentScans.length === 0) ? (
            <Typography variant="body2" color="text.secondary">Sin lecturas registradas.</Typography>
          ) : (
            <List dense disablePadding>
              {flagDuplicateScans(reviewAntenna.recentScans).map((scan, i) => (
                <ListItem key={i} divider sx={{ py: 1.2, alignItems: 'flex-start' }}>
                  <ListItemIcon sx={{ minWidth: 36, mt: 0.5 }}>
                    <NfcIcon color={scan.isUnique ? 'primary' : 'disabled'} />
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body1" fontWeight={700} fontFamily="monospace" sx={{ wordBreak: 'break-all' }}>
                          {scan.epc}
                        </Typography>
                        {scan.isUnique
                          ? <CheckCircleIcon sx={{ color: 'success.main', fontSize: 20 }} titleAccess="Lectura única" />
                          : <CancelIcon sx={{ color: 'error.main', fontSize: 20 }} titleAccess="Lectura repetida" />
                        }
                      </Box>
                    }
                    secondary={
                      <Box sx={{ mt: 0.5 }}>
                        <Typography variant="body2" color="text.primary">
                          {resolveAssignedElement(scan.epc)}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.3 }}>
                          <Typography variant="caption" color="text.secondary">
                            {new Date(scan.at).toLocaleString('es-CL')}
                          </Typography>
                          {scan.rssi && (
                            <Chip label={`${scan.rssi} dBm`} size="small" sx={{ fontSize: 10, height: 18 }} />
                          )}
                          <Chip
                            label={scan.isUnique ? 'Única' : 'Repetida'}
                            size="small"
                            color={scan.isUnique ? 'success' : 'error'}
                            variant="outlined"
                            sx={{ fontSize: 10, height: 18 }}
                          />
                        </Box>
                      </Box>
                    }
                  />
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  )
}
