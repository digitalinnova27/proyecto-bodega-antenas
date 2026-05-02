import React from 'react'
import { Box, Grid, Paper, Typography } from '@mui/material'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { products } from '../mockData'

const cols = ['#66FCF1','#45A29E','#C5C6C7','#F39C12','#E74C3C','#9B59B6']

function kpis(){ 
  const total = products.reduce((s,p)=>s+p.qty,0)
  const out = products.filter(p=>p.state !== 'Disponible').reduce((s,p)=>s+p.qty,0)
  const inStock = total - out
  const pctIn = total? Math.round((inStock/total)*100):100
  const categories = [...new Set(products.map(p=>p.category))].length
  return { total, categories, items: products.length, inStock, out, pctIn }
}

export default function Dashboard(){
  const stockByCategory = products.reduce((acc,p)=>{ acc[p.category]=(acc[p.category]||0)+p.qty; return acc },{})
  const catData = Object.keys(stockByCategory).map((k)=>({ name:k, value:stockByCategory[k] }))
  const stats = kpis()

  return (
    <Box>
      <Typography variant="h5" sx={{ mb:2 }}>Dashboard</Typography>
      <Typography variant="caption" sx={{ mb:2, display:'block' }}>Equipos en stock: {stats.inStock} • Fuera: {stats.out} • {stats.pctIn}% en stock</Typography>
      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p:2 }}>
            <Typography variant="subtitle2">Total Equipos</Typography>
            <Typography variant="h4">{stats.total}</Typography>
            <Typography variant="caption">Categorias: {stats.categories} • Productos: {stats.items}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={8}>
          <Paper sx={{ p:2, height:220 }}>
            <Typography variant="subtitle2">Stock por categoría</Typography>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart className="responsive-chart">
                <Pie data={catData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60}>
                  {catData.map((entry, index) => <Cell key={index} fill={cols[index % cols.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p:2, height:300 }}>
            <Typography variant="subtitle2">Entradas y Salidas (demo)</Typography>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={[{name:'Nov', entradas:40, salidas:30},{name:'Dic', entradas:20, salidas:10}]}>
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="entradas" />
                <Bar dataKey="salidas" />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p:2, height:300 }}>
            <Typography variant="subtitle2">Equipos asignados por evento (demo)</Typography>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={[{name:'Matrimonio', assigned:2},{name:'Sporting', assigned:1}] }>
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="assigned" />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  )
}
