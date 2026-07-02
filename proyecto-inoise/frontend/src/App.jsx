import React from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Button,
  Divider
} from '@mui/material'

import MenuIcon from '@mui/icons-material/Menu'
import NotificationsIcon from '@mui/icons-material/Notifications'
import WifiIcon from '@mui/icons-material/Wifi'
import WifiOffIcon from '@mui/icons-material/WifiOff'
import EventIcon from '@mui/icons-material/Event'
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import Badge from '@mui/material/Badge'
import Popover from '@mui/material/Popover'

import Sidebar from './components/Sidebar'
import { useNotifications } from './hooks/useNotifications'

import Dashboard from './pages/Dashboard'
import Inventory from './pages/Inventory'
import Products from './pages/Products'
import Antennas from './pages/Antennas'
import Events from './pages/Events'
import History from './pages/History'
import Reports from './pages/Reports'
import Users from './pages/Users'
import Settings from './pages/Settings'
import Operations from './pages/Operations'
import Rental from './pages/Rental'
import RfidRegistrar from './pages/RfidRegistrar'
import Login from './pages/Login'

import { useAuth } from './context/AuthContext'
import { RfidSocketProvider } from './context/RfidSocketContext'
import { HelpTour, HelpButton } from './components/HelpTour'

// Severidad → colores del tema (theme.js / paleta usada en Dashboard.jsx)
const NOTIF_COLORS = {
  danger: { bg: 'rgba(226,75,74,0.12)', fg: '#E24B4A' },
  warning: { bg: 'rgba(239,159,39,0.12)', fg: '#EF9F27' },
  info: { bg: 'rgba(55,138,221,0.12)', fg: '#378ADD' },
  accent: { bg: 'rgba(102,252,241,0.12)', fg: '#66FCF1' }
}

const NOTIF_ICONS = {
  'ti-calendar-event': EventIcon,
  'ti-truck-return': LocalShippingIcon
}

// Estado persistente de la antena (no es una notificación descartable) →
// ícono + color, sincronizado con la cobertura/conexión real del bridge.
// "neutral" (conectada, esperando lecturas) se pinta igual de verde que
// "good": estar conectada y a la espera de su primera lectura no es una
// falla, así que visualmente debe verse "bien" desde el primer momento,
// no solo decirlo por texto.
const ANTENNA_STATUS_STYLE = {
  offline: { icon: WifiOffIcon, fg: '#E24B4A', bg: 'rgba(226,75,74,0.12)' },
  neutral: { icon: WifiIcon, fg: '#1D9E75', bg: 'rgba(29,158,117,0.12)' },
  low: { icon: WifiIcon, fg: '#E24B4A', bg: 'rgba(226,75,74,0.12)' },
  good: { icon: WifiIcon, fg: '#1D9E75', bg: 'rgba(29,158,117,0.12)' }
}

export default function App() {
  const { role, logout, currentUser } = useAuth()
  const navigate = useNavigate()

  const [open, setOpen] = React.useState(true)
  const [openTour, setOpenTour] = React.useState(false)
  const [anchorEl, setAnchorEl] = React.useState(null)

  const { notifications, unread, markSeen, markAllSeen, antennaStatus } = useNotifications()

  const openNotif = (e) => setAnchorEl(e.currentTarget)

  // Cerrar la campanita (clic afuera, Esc) SOLO oculta el popover — las
  // notificaciones deben persistir hasta que el usuario las marque como
  // leídas explícitamente (botón "Ir" de cada una, o "Marcar todas como
  // leídas"). Antes esto las marcaba todas como leídas al cerrar, por lo
  // que desaparecían sin que el cliente llegara a verlas de nuevo.
  const closeNotif = () => setAnchorEl(null)

  const goToNotification = (n) => {
    markSeen(n.id)
    setAnchorEl(null)
    navigate(n.route)
  }

  const handleLogout = () => {
    logout()
  }

  return (
    <RfidSocketProvider>
    <Routes>

      {/* ================= LOGIN ================= */}
      {!role && (
        <>
          <Route path="/login" element={<Login />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </>
      )}

      {/* ================= APP AUTENTICADA ================= */}
      {role && (
        <Route
          path="/*"
          element={
            <Box sx={{ display: 'flex' }}>

              {/* ================= APP BAR ================= */}
              <AppBar position="fixed" sx={{ backgroundColor: '#0B0C10' }}>
                <Toolbar sx={{ display: 'flex', justifyContent: 'space-between' }}>

                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <IconButton
                      color="inherit"
                      onClick={() => setOpen(o => !o)}
                    >
                      <MenuIcon />
                    </IconButton>

                    <HelpButton onClick={() => setOpenTour(true)} />
                    <IconButton color="inherit" onClick={openNotif}>
                      <Badge badgeContent={unread} color="error">
                        <NotificationsIcon />
                      </Badge>
                    </IconButton>

                    <Popover
                      open={Boolean(anchorEl)}
                      anchorEl={anchorEl}
                      onClose={closeNotif}
                      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                      transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                      slotProps={{ paper: { sx: { bgcolor: '#1F2833', border: '0.5px solid rgba(102,252,241,0.15)' } } }}
                    >
                      <Box sx={{ width: 340 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, pt: 1.5, pb: 1 }}>
                          <Typography variant="subtitle1" sx={{ color: '#66FCF1', fontWeight: 500 }}>
                            Notificaciones
                          </Typography>
                          {unread > 0 && (
                            <Typography variant="caption" sx={{ color: '#C5C6C7' }}>
                              {unread} sin leer
                            </Typography>
                          )}
                        </Box>

                        <Divider sx={{ borderColor: 'rgba(102,252,241,0.12)' }} />

                        {/* Estado de la antena — fijo, siempre visible, no se "marca leído" */}
                        {(() => {
                          const style = ANTENNA_STATUS_STYLE[antennaStatus.state]
                          const AntennaIcon = style.icon
                          return (
                            <Box
                              onClick={() => { closeNotif(); navigate('/antennas') }}
                              sx={{
                                display: 'flex', alignItems: 'center', gap: 1.5,
                                px: 2, py: 1.25, cursor: 'pointer',
                                borderBottom: '0.5px solid rgba(102,252,241,0.12)',
                                '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' }
                              }}
                            >
                              <Box sx={{
                                width: 30, height: 30, flexShrink: 0, borderRadius: '50%',
                                bgcolor: style.bg, display: 'flex', alignItems: 'center', justifyContent: 'center'
                              }}>
                                <AntennaIcon sx={{ fontSize: 16, color: style.fg }} />
                              </Box>
                              <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography variant="body2" fontWeight={600} sx={{ color: '#C5C6C7' }}>
                                  Antena
                                </Typography>
                                <Typography variant="caption" sx={{ color: style.fg }}>
                                  {antennaStatus.label}
                                </Typography>
                              </Box>
                            </Box>
                          )
                        })()}

                        {notifications.length === 0 && (
                          <Box sx={{ px: 2, py: 4, textAlign: 'center' }}>
                            <Typography variant="body2" sx={{ color: '#C5C6C7', fontWeight: 500 }}>
                              Bandeja de entrada vacía
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#888' }}>
                              Sin notificaciones por ahora
                            </Typography>
                          </Box>
                        )}

                        {notifications.map(n => {
                          const colors = NOTIF_COLORS[n.severity]
                          const Icon = NOTIF_ICONS[n.icon]
                          return (
                            <Box key={n.id} sx={{
                              display: 'flex', alignItems: 'flex-start', gap: 1.5,
                              px: 2, py: 1.5,
                              borderBottom: '0.5px solid rgba(102,252,241,0.08)'
                            }}>
                              <Box sx={{
                                width: 30, height: 30, flexShrink: 0, borderRadius: '50%',
                                bgcolor: colors.bg, display: 'flex', alignItems: 'center', justifyContent: 'center'
                              }}>
                                <Icon sx={{ fontSize: 16, color: colors.fg }} />
                              </Box>
                              <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography variant="body2" fontWeight={600} sx={{ color: '#C5C6C7' }}>
                                  {n.title}
                                </Typography>
                                <Typography variant="caption" sx={{ color: '#888' }}>
                                  {n.text}
                                </Typography>
                              </Box>
                              <Button
                                size="small"
                                onClick={() => goToNotification(n)}
                                endIcon={<ArrowForwardIcon sx={{ fontSize: 14 }} />}
                                sx={{ flexShrink: 0, fontSize: 12, color: '#66FCF1', minWidth: 0 }}
                              >
                                Ir
                              </Button>
                            </Box>
                          )
                        })}

                        <Divider sx={{ borderColor: 'rgba(102,252,241,0.12)' }} />

                        <Box sx={{ px: 2, py: 1.5 }}>
                          <Button
                            fullWidth
                            variant="contained"
                            onClick={markAllSeen}
                            disabled={unread === 0}
                            sx={{
                              bgcolor: '#1D9E75',
                              color: '#000',
                              fontWeight: 700,
                              py: 1,
                              '&:hover': { bgcolor: '#17835f' },
                              '&.Mui-disabled': { bgcolor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.3)' }
                            }}
                          >
                            Marcar todas como leídas
                          </Button>
                        </Box>
                      </Box>
                    </Popover>

                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Typography variant="caption" sx={{ textAlign: 'right' }}>
                      {currentUser
                        ? `${currentUser.nombre} ${currentUser.apellido}`
                        : role === 'admin' ? 'Administrador' : 'Operador'}
                      <br />
                      <span style={{ opacity: 0.6, fontSize: '0.9em' }}>
                        {role === 'admin' ? 'Administrador' : 'Operador'}
                      </span>
                    </Typography>

                    <Button
                      size="small"
                      variant="outlined"
                      onClick={handleLogout}
                    >
                      Cerrar sesión
                    </Button>
                  </Box>

                </Toolbar>
              </AppBar>

              {/* ================= SIDEBAR ================= */}
              <Sidebar
                open={open}
                onToggle={() => setOpen(o => !o)}
              />

              {/* ================= CONTENIDO ================= */}
              <Box
                component="main"
                sx={{
                  flexGrow: 1,
                  p: 3,
                  mt: 8,
                  ml: open ? '240px' : '72px',
                  transition: 'margin-left 0.6s ease',
                  backgroundColor: '#0B0C10',
                  minHeight: '100vh'
                }}
              >
                <Routes>
                  <Route path="/" element={<Navigate to="/dashboard" />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/inventory" element={<Inventory />} />
                  <Route path="/products" element={<Products />} />
                  <Route path="/antennas" element={<Antennas />} />
                  <Route path="/events" element={<Events />} />
                  <Route path="/operations" element={<Operations />} />
                  <Route path="/history" element={<History />} />
                  <Route path="/reports" element={<Reports />} />
                  <Route path="/users" element={<Users />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/rental" element={<Rental />} />
                  <Route path="/rfid-registrar" element={<RfidRegistrar />} />
                </Routes>
              </Box>

            </Box>
          }
        />
      )}
    </Routes>
    </RfidSocketProvider>
  )
}
