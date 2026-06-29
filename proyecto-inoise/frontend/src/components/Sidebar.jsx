import React from 'react'
import {
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Box,
  Toolbar,
  Avatar,
  Typography,
  IconButton
} from '@mui/material'

import DashboardIcon from '@mui/icons-material/Dashboard'
import Inventory2Icon from '@mui/icons-material/Inventory2'
import WidgetsIcon from '@mui/icons-material/Widgets'
import RouterIcon from '@mui/icons-material/Router'
import HistoryIcon from '@mui/icons-material/History'
import BarChartIcon from '@mui/icons-material/BarChart'
import PeopleIcon from '@mui/icons-material/People'
import SettingsIcon from '@mui/icons-material/Settings'
import EventIcon from '@mui/icons-material/Event'
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner'
import HandshakeIcon from '@mui/icons-material/Handshake'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'

import { useNavigate, useLocation } from 'react-router-dom'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useAuth } from '../context/AuthContext'

// Azul metálico para la sección activa — coherente con el resto de la paleta oscura
const ACTIVE_BG = '#2C4A66'
const ACTIVE_BG_HOVER = '#34587a'

const items = [
  { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
  { text: 'Inventario', icon: <Inventory2Icon />, path: '/inventory' },
  { text: 'Productos', icon: <WidgetsIcon />, path: '/products' },
  { text: 'Antenas', icon: <RouterIcon />, path: '/antennas' },
  { text: 'Registrar RFID', icon: <QrCodeScannerIcon />, path: '/rfid-registrar' },
  { text: 'Eventos', icon: <EventIcon />, path: '/events' },
  { text: 'Rental', icon: <HandshakeIcon />, path: '/rental' },
  { text: 'Operaciones', icon: <LocalShippingIcon />, path: '/operations' },
  { text: 'Historial', icon: <HistoryIcon />, path: '/history' },
  { text: 'Reporte de operaciones', icon: <BarChartIcon />, path: '/reports' },
  { text: 'Usuarios', icon: <PeopleIcon />, path: '/users' },
  { text: 'Configuración', icon: <SettingsIcon />, path: '/settings' }
]

export default function Sidebar({ open = true, onToggle }) {
  const navigate = useNavigate()
  const location = useLocation()
  const isSmall = useMediaQuery('(max-width:900px)')
  const drawerWidth = open ? 240 : 72

  return (
    <Drawer
      variant={isSmall ? 'temporary' : 'permanent'}
      open={open}
      onClose={onToggle}
      sx={{
        width: drawerWidth,
        '& .MuiDrawer-paper': {
          width: drawerWidth,
          backgroundColor: '#1F2833',
          color: '#C5C6C7',
          boxSizing: 'border-box',
          overflowX: 'hidden',
          transition: 'width 0.60s ease'
        }
      }}
    >
      {/* HEADER — altura fija (no crece), así el logo más grande nunca
          empuja el menú hacia abajo ni cambia la posición del sidebar. */}
      <Toolbar
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: open ? 'space-between' : 'center',
          px: 1.25,
          minHeight: 64
        }}
      >
        {/* LOGO (solo cuando está abierto) — la caja recorta (overflow
            hidden) y la imagen se escala más ancha que su contenedor para
            "hacer zoom" sobre las letras y descartar el margen/espacio en
            blanco que trae el archivo, sin alterar el alto del header. */}
        {open && (
          <Box
            sx={{
              flex: 1,
              height: 56,
              overflow: 'hidden',
              position: 'relative',
              minWidth: 0
            }}
          >
            <Box
              component="img"
              src="/logo-header.png"
              alt="Orbitag"
              sx={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                width: '180%',
                maxWidth: 'none',
                height: 'auto',
                objectFit: 'contain',
                display: 'block',
                transform: 'translate(-50%, -42%)'
              }}
            />
          </Box>
        )}

        {/* FLECHA — SIEMPRE VISIBLE */}
        <IconButton
          onClick={onToggle}
          sx={{
            color: '#C5C6C7',
            transition: 'transform 0.2s ease'
          }}
        >
          {open ? <ChevronLeftIcon /> : <ChevronRightIcon />}
        </IconButton>
      </Toolbar>

      {/* MENU */}
      <List>
        {items.map(item => {
          // Activa = la sección en la que el usuario está parado ahora mismo
          // (no solo "clic reciente"): se recalcula con la ruta actual, así
          // que se mantiene resaltada mientras navegue dentro de esa sección
          // y al volver a entrar más tarde.
          const isActive = location.pathname === item.path ||
            location.pathname.startsWith(item.path + '/')

          return (
            <ListItemButton
              key={item.text}
              selected={isActive}
              onClick={() => {
                navigate(item.path)
                if (isSmall) onToggle()
              }}
              sx={{
                py: 1.2,
                justifyContent: open ? 'flex-start' : 'center',
                borderLeft: isActive ? '3px solid #66FCF1' : '3px solid transparent',
                bgcolor: isActive ? ACTIVE_BG : 'transparent',
                color: isActive ? '#fff' : '#C5C6C7',
                '&:hover': {
                  bgcolor: isActive ? ACTIVE_BG_HOVER : 'rgba(255,255,255,0.06)'
                },
                '&.Mui-selected': {
                  bgcolor: ACTIVE_BG
                },
                '&.Mui-selected:hover': {
                  bgcolor: ACTIVE_BG_HOVER
                }
              }}
            >
              <ListItemIcon
                sx={{
                  color: isActive ? '#fff' : '#C5C6C7',
                  minWidth: open ? 40 : 'auto',
                  justifyContent: 'center'
                }}
              >
                {item.icon}
              </ListItemIcon>

              {open && (
                <ListItemText
                  primary={item.text}
                  primaryTypographyProps={{ sx: { color: isActive ? '#fff' : 'inherit', fontWeight: isActive ? 600 : 400 } }}
                />
              )}
            </ListItemButton>
          )
        })}
      </List>
    </Drawer>
  )
}
