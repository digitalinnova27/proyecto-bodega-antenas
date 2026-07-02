import React from 'react'
import {
  Box, Typography, Paper, Chip, LinearProgress, Alert, Divider,
  Button, Dialog, DialogTitle, DialogContent, IconButton,
  List, ListItem, ListItemText, ListItemIcon, Tabs, Tab
} from '@mui/material'
import WifiIcon from '@mui/icons-material/Wifi'
import WifiOffIcon from '@mui/icons-material/WifiOff'
import CloseIcon from '@mui/icons-material/Close'
import HistoryIcon from '@mui/icons-material/History'
import NfcIcon from '@mui/icons-material/Nfc'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import RepeatIcon from '@mui/icons-material/Repeat'
import EventIcon from '@mui/icons-material/Event'
import HandshakeIcon from '@mui/icons-material/Handshake'
import { useRfidSocket } from '../hooks/useRfidSocket'
import { useInventory } from '../context/InventoryContext'

const PHASE_LABELS = {
  f1: 'Despacho bodega',
  f2: 'Recepción evento',
  f3: 'Despacho evento',
  f4: 'Recepción bodega'
}

// Convierte "3-5" → "Unidad 5"
const unitNumberLabel = (id) => `Unidad ${String(id).split('-').pop()}`

// Marca cada lectura como "única" (primera vez en la sesión) o "repetida".
// El array viene ordenado de más reciente a más antigua, se recorre al revés
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
  const { products, epcMap, events, rentals, opStates } = useInventory()

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

  // "isConnected" del hook solo dice que el WebSocket llegó al bridge —
  // y el bridge corre siempre dentro de Electron, conectado o no haya
  // ninguna antena física enchufada al PC. La única señal de que existe
  // hardware real es haber recibido al menos un paquete UDP desde que se
  // abrió la app (lastReadAt). Sin esto, "Activa" se mostraba en verde
  // aunque no hubiera ningún lector conectado.
  const RECENT_MS = 15000
  const recentlyActive = stats.lastScanTime
    ? (Date.now() - new Date(stats.lastScanTime).getTime()) < RECENT_MS
    : false
  const isConnected = bridgeUp && (lastReadAt !== null || recentlyActive)

  // Modal "Revisar lecturas"
  const [reviewAntenna, setReviewAntenna] = React.useState(null)
  const [scanTab, setScanTab] = React.useState(0)

  // ── Datos derivados para el modal ──────────────────────────────────────

  // Scans con flag de unique/repetida
  const flagged = React.useMemo(
    () => flagDuplicateScans(reviewAntenna?.recentScans || []),
    [reviewAntenna]
  )
  const uniqueScans = React.useMemo(() => flagged.filter(s => s.isUnique), [flagged])
  const repeatedScans = React.useMemo(() => flagged.filter(s => !s.isUnique), [flagged])

  // Cruzar scans crudos (bridge) con los scanned de cada evento/fase en opStates.
  // phases[key].scanned = [{ id: unitId, name, sku, ... }]
  // epcMap[epc] = unitId
  // Si el unitId de un scan aparece en algún phase.scanned, ese scan
  // pertenece a ese evento + fase.
  const eventSections = React.useMemo(() => {
    if (!reviewAntenna || flagged.length === 0) return []
    return events
      .filter(ev => opStates[ev.id])
      .map(ev => {
        const op = opStates[ev.id]
        const phases = Object.entries(op.phases || {}).map(([key, ph]) => {
          const scannedUids = new Set((ph.scanned || []).map(s => s.id))
          const scans = flagged.filter(sc => {
            const uid = epcMap[sc.epc]
            return uid && scannedUids.has(uid)
          })
          return { key, label: PHASE_LABELS[key] || key, done: !!ph.done, forced: !!ph.forcedClose, scans }
        }).filter(ph => ph.scans.length > 0)
        return { ev, phases }
      })
      .filter(sec => sec.phases.length > 0)
  }, [reviewAntenna, flagged, events, opStates, epcMap])

  const rentalSections = React.useMemo(() => {
    if (!reviewAntenna || flagged.length === 0) return []
    return (rentals || [])
      .filter(r => opStates[r.id])
      .map(r => {
        const op = opStates[r.id]
        const phases = Object.entries(op.phases || {}).map(([key, ph]) => {
          const scannedUids = new Set((ph.scanned || []).map(s => s.id))
          const scans = flagged.filter(sc => {
            const uid = epcMap[sc.epc]
            return uid && scannedUids.has(uid)
          })
          return { key, label: PHASE_LABELS[key] || key, done: !!ph.done, forced: !!ph.forcedClose, scans }
        }).filter(ph => ph.scans.length > 0)
        return { r, phases }
      })
      .filter(sec => sec.phases.length > 0)
  }, [reviewAntenna, flagged, rentals, opStates, epcMap])

  // ── Helpers ──────────────────────────────────────────────────────────

  const resolveScan = (epc) => {
    const uid = epcMap?.[epc]
    if (!uid) return { label: 'Sticker no vinculado', sub: epc }
    const productId = String(uid).split('-')[0]
    const product = products.find(p => String(p.id) === productId)
    if (!product) return { label: 'Producto eliminado', sub: epc }
    return { label: `${product.name} — ${unitNumberLabel(uid)}`, sub: epc }
  }

  const fmtDate = (iso) => {
    if (!iso) return '—'
    const d = new Date(iso)
    return d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
      ' ' + d.toLocaleTimeString('es-CL')
  }

  // Señal: RSSI viene en dBm (negativo), convertir a porcentaje
  const rssiToPct = (rssi) => {
    if (rssi === null || rssi === undefined) return null
    const clamped = Math.max(-90, Math.min(-30, rssi))
    return Math.round(((clamped + 90) / 60) * 100)
  }

  const signalPct = rssiToPct(stats.lastSignal)
  const hasRssi = signalPct !== null
  const signalLabel = hasRssi
    ? `${signalPct}% (${stats.lastSignal} dBm)`
    : isConnected ? 'Conectada' : 'Sin conexión'

  const antennas = [
    {
      id: 1,
      name: 'Antena 1 — VF-747 / VA-991R 9dBi',
      active: isConnected,
      signalPct: isConnected ? (hasRssi ? signalPct : 100) : 0,
      hasRssi,
      signalLabel,
      lastRead: fmtDate(stats.lastScanTime),
      totalScans: stats.totalScans,
      uniqueTags: stats.uniqueTags,
      recentScans: stats.recentScans
    },
    { id: 2, name: 'Antena 2', active: false, signalPct: 0, signalLabel: '0%', lastRead: '—', totalScans: 0, uniqueTags: 0, recentScans: [] },
    { id: 3, name: 'Antena 3', active: false, signalPct: 0, signalLabel: '0%', lastRead: '—', totalScans: 0, uniqueTags: 0, recentScans: [] },
  ]

  // ── Render de una fila de scan ────────────────────────────────────────
  const renderScanRow = (scan, i) => {
    const { label, sub } = resolveScan(scan.epc)
    return (
      <ListItem key={`${scan.epc}-${i}`} sx={{ py: 0.7, px: 0 }} disableGutters>
        <ListItemIcon sx={{ minWidth: 28 }}>
          <NfcIcon sx={{ fontSize: 15 }} color="primary" />
        </ListItemIcon>
        <ListItemText
          primary={<Typography variant="body2" fontWeight={600} sx={{ lineHeight: 1.3 }}>{label}</Typography>}
          secondary={
            <Box sx={{ display: 'flex', gap: 0.8, alignItems: 'center', flexWrap: 'wrap', mt: 0.2 }}>
              <Typography variant="caption" fontFamily="monospace" sx={{ fontSize: 10, color: 'text.secondary' }}>
                {sub}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {new Date(scan.at).toLocaleTimeString('es-CL')}
              </Typography>
              {scan.rssi && (
                <Chip label={`${scan.rssi} dBm`} size="small" sx={{ fontSize: 10, height: 16 }} />
              )}
            </Box>
          }
        />
      </ListItem>
    )
  }

  // ── Render de una sección de fase (dentro de un evento/arriendo) ──────
  const renderPhaseSection = (ph) => (
    <Box key={ph.key} sx={{ mb: 1.5, pl: 1.5, borderLeft: '2px solid', borderColor: ph.done ? 'success.main' : 'divider' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 0.5 }}>
        <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {ph.key.toUpperCase()} · {ph.label}
        </Typography>
        {ph.done && (
          <Chip label={ph.forced ? 'Forzada' : 'Completa'} size="small"
            color={ph.forced ? 'warning' : 'success'} sx={{ fontSize: 10, height: 18 }} />
        )}
        <Chip label={`${ph.scans.length} lect.`} size="small" variant="outlined" sx={{ fontSize: 10, height: 18 }} />
      </Box>
      <List dense disablePadding>
        {ph.scans.map((sc, i) => renderScanRow(sc, i))}
      </List>
    </Box>
  )

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
              {ant.active && !ant.hasRssi && (
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

          {ant.recentScans.length > 0 && (
            <Box sx={{ mt: 1, display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                size="small"
                variant="outlined"
                startIcon={<HistoryIcon />}
                onClick={() => { setScanTab(0); setReviewAntenna(ant) }}
              >
                Revisar lecturas ({ant.recentScans.length})
              </Button>
            </Box>
          )}
        </Paper>
      ))}

      {/* ── Modal "Revisar lecturas" con secciones ───────────────────── */}
      <Dialog
        open={!!reviewAntenna}
        onClose={() => setReviewAntenna(null)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <HistoryIcon />
            Lecturas — {reviewAntenna?.name}
          </Box>
          <IconButton size="small" onClick={() => setReviewAntenna(null)}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        {/* Tabs de secciones */}
        <Tabs
          value={scanTab}
          onChange={(_, v) => setScanTab(v)}
          sx={{ px: 3, borderBottom: 1, borderColor: 'divider' }}
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab
            icon={<CheckCircleIcon sx={{ fontSize: 16 }} />}
            iconPosition="start"
            label={`Únicas (${uniqueScans.length})`}
            sx={{ minHeight: 44, fontSize: 13 }}
          />
          <Tab
            icon={<RepeatIcon sx={{ fontSize: 16 }} />}
            iconPosition="start"
            label={`Repetidas (${repeatedScans.length})`}
            sx={{ minHeight: 44, fontSize: 13 }}
          />
          <Tab
            icon={<EventIcon sx={{ fontSize: 16 }} />}
            iconPosition="start"
            label={`Eventos (${eventSections.length})`}
            sx={{ minHeight: 44, fontSize: 13 }}
          />
          <Tab
            icon={<HandshakeIcon sx={{ fontSize: 16 }} />}
            iconPosition="start"
            label={`Arriendos (${rentalSections.length})`}
            sx={{ minHeight: 44, fontSize: 13 }}
          />
        </Tabs>

        <DialogContent dividers sx={{ minHeight: 280, maxHeight: '70vh' }}>

          {/* ── Tab 0: Lecturas únicas ── */}
          {scanTab === 0 && (
            uniqueScans.length === 0 ? (
              <Typography variant="body2" color="text.secondary">Sin lecturas únicas registradas.</Typography>
            ) : (
              <>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                  {uniqueScans.length} tag{uniqueScans.length !== 1 ? 's' : ''} leído{uniqueScans.length !== 1 ? 's' : ''} por primera vez en esta sesión.
                </Typography>
                <List dense disablePadding>
                  {uniqueScans.map((sc, i) => (
                    <React.Fragment key={`u-${sc.epc}-${i}`}>
                      {i > 0 && <Divider sx={{ my: 0.3 }} />}
                      {renderScanRow(sc, i)}
                    </React.Fragment>
                  ))}
                </List>
              </>
            )
          )}

          {/* ── Tab 1: Lecturas repetidas ── */}
          {scanTab === 1 && (
            repeatedScans.length === 0 ? (
              <Box>
                <Alert severity="success" sx={{ mb: 1 }}>Sin lecturas repetidas — cada tag se leyó solo una vez.</Alert>
              </Box>
            ) : (
              <>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                  {repeatedScans.length} lectura{repeatedScans.length !== 1 ? 's' : ''} de tags que ya habían sido detectados antes en esta sesión.
                </Typography>
                <List dense disablePadding>
                  {repeatedScans.map((sc, i) => (
                    <React.Fragment key={`r-${sc.epc}-${i}`}>
                      {i > 0 && <Divider sx={{ my: 0.3 }} />}
                      {renderScanRow(sc, i)}
                    </React.Fragment>
                  ))}
                </List>
              </>
            )
          )}

          {/* ── Tab 2: Por evento y fase ── */}
          {scanTab === 2 && (
            eventSections.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Ningún scan de esta sesión coincide con artículos escaneados en operaciones de eventos activos.
              </Typography>
            ) : (
              eventSections.map(({ ev, phases }) => (
                <Box key={ev.id} sx={{ mb: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <EventIcon sx={{ fontSize: 18, color: 'primary.main' }} />
                    <Typography variant="subtitle2" fontWeight={700}>{ev.name}</Typography>
                    <Chip label={ev.orderNumber} size="small" color="primary" variant="outlined" sx={{ fontSize: 10 }} />
                    <Chip label={ev.status} size="small" sx={{ fontSize: 10 }} />
                  </Box>
                  {phases.map(ph => renderPhaseSection(ph))}
                </Box>
              ))
            )
          )}

          {/* ── Tab 3: Por arriendo y fase ── */}
          {scanTab === 3 && (
            rentalSections.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Ningún scan de esta sesión coincide con artículos escaneados en operaciones de arriendos activos.
              </Typography>
            ) : (
              rentalSections.map(({ r, phases }) => (
                <Box key={r.id} sx={{ mb: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <HandshakeIcon sx={{ fontSize: 18, color: 'primary.main' }} />
                    <Typography variant="subtitle2" fontWeight={700}>{r.name}</Typography>
                    <Chip label={r.orderNumber} size="small" color="primary" variant="outlined" sx={{ fontSize: 10 }} />
                    {r.clientName && <Chip label={r.clientName} size="small" variant="outlined" sx={{ fontSize: 10 }} />}
                  </Box>
                  {phases.map(ph => renderPhaseSection(ph))}
                </Box>
              ))
            )
          )}

        </DialogContent>
      </Dialog>
    </Box>
  )
}
