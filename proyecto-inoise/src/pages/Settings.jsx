import React from 'react'
import { Box, Typography, Paper, FormControlLabel, Switch } from '@mui/material'

export default function Settings(){
  return (
    <Box>
      <Typography variant="h5" sx={{ mb:2 }}>Configuraciones</Typography>
      <Paper sx={{ p:2 }}>
        <FormControlLabel control={<Switch defaultChecked />} label="Notificaciones por correo" />
        <FormControlLabel control={<Switch defaultChecked />} label="Alertas en panel" />
      </Paper>
    </Box>
  )
}
