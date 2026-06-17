import React from 'react'
import {
  Box, Typography, Paper, Chip, LinearProgress, Alert, Divider
} from '@mui/material'
import WifiIcon from '@mui/icons-material/Wifi'
import WifiOffIcon from '@mui/icons-material/WifiOff'
import { useRfidSocket } from '../hooks/useRfidSocket'

export default function Antennas() {
  const { isConnected, lastScan } = useRfidSocket()

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
      signalPct: isConnected ? (signalPct ?? 87) : 0,
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

      <Alert severity={isConnected ? 'success' : 'warning'} sx={{ mb: 2 }} icon={<WifiIcon />}>
        {isConnected
          ? '🟢 Bridge RFID activo — el lector VF-747 está enviando datos'
          : '⚫ Bridge RFID desconectado — ejecuta: node server/rfid-bridge.js'}
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

          {/* Últimas lecturas */}
          {ant.active && ant.recentScans.length > 0 && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="caption" color="text.secondary">ÚLTIMAS LECTURAS</Typography>
              <Box sx={{ mt: 0.5, maxHeight: 120, overflowY: 'auto' }}>
                {ant.recentScans.map((scan, i) => (
                  <Box key={i} sx={{
                    display: 'flex', alignItems: 'center', gap: 1.5,
                    py: 0.4, px: 1, borderRadius: 1,
                    bgcolor: i === 0 ? 'rgba(102,252,241,0.06)' : 'transparent',
                    borderBottom: '0.5px solid', borderColor: 'divider'
                  }}>
                    <Typography variant="caption" fontFamily="monospace" sx={{ fontSize: 11, flex: 1 }}>
                      {scan.epc}
                    </Typography>
                    {scan.rssi && (
                      <Chip label={`${scan.rssi} dBm`} size="small"
                        sx={{ fontSize: 10, height: 18 }} />
                    )}
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>
                      {new Date(scan.at).toLocaleTimeString('es-CL')}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          )}
        </Paper>
      ))}
    </Box>
  )
}
