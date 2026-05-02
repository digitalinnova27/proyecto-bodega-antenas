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
import ChevronRightIcon from '@mui/icons-material/ChevronRight'

import { useNavigate } from 'react-router-dom'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useAuth } from '../context/AuthContext'

const items = [
  { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
  { text: 'Inventario', icon: <Inventory2Icon />, path: '/inventory' },
  { text: 'Productos', icon: <WidgetsIcon />, path: '/products' },
  { text: 'Antenas', icon: <RouterIcon />, path: '/antennas' },
  { text: 'Eventos', icon: <EventIcon />, path: '/events' },
  { text: 'Operaciones', icon: <LocalShippingIcon />, path: '/operations' },
  { text: 'Historial', icon: <HistoryIcon />, path: '/history' },
  { text: 'Reportes', icon: <BarChartIcon />, path: '/reports' },
  { text: 'Usuarios', icon: <PeopleIcon />, path: '/users' },
  { text: 'Configuración', icon: <SettingsIcon />, path: '/settings' }
]

export default function Sidebar({ open = true, onToggle }) {
  const navigate = useNavigate()
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
      {/* HEADER */}
      <Toolbar
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: open ? 'space-between' : 'center',
          px: 2
        }}
      >
        {/* LOGO (solo cuando está abierto) */}
        {open && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              transition: 'opacity 0.2s ease'
            }}
          >
            <Avatar sx={{ bgcolor: '#66FCF1', color: '#0B0C10' }}>
              RF
            </Avatar>
            <Box>
              <Typography variant="subtitle1">RFID</Typography>
              <Typography variant="caption">Control Bodega</Typography>
            </Box>
          </Box>
        )}

        {/* FLECHA — SIEMPRE VISIBLE */}
        <IconButton
          onClick={onToggle}
          sx={{
            color: '#C5C6C7',
            ml: open ? 0 : 0,
            transition: 'transform 0.2s ease'
          }}
        >
          {open ? <ChevronLeftIcon /> : <ChevronRightIcon />}
        </IconButton>
      </Toolbar>

      {/* MENU */}
      <List>
        {items.map(item => (
          <ListItemButton
            key={item.text}
            onClick={() => {
              navigate(item.path)
              if (isSmall) onToggle()
            }}
            sx={{
              py: 1.2,
              justifyContent: open ? 'flex-start' : 'center'
            }}
          >
            <ListItemIcon
              sx={{
                color: '#C5C6C7',
                minWidth: open ? 40 : 'auto',
                justifyContent: 'center'
              }}
            >
              {item.icon}
            </ListItemIcon>

            {open && <ListItemText primary={item.text} />}
          </ListItemButton>
        ))}
      </List>
    </Drawer>
  )
}
