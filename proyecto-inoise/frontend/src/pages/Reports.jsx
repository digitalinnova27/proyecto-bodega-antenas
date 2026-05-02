import React from 'react'
import { Box, Typography, Paper, Button, TextField } from '@mui/material'
import jsPDF from 'jspdf'

export default function Reports(){
  const [month, setMonth] = React.useState('2025-12')

  const genPDF = ()=>{
    const doc = new jsPDF()
    doc.text('Reporte mensual - Demo ('+month+')', 10,10)
    doc.save('reporte_'+month+'.pdf')
  }
  return (
    <Box>
      <Typography variant="h5" sx={{ mb:2 }}>Reportes</Typography>
      <Paper sx={{ p:2 }}>
        <TextField label="Mes" type="month" value={month} onChange={e=>setMonth(e.target.value)} sx={{ mr:2 }} />
        <Button variant="contained" onClick={genPDF}>Generar PDF demo</Button>
      </Paper>
    </Box>
  )
}
