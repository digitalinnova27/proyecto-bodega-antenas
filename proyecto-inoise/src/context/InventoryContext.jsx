import React, { createContext, useContext, useState } from 'react'
import { INITIAL_PRODUCTS } from '../excelData'

/* ─── Utilidad de fechas ──────────────────────────────────────────────────── */
// Compara solo la fecha (sin hora). Devuelve true si eventDate >= today.
const isActiveOnDate = (eventDateStr) => {
  if (!eventDateStr) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const evDate = new Date(eventDateStr + 'T00:00:00')
  return evDate >= today
}

// Devuelve true si dos eventos se solapan en fecha
// (por ahora tratamos cada evento como un día, fácil de extender a rango)
const eventsOverlapDate = (dateA, dateB) => dateA === dateB

/* ─── Datos iniciales ─────────────────────────────────────────────────────── */
let orderCounter = 100

/* ─── Context ─────────────────────────────────────────────────────────────── */
const InventoryContext = createContext(null)

export function InventoryProvider({ children }) {
  const [products, setProducts] = useState(INITIAL_PRODUCTS)
  const [events, setEvents] = useState([])

  /* ────────────────────────────────────────────────────────────────────────
   * getReservedQty(productId, forDate?, eventList?)
   *
   * Solo cuenta como "reservado" los eventos cuya fecha es >= hoy
   * (o >= forDate si se pasa).
   * Un evento pasado ya no bloquea disponibilidad.
   * Un evento Ocupado tampoco cuenta aquí (ya salió físicamente).
   * ──────────────────────────────────────────────────────────────────────── */
  const getReservedQty = (productId, forDate, eventList) => {
    const list = eventList || events
    const cutoff = forDate || new Date().toISOString().slice(0, 10)

    return list
      .filter(e =>
        // Solo eventos activos (desde el día del evento en adelante)
        isActiveOnDate(e.date) &&
        // Solo si la fecha del evento es >= la fecha consultada
        e.date >= cutoff &&
        // No contar eventos que ya salieron (Ocupado) ni realizados
        !['Realizado', 'Suspendido'].includes(e.status)
      )
      .flatMap(e => e.assignments || [])
      .filter(a => a.productId === productId)
      .reduce((sum, a) => sum + a.qty, 0)
  }

  /* ────────────────────────────────────────────────────────────────────────
   * getAvailableQty(productId, forDate?)
   *
   * Cantidad disponible PARA UNA FECHA DADA.
   * Si no se pasa fecha, usa hoy.
   * ──────────────────────────────────────────────────────────────────────── */
  const getAvailableQty = (productId, forDate) => {
    const product = products.find(p => p.id === productId)
    if (!product) return 0

    const reserved = getReservedQty(productId, forDate)
    const blocked = product.units.filter(u =>
      ['Ocupado', 'En Mantenimiento', 'Perdido'].includes(u.state)
    ).length

    return Math.max(product.total - reserved - blocked, 0)
  }

  /* ────────────────────────────────────────────────────────────────────────
   * getAvailableQtyForEvent(productId, eventId, forDate?)
   *
   * Disponibilidad al crear/editar UN evento específico:
   * excluye las reservas del propio evento para no restarse a sí mismo.
   * ──────────────────────────────────────────────────────────────────────── */
  const getAvailableQtyForEvent = (productId, eventId, forDate) => {
    const product = products.find(p => p.id === productId)
    if (!product) return 0

    const cutoff = forDate || new Date().toISOString().slice(0, 10)

    const reserved = (events)
      .filter(e =>
        e.id !== eventId &&
        isActiveOnDate(e.date) &&
        e.date >= cutoff &&
        !['Realizado', 'Suspendido'].includes(e.status)
      )
      .flatMap(e => e.assignments || [])
      .filter(a => a.productId === productId)
      .reduce((sum, a) => sum + a.qty, 0)

    const blocked = product.units.filter(u =>
      ['Ocupado', 'En Mantenimiento', 'Perdido'].includes(u.state)
    ).length

    return Math.max(product.total - reserved - blocked, 0)
  }

  /* ────────────────────────────────────────────────────────────────────────
   * recalcProductUnits
   *
   * Recalcula el estado físico de las unidades basándose en los eventos.
   * - Reservado: eventos activos (fecha >= hoy) que usan el artículo
   * - Ocupado:   eventos en estado 'En curso' (salieron de bodega)
   * - El resto queda Disponible (salvo Mantenimiento/Perdido que no se tocan)
   * ──────────────────────────────────────────────────────────────────────── */
  const recalcProductUnits = (newEvents, currentProducts) => {
    const today = new Date().toISOString().slice(0, 10)

    return currentProducts.map(product => {
      // 1. Reset: solo unidades en estado Reservado u Ocupado vuelven a Disponible
      const resetUnits = product.units.map(u =>
        ['Reservado', 'Ocupado'].includes(u.state)
          ? { ...u, state: 'Disponible' }
          : u
      )

      // 2. Calcular cuántas unidades deben estar Ocupadas
      //    (eventos con status 'En curso' — ya salieron de bodega)
      const toOccupy = newEvents
        .filter(e => e.status === 'En curso')
        .flatMap(e => e.assignments || [])
        .filter(a => a.productId === product.id)
        .reduce((sum, a) => sum + a.qty, 0)

      // 3. Calcular cuántas deben estar Reservadas
      //    (eventos activos, fecha >= hoy, que NO están En curso ni terminados)
      const toReserve = newEvents
        .filter(e =>
          isActiveOnDate(e.date) &&
          e.date >= today &&
          !['Realizado', 'Suspendido', 'En curso'].includes(e.status)
        )
        .flatMap(e => e.assignments || [])
        .filter(a => a.productId === product.id)
        .reduce((sum, a) => sum + a.qty, 0)

      // 4. Aplicar estados en orden: primero Ocupado, luego Reservado
      let occupy = toOccupy
      let reserve = toReserve

      const finalUnits = resetUnits.map(unit => {
        if (unit.state !== 'Disponible') return unit // no tocar Mantenimiento/Perdido
        if (occupy > 0) { occupy--; return { ...unit, state: 'Ocupado' } }
        if (reserve > 0) { reserve--; return { ...unit, state: 'Reservado' } }
        return unit
      })

      return { ...product, units: finalUnits }
    })
  }

  /* ── countByState ── */
  const countByState = (product, state) => {
    if (state === 'Reservado') return getReservedQty(product.id)
    if (state === 'Disponible') return getAvailableQty(product.id)
    return product.units.filter(u => u.state === state).length
  }

  /* ── Crear evento ── */
  const createEvent = (formData, assignments) => {
    const newOrderNum = ++orderCounter
    const newEvent = {
      id: Date.now(),
      orderNumber: `EVT-${newOrderNum}`,
      name: formData.name,
      date: formData.date,
      location: formData.location || '',
      notes: formData.notes || '',
      status: 'Programado',
      assignments: assignments.filter(a => a.qty > 0),
      createdAt: new Date().toISOString()
    }

    setEvents(prev => {
      const newEvents = [newEvent, ...prev]
      setProducts(currentProducts => recalcProductUnits(newEvents, currentProducts))
      return newEvents
    })

    return newEvent
  }

  /* ── Actualizar evento ── */
  const updateEvent = (eventId, formData, assignments) => {
    setEvents(prev => {
      const newEvents = prev.map(e =>
        e.id === eventId
          ? { ...e, ...formData, assignments: assignments.filter(a => a.qty > 0) }
          : e
      )
      setProducts(currentProducts => recalcProductUnits(newEvents, currentProducts))
      return newEvents
    })
  }

  /* ── Eliminar (deshacer) evento ── */
  const deleteEvent = (eventId) => {
    setEvents(prev => {
      const newEvents = prev.filter(e => e.id !== eventId)
      setProducts(currentProducts => recalcProductUnits(newEvents, currentProducts))
      return newEvents
    })
  }

  /* ── Agregar producto ── */
  const addProduct = (data) => {
    const id = Date.now()
    const qty = Number(data.qty)
    setProducts(prev => [...prev, {
      id,
      name: data.name,
      sku: data.sku,
      rfidBase: data.rfid,
      category: data.category,
      total: qty,
      description: data.description || '',
      units: Array.from({ length: qty }, (_, i) => ({
        id: `${id}-${i+1}`,
        rfid: `${data.rfid}-${String(i+1).padStart(2,'0')}`,
        state: 'Disponible'
      }))
    }])
  }

  return (
    <InventoryContext.Provider value={{
      products, setProducts,
      events, setEvents,
      getReservedQty, getAvailableQty, getAvailableQtyForEvent,
      countByState,
      createEvent, updateEvent, deleteEvent,
      addProduct,
      isActiveOnDate
    }}>
      {children}
    </InventoryContext.Provider>
  )
}

export function useInventory() {
  const ctx = useContext(InventoryContext)
  if (!ctx) throw new Error('useInventory debe usarse dentro de InventoryProvider')
  return ctx
}
