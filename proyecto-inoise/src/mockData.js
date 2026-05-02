// mockData.js - categorías actualizadas para coincidir con el Excel real
// Los productos ahora se cargan desde excelData.js (datos reales del Excel)
export { categories, INITIAL_PRODUCTS as products } from './excelData'

export const events = []

export const antennas = [
  { id:1, name:'Antena 1', status:'Activa', signal:87, last:'2025-12-10 14:23' },
  { id:2, name:'Antena 2', status:'Offline', signal:0, last:'2025-12-09 09:12' },
  { id:3, name:'Antena 3', status:'Activa', signal:65, last:'2025-12-10 13:55' }
]

export const history = []
