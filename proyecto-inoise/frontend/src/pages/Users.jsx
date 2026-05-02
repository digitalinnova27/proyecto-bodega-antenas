import React from 'react'
import { Box, Typography, Paper, List, ListItem, ListItemText } from '@mui/material'

export default function Users(){
  return (
    <Box>
      <Typography variant="h5" sx={{ mb:2 }}>Usuarios y Permisos</Typography>
      <Paper sx={{ p:2 }}>
        <List>
          <ListItem><ListItemText primary="Admin — acceso total" secondary="admin@empresa.cl" /></ListItem>
          <ListItem><ListItemText primary="Operador — control de inventario" secondary="operador@empresa.cl" /></ListItem>
        </List>
      </Paper>
    </Box>
  )
}
