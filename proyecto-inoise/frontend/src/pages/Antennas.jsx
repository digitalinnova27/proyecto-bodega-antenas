import React from 'react'
import { Box, Typography, Paper, List, ListItem, ListItemText, LinearProgress } from '@mui/material'
import { antennas } from '../mockData'

export default function Antennas(){
  return (
    <Box>
      <Typography variant="h5" sx={{ mb:2 }}>Antenas / Lectores</Typography>
      <Paper sx={{ p:2 }}>
        <List>
          {antennas.map(a=> (
            <ListItem key={a.id} secondaryAction={<Typography variant="caption">{a.last}</Typography>}>
              <ListItemText primary={a.name} secondary={`Estado: ${a.status}`} />
              <Box sx={{ width:200, ml:2 }}>
                <LinearProgress variant="determinate" value={a.signal} sx={{ height:10, borderRadius:2 }} />
                <Typography variant="caption">{a.signal}% Señal</Typography>
              </Box>
            </ListItem>
          ))}
        </List>
      </Paper>
    </Box>
  )
}
