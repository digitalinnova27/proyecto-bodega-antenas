import React from 'react'
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Box, Typography, Stepper, Step, StepLabel,
  Paper, Chip, IconButton, LinearProgress
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import HelpOutlineIcon from '@mui/icons-material/HelpOutline'
import NavigateNextIcon from '@mui/icons-material/NavigateNext'
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import DashboardIcon from '@mui/icons-material/Dashboard'
import Inventory2Icon from '@mui/icons-material/Inventory2'
import EventIcon from '@mui/icons-material/Event'
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner'
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings'
import { useNavigate } from 'react-router-dom'

const STEPS = [
  {
    title: 'Bienvenido a iNOISE RFID',
    icon: <QrCodeScannerIcon sx={{ fontSize: 36, color: '#66FCF1' }} />,
    path: null,
    content: [
      'Este sistema gestiona el ciclo completo de tu equipamiento de eventos, desde que sale de bodega hasta que regresa.',
      'El tour te llevará por cada sección en 2 minutos. Puedes salir en cualquier momento y retomarlo cuando quieras.',
    ],
    tip: null,
  },
  {
    title: 'Dashboard — visión general',
    icon: <DashboardIcon sx={{ fontSize: 36, color: '#66FCF1' }} />,
    path: '/dashboard',
    content: [
      'El Dashboard muestra el estado global de tu inventario: cuántos artículos están disponibles, reservados, ocupados o con incidencias.',
      'También verás los próximos eventos programados y alertas del sistema.',
    ],
    tip: 'Úsalo al inicio de cada jornada para tener un panorama rápido antes de operar.',
  },
  {
    title: 'Inventario — estado de cada artículo',
    icon: <Inventory2Icon sx={{ fontSize: 36, color: '#66FCF1' }} />,
    path: '/inventory',
    content: [
      'Aquí puedes ver todos tus productos y el estado de cada unidad: Disponible, Reservado, Ocupado, En Mantenimiento o Perdido.',
      'El selector "Disponibilidad al día" te permite consultar qué tienes libre para una fecha futura específica. El sistema descuenta automáticamente lo comprometido en otros eventos.',
    ],
    tip: 'Antes de crear un evento, consulta la disponibilidad para esa fecha exacta.',
  },
  {
    title: 'Eventos — planificación',
    icon: <EventIcon sx={{ fontSize: 36, color: '#66FCF1' }} />,
    path: '/events',
    content: [
      'Crea eventos con nombre, fecha, lugar y los artículos necesarios. El sistema reserva el equipo automáticamente desde el día del evento.',
      'Puedes buscar cualquier evento por su número de orden (ej: EVT-101) y compartir sus detalles por PDF, WhatsApp o correo.',
    ],
    tip: 'El sistema bloquea asignar más artículos de los disponibles para esa fecha.',
  },
  {
    title: 'Operaciones — el ciclo logístico',
    icon: <LocalShippingIcon sx={{ fontSize: 36, color: '#66FCF1' }} />,
    path: '/operations',
    content: [
      'Cada evento pasa por 4 fases: Despacho bodega → Recepción evento → Despacho evento → Recepción bodega.',
      'La barra de progreso va del 0% al 100%. Cada fase completa suma 25%. No puedes saltar fases — el sistema garantiza el orden.',
      'Si un artículo se pierde o llega dañado, se registra la incidencia y se notifica automáticamente por WhatsApp y correo.',
    ],
    tip: 'Usa "Simular lectura RFID" para probar el flujo. En producción, las antenas y la pistola hacen esto automáticamente.',
  },
  {
    title: 'Control de administrador',
    icon: <AdminPanelSettingsIcon sx={{ fontSize: 36, color: '#66FCF1' }} />,
    path: '/operations',
    content: [
      'Solo el Administrador puede forzar el cierre de una fase o del ciclo completo, por ejemplo ante una falla técnica.',
      'Cada cierre forzado queda registrado con fecha, hora, nombre del responsable y motivo. Todo es auditable.',
    ],
    tip: 'El operador puede ejecutar todas las fases normales, pero no puede forzar cierres ni eliminar eventos.',
  },
  {
    title: 'Listo para operar',
    icon: <CheckCircleIcon sx={{ fontSize: 36, color: '#66FCF1' }} />,
    path: null,
    content: [
      'Ya conoces las secciones principales del sistema. Puedes volver a este tour en cualquier momento desde el botón de ayuda (?) en la barra superior.',
      '¿Listo para crear tu primer evento?',
    ],
    tip: null,
  },
]

/* ─── Botón flotante de ayuda ─────────────────────────────────────────────── */
export function HelpButton({ onClick }) {
  return (
    <IconButton
      onClick={onClick}
      size="small"
      sx={{
        color: '#C5C6C7',
        border: '1px solid',
        borderColor: 'rgba(255,255,255,0.15)',
        borderRadius: '50%',
        width: 32,
        height: 32,
      }}
      title="Tour de ayuda"
    >
      <HelpOutlineIcon sx={{ fontSize: 18 }} />
    </IconButton>
  )
}

/* ─── Modal del tour ──────────────────────────────────────────────────────── */
export function HelpTour({ open, onClose }) {
  const navigate = useNavigate()
  const [step, setStep] = React.useState(0)
  const current = STEPS[step]
  const isLast = step === STEPS.length - 1
  const isFirst = step === 0
  const progress = Math.round((step / (STEPS.length - 1)) * 100)

  const goNext = () => {
    const next = step + 1
    if (next < STEPS.length) {
      setStep(next)
      if (STEPS[next].path) navigate(STEPS[next].path)
    }
  }

  const goPrev = () => {
    const prev = step - 1
    if (prev >= 0) {
      setStep(prev)
      if (STEPS[prev].path) navigate(STEPS[prev].path)
    }
  }

  const handleClose = () => {
    setStep(0)
    onClose()
  }

  const handleFinish = () => {
    handleClose()
    navigate('/events')
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: 3, border: '1px solid rgba(102,252,241,0.2)' } }}
    >
      {/* Header */}
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            Tour de ayuda — {step + 1} de {STEPS.length}
          </Typography>
          <IconButton size="small" onClick={handleClose}>
            <CloseIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>
        <LinearProgress
          variant="determinate"
          value={progress}
          sx={{ mt: 1, height: 3, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.08)',
            '& .MuiLinearProgress-bar': { bgcolor: '#66FCF1' } }}
        />
      </DialogTitle>

      {/* Contenido */}
      <DialogContent sx={{ pt: 1 }}>
        <Box sx={{ textAlign: 'center', mb: 2.5 }}>
          {current.icon}
          <Typography variant="h6" fontWeight={600} sx={{ mt: 1 }}>
            {current.title}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 2 }}>
          {current.content.map((line, i) => (
            <Box key={i} sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
              <Box sx={{
                width: 6, height: 6, borderRadius: '50%', bgcolor: '#66FCF1',
                flexShrink: 0, mt: 0.8
              }} />
              <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                {line}
              </Typography>
            </Box>
          ))}
        </Box>

        {current.tip && (
          <Paper sx={{ p: 1.5, bgcolor: 'rgba(102,252,241,0.06)', border: '1px solid rgba(102,252,241,0.2)', borderRadius: 2 }}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
              <Typography variant="caption" sx={{ color: '#66FCF1', fontWeight: 600, flexShrink: 0 }}>
                Consejo
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {current.tip}
              </Typography>
            </Box>
          </Paper>
        )}

        {/* Navegación de pasos */}
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.8, mt: 3 }}>
          {STEPS.map((_, i) => (
            <Box
              key={i}
              onClick={() => { setStep(i); if (STEPS[i].path) navigate(STEPS[i].path) }}
              sx={{
                width: i === step ? 20 : 8,
                height: 8,
                borderRadius: 4,
                bgcolor: i === step ? '#66FCF1' : i < step ? 'rgba(102,252,241,0.4)' : 'rgba(255,255,255,0.15)',
                cursor: 'pointer',
                transition: 'all 0.3s',
              }}
            />
          ))}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5, justifyContent: 'space-between' }}>
        <Button
          startIcon={<NavigateBeforeIcon />}
          disabled={isFirst}
          onClick={goPrev}
          variant="outlined"
          size="small"
        >
          Anterior
        </Button>

        {isLast ? (
          <Button
            variant="contained"
            size="small"
            onClick={handleFinish}
            sx={{ bgcolor: '#66FCF1', color: '#0B0C10', '&:hover': { bgcolor: '#4ee0d0' } }}
          >
            Crear mi primer evento
          </Button>
        ) : (
          <Button
            endIcon={<NavigateNextIcon />}
            variant="contained"
            size="small"
            onClick={goNext}
            sx={{ bgcolor: '#66FCF1', color: '#0B0C10', '&:hover': { bgcolor: '#4ee0d0' } }}
          >
            Siguiente
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}
