import { products, events, antennas, history } from '../mockData'

export const api = {
  getProducts: async () => new Promise(res=> setTimeout(()=> res(products), 150)),
  getProductById: async (id) => products.find(p=>p.id===id) || null,
  getEvents: async ()=> new Promise(res=> setTimeout(()=> res(events), 150)),
  getAntennas: async ()=> new Promise(res=> setTimeout(()=> res(antennas), 150)),
  getHistory: async ()=> new Promise(res=> setTimeout(()=> res(history), 150)),
}
