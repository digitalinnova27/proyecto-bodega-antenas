import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Button
} from '@mui/material'

import MenuIcon from '@mui/icons-material/Menu'
import NotificationsIcon from '@mui/icons-material/Notifications'
import Badge from '@mui/material/Badge'
import Popover from '@mui/material/Popover'

import Sidebar from './components/Sidebar'

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
import Login from './pages/Login'

import { useAuth } from './context/AuthContext'
import { HelpTour, HelpButton } from './components/HelpTour'

export default function App() {
  const { role, logout } = useAuth()

  const [open, setOpen] = React.useState(true)
  const [openTour, setOpenTour] = React.useState(false)
  const [anchorEl, setAnchorEl] = React.useState(null)

  const [notifications, setNotifications] = React.useState([
    { id: 1, type: 'Antena offline', text: 'Antena 2 está offline', seen: false },
    { id: 2, type: 'Sin stock', text: 'Par LED con bajo stock', seen: false }
  ])

  const unread = notifications.filter(n => !n.seen).length

  const openNotif = (e) => setAnchorEl(e.currentTarget)
  const closeNotif = () => setAnchorEl(null)

  const markAll = () =>
    setNotifications(notifications.map(n => ({ ...n, seen: true })))

  const handleLogout = () => {
    logout()
  }

  return (
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
                    >
                      <Box sx={{ width: 300, p: 2 }}>
                        <Typography variant="subtitle1">
                          Notificaciones
                        </Typography>

                        <Button size="small" onClick={markAll}>
                          Marcar todas
                        </Button>

                        {notifications.map(n => (
                          <Box key={n.id} sx={{ mt: 1 }}>
                            <Typography variant="body2">
                              <strong>{n.type}</strong>
                            </Typography>
                            <Typography variant="caption">
                              {n.text}
                            </Typography>
                          </Box>
                        ))}
                      </Box>
                    </Popover>

                    <Typography sx={{ ml: 2 }}>
                      RFID - Control Bodega
                    </Typography>
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Typography variant="caption">
                      {role === 'admin'
                        ? 'Modo Administrador'
                        : 'Modo Operador'}
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
                </Routes>
              </Box>

            </Box>
          }
        />
      )}
    </Routes>
  )
}
