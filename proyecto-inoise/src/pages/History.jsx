import React from 'react'
import { Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody } from '@mui/material'
import { api } from '../services/api'

export default function History() {
  const [data, setData] = React.useState([])

  React.useEffect(() => {
    api.getHistory().then(res => setData(res))
  }, [])

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>Historial</Typography>

      <Paper sx={{ p: 2 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Fecha</TableCell>
              <TableCell>Usuario</TableCell>
              <TableCell>Acción</TableCell>
              <TableCell>Producto</TableCell>
              <TableCell>Cantidad</TableCell>
              <TableCell>Notas</TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {data.map(h => (
              <TableRow key={h.id}>
                <TableCell>{h.date}</TableCell>
                <TableCell>{h.user}</TableCell>
                <TableCell>{h.action}</TableCell>
                <TableCell>{h.product}</TableCell>
                <TableCell>{h.qty}</TableCell>
                <TableCell>{h.note}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  )
}
