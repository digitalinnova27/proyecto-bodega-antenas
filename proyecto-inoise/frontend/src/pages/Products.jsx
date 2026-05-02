import React from 'react'
import { Box, Typography, Paper, List, ListItem, ListItemText, Chip } from '@mui/material'
import { useInventory } from '../context/InventoryContext'

export default function Products() {
  const { products } = useInventory()

  return (
    <Box sx={{ padding: 3 }}>
      <Typography variant="h5" sx={{ mb: 2 }}>Productos</Typography>
      <Paper sx={{ p: 2 }}>
        <List>
          {products.map(p => (
            <ListItem key={p.id} divider>
              <ListItemText
                primary={`${p.name} (SKU: ${p.sku})`}
                secondary={`Categoría: ${p.category} — Total: ${p.total} unidades`}
              />
              <Chip label={p.category} color="primary" variant="outlined" />
            </ListItem>
          ))}
        </List>
      </Paper>
    </Box>
  )
}
