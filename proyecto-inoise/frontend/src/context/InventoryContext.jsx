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

const BRIDGE_URL = 'http://localhost:3002'

export function InventoryProvider({ children }) {
  const [products, setProducts] = useState(INITIAL_PRODUCTS)
  const [epcMap, setEpcMap] = useState({}) // EPC → unitId
  const [events, setEvents] = useState([])
  const [rentals, setRentals] = useState([])

  /* ────────────────────────────────────────────────────────────────────────
   * Persistencia en disco (SQLite vía Electron) — paso 4.
   *
   * `isHydrated` arranca en false a propósito: mientras está en false, los
   * efectos de guardado (más abajo) NO escriben nada en la BD. Si no
   * hiciéramos esto, el primer render (con los estados iniciales vacíos o
   * con INITIAL_PRODUCTS de respaldo) dispararía un guardado que
   * SOBRESCRIBIRÍA lo que ya había en disco de una sesión anterior, justo
   * antes de que loadAll() alcance a traerlo. Recién cuando loadAll()
   * termina (con datos reales o confirmando que la BD está vacía) se pone
   * isHydrated en true y los guardados quedan habilitados.
   *
   * `window.api` solo existe dentro de Electron (lo expone preload.js vía
   * contextBridge). Si alguien abre el frontend suelto en un navegador
   * normal (ej. solo `npm run dev` sin Electron), `window.api` es
   * `undefined` y toda esta capa se desactiva sola sin romper nada — la
   * app sigue funcionando en memoria como antes. */
  const [isHydrated, setIsHydrated] = useState(false)

  React.useEffect(() => {
    if (!window.api) {
      // No estamos dentro de Electron (ej. navegador suelto en dev) — no
      // hay nada que cargar, seguimos con los estados iniciales en memoria.
      setIsHydrated(true)
      return
    }
    window.api.loadAll().then(res => {
      if (res?.ok && res.data) {
        const d = res.data
        // Si la BD ya tiene productos guardados, esos son la fuente de
        // verdad. Si está vacía (primera vez que corre la app con SQLite),
        // se mantiene INITIAL_PRODUCTS como semilla inicial.
        if (d.products && d.products.length > 0) setProducts(d.products)
        if (d.events) setEvents(d.events)
        if (d.rentals) setRentals(d.rentals)
        if (d.opStates) setOpStates(d.opStates)
        if (d.eventHistory) setEventHistory(d.eventHistory)
        if (d.rentalHistory) setRentalHistory(d.rentalHistory)
        if (d.purchaseHistory) setPurchaseHistory(d.purchaseHistory)
        if (d.auditLog) setAuditLog(d.auditLog)
        // epcMap: el bridge (server/rfid-bridge.js) sigue siendo la fuente
        // de verdad para resolver escaneos reales — el efecto de abajo que
        // hace fetch a BRIDGE_URL puede sobreescribir esto si el bridge
        // está disponible. Si el bridge no responde, queda lo de la BD.
        if (d.epcMap) setEpcMap(d.epcMap)
      }
    }).catch((e) => {
      console.error('[InventoryContext] Error al cargar BD:', e)
    }).finally(() => {
      setIsHydrated(true)
    })
  }, [])

  /* ── Progreso de fases por evento (Operaciones) ──
   * Antes vivía como useState local dentro de Operations.jsx, así que al
   * navegar a otra página (ej. Inventario) y volver, el componente se
   * desmontaba/remontaba y el progreso de fase volvía a cero aunque la
   * app nunca se hubiera cerrado. Al vivir acá, en el Provider de nivel
   * raíz que nunca se desmonta con la navegación, el progreso persiste
   * mientras la app esté abierta — independiente de a qué página se navegue. */
  const [opStates, setOpStates] = useState({}) // opStates: { [eventId]: opState }

  /* ────────────────────────────────────────────────────────────────────────
   * Hidratar epcMap desde el bridge al montar.
   *
   * El bridge (server/rfid-bridge.js) mantiene su PROPIO epcMap persistido
   * en disco (epcMap.json) y es la fuente de verdad real para resolver
   * escaneos de la antena — eso nunca cambió. El problema es que el estado
   * `epcMap` de este Context vivía solo en memoria (useState({})) y nunca
   * se sincronizaba con el bridge al cargar la página: cada refresh dejaba
   * el epcMap del frontend vacío, aunque el bridge seguía resolviendo los
   * escaneos correctamente con sus vínculos ya guardados. Resultado: un
   * sticker que SÍ estaba registrado en sesiones anteriores aparecía como
   * "nunca vinculado" en toda la UI (Productos Vinculados, Registrar RFID),
   * pero al pasarlo por la antena, el bridge lo resolvía bien y mostraba el
   * modal de "completado" — pareciendo un falso positivo cuando en
   * realidad el sticker sí pertenecía al evento.
   * ──────────────────────────────────────────────────────────────────────── */
  React.useEffect(() => {
    fetch(`${BRIDGE_URL}/api/epcmap`)
      .then(res => res.ok ? res.json() : {})
      .then(map => setEpcMap(map || {}))
      .catch(() => { /* bridge no disponible, se queda en {} */ })
  }, [])

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
    const product = products.find(p => p.id === productId)
    if (!product) return 0

    // IDs de unidad reales que están "en juego" en algún evento activo
    // para este producto (sin importar la fecha del evento, son las que
    // quedaron pinneadas al crear/editar el evento).
    const unitIdsInPlay = list
      .filter(e =>
        // Solo eventos activos (desde el día del evento en adelante)
        isActiveOnDate(e.date) &&
        // Solo si la fecha del evento es >= la fecha consultada
        e.date >= cutoff &&
        // No contar eventos que ya salieron (Ocupado) ni realizados
        !['Realizado', 'Concluido', 'Suspendido'].includes(e.status)
      )
      .flatMap(e => e.assignments || [])
      .filter(a => a.productId === productId)
      .flatMap(a => a.unitIds || [])

    // Solo cuentan como "reservadas" las unidades que TODAVÍA están
    // físicamente en estado 'Reservado'. Si ya pasaron a Ocupado/Rental
    // (porque el sticker fue escaneado en Operaciones), ya no se cuentan
    // aquí — evita el doble conteo que excedía el total del producto.
    return product.units.filter(u =>
      unitIdsInPlay.includes(u.id) && u.state === 'Reservado'
    ).length
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
      ['Ocupado', 'En Mantenimiento', 'Perdido', 'Rental'].includes(u.state)
    ).length

    return Math.max(product.total - reserved - blocked, 0)
  }

  /* ────────────────────────────────────────────────────────────────────────
   * getLinkedAvailableQty(productId, forDate?, excludeEventId?)
   *
   * Igual que getAvailableQty, pero solo cuenta unidades físicamente
   * 'Disponible' que además tienen un sticker RFID vinculado (epcMap).
   * Se usa al crear/editar eventos: NO se debe poder asignar una unidad
   * sin sticker, porque luego no hay forma de rastrearla por RFID en
   * Operaciones — eso permitiría crear eventos con información falsa
   * (equipos "asignados" que en realidad no existen vinculados).
   * ──────────────────────────────────────────────────────────────────────── */
  const getLinkedAvailableQty = (productId, forDate, excludeEventId) => {
    const product = products.find(p => p.id === productId)
    if (!product) return 0

    const cutoff = forDate || new Date().toISOString().slice(0, 10)
    const unitIdsInPlay = events
      .filter(e =>
        e.id !== excludeEventId &&
        isActiveOnDate(e.date) &&
        e.date >= cutoff &&
        !['Realizado', 'Concluido', 'Suspendido'].includes(e.status)
      )
      .flatMap(e => e.assignments || [])
      .filter(a => a.productId === productId)
      .flatMap(a => a.unitIds || [])

    const linkedUnitIds = new Set(Object.values(epcMap || {}))

    return product.units.filter(u =>
      u.state === 'Disponible' &&
      !unitIdsInPlay.includes(u.id) &&
      linkedUnitIds.has(u.id)
    ).length
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

    const unitIdsInPlay = (events)
      .filter(e =>
        e.id !== eventId &&
        isActiveOnDate(e.date) &&
        e.date >= cutoff &&
        !['Realizado', 'Concluido', 'Suspendido'].includes(e.status)
      )
      .flatMap(e => e.assignments || [])
      .filter(a => a.productId === productId)
      .flatMap(a => a.unitIds || [])

    // Igual que en getReservedQty: solo cuentan unidades que sigan
    // físicamente 'Reservado' (evita doble conteo si ya pasaron a Ocupado).
    const reserved = product.units.filter(u =>
      unitIdsInPlay.includes(u.id) && u.state === 'Reservado'
    ).length

    const blocked = product.units.filter(u =>
      ['Ocupado', 'En Mantenimiento', 'Perdido', 'Rental'].includes(u.state)
    ).length

    return Math.max(product.total - reserved - blocked, 0)
  }

  /* ── countByState ── */
  const countByState = (product, state) => {
    // Para el estado "actual" (hoy) basta con contar el estado físico real
    // de cada unidad — es la fuente de verdad y siempre suma == total.
    return product.units.filter(u => u.state === state).length
  }

  /* ────────────────────────────────────────────────────────────────────────
   * Asignación por ID real de unidad (en vez de cantidades sintéticas).
   *
   * Cada assignment ahora guarda `unitIds: [...]` con los IDs reales de
   * `product.units[].id` que fueron tomados al crear/editar el evento o
   * arriendo. Esto evita que un evento y un arriendo del mismo producto
   * generen el mismo ID sintético "productId-1" y se confundan entre sí
   * en Operations.jsx, y mantiene el estado físico de cada unidad 100%
   * sincronizado con la asignación que realmente la está usando.
   * ──────────────────────────────────────────────────────────────────────── */
  const pickAvailableUnitIds = (productList, productId, qty) =>
    (productList.find(p => p.id === productId)?.units || [])
      .filter(u => u.state === 'Disponible')
      .slice(0, qty)
      .map(u => u.id)

  const applyUnitStates = (productList, unitIds, newState) =>
    productList.map(product => {
      if (!product.units.some(u => unitIds.includes(u.id))) return product
      return {
        ...product,
        units: product.units.map(u => unitIds.includes(u.id) ? { ...u, state: newState } : u)
      }
    })

  /* ── Crear evento ── */
  const createEvent = (formData, assignments) => {
    const newOrderNum = ++orderCounter
    const cleanAssignments = assignments.filter(a => a.qty > 0)

    const enrichedAssignments = cleanAssignments.map(a => ({
      ...a,
      unitIds: pickAvailableUnitIds(products, a.productId, a.qty)
    }))

    const allPickedIds = enrichedAssignments.flatMap(a => a.unitIds)
    setProducts(prev => applyUnitStates(prev, allPickedIds, 'Reservado'))

    const newEvent = {
      id: Date.now(),
      orderNumber: `EVT-${newOrderNum}`,
      name: formData.name,
      date: formData.date,
      location: formData.location || '',
      notes: formData.notes || '',
      status: 'Programado',
      assignments: enrichedAssignments,
      createdAt: new Date().toISOString()
    }

    setEvents(prev => [newEvent, ...prev])
    addAuditEntry('Evento creado', `${newEvent.orderNumber} · ${newEvent.name}`, 'evento')
    return newEvent
  }

  /* ── Actualizar evento ──
   * 1. Libera (vuelve a Disponible) las unidades que el evento tenía antes.
   * 2. Vuelve a elegir, sobre el inventario ya liberado, las unidades para
   *    las nuevas cantidades y las marca según corresponda. */
  const updateEvent = (eventId, formData, assignments) => {
    const oldEvent = events.find(e => e.id === eventId)
    const oldUnitIds = (oldEvent?.assignments || []).flatMap(a => a.unitIds || [])
    const cleanAssignments = assignments.filter(a => a.qty > 0)

    const released = applyUnitStates(
      products.map(p => ({ ...p, units: p.units.map(u => ({ ...u })) })),
      oldUnitIds.filter(id => {
        const unit = products.flatMap(p => p.units).find(u => u.id === id)
        return unit && ['Reservado', 'Ocupado'].includes(unit.state)
      }),
      'Disponible'
    )

    const enrichedAssignments = cleanAssignments.map(a => ({
      ...a,
      unitIds: pickAvailableUnitIds(released, a.productId, a.qty)
    }))
    const allPickedIds = enrichedAssignments.flatMap(a => a.unitIds)
    const finalProducts = applyUnitStates(released, allPickedIds, 'Reservado')

    setProducts(finalProducts)
    setEvents(prev => prev.map(e =>
      e.id === eventId ? { ...e, ...formData, assignments: enrichedAssignments } : e
    ))
    addAuditEntry('Evento modificado', `${oldEvent?.orderNumber} · ${formData.name || oldEvent?.name}`, 'evento')
  }

  /* ── Eliminar (deshacer) evento — libera sus unidades reales ── */
  const deleteEvent = (eventId) => {
    const ev = events.find(e => e.id === eventId)
    const unitIds = (ev?.assignments || []).flatMap(a => a.unitIds || [])
    setProducts(prev => prev.map(product => ({
      ...product,
      units: product.units.map(u =>
        unitIds.includes(u.id) && ['Reservado', 'Ocupado'].includes(u.state)
          ? { ...u, state: 'Disponible' }
          : u
      )
    })))
    setEvents(prev => prev.filter(e => e.id !== eventId))
    addAuditEntry('Evento eliminado', `${ev?.orderNumber} · ${ev?.name}`, 'evento')
  }

  /* ────────────────────────────────────────────────────────────────────────
   * Flujo de aprobación de eliminación (operador solicita → admin aprueba).
   *
   * El operador NO puede borrar eventos directamente: solo puede marcarlos
   * con `pendingDelete: true` (la UI los muestra en rojo). El admin ve esa
   * marca, y desde ahí puede "Aprobar y eliminar" (ejecuta deleteEvent de
   * verdad) o "Rechazar" (quita la marca y el evento sigue como antes). El
   * admin sigue pudiendo eliminar directo sin pasar por este flujo (su
   * botón "Deshacer" de siempre no cambió).
   * ──────────────────────────────────────────────────────────────────────── */
  const requestDeleteEvent = (eventId, requestedBy) => {
    setEvents(prev => prev.map(e =>
      e.id === eventId
        ? { ...e, pendingDelete: true, pendingDeleteBy: requestedBy || 'Operador', pendingDeleteAt: new Date().toISOString() }
        : e
    ))
  }

  const cancelDeleteEvent = (eventId) => {
    setEvents(prev => prev.map(e =>
      e.id === eventId
        ? { ...e, pendingDelete: false, pendingDeleteBy: null, pendingDeleteAt: null }
        : e
    ))
  }

  /* ── Crear arriendo ── */
  const rentalCounterRef = React.useRef(200)
  const createRental = (formData, assignments) => {
    rentalCounterRef.current += 1
    const num = rentalCounterRef.current
    const cleanAssignments = assignments.filter(a => a.qty > 0)

    const enrichedAssignments = cleanAssignments.map(a => ({
      ...a,
      unitIds: pickAvailableUnitIds(products, a.productId, a.qty)
    }))
    const allPickedIds = enrichedAssignments.flatMap(a => a.unitIds)
    setProducts(prev => applyUnitStates(prev, allPickedIds, 'Rental'))

    const newRental = {
      id: Date.now(),
      orderNumber: 'RNT-' + num,
      name: formData.name,
      date: formData.date,
      endDate: formData.endDate || '',
      clientName: formData.clientName || '',
      staffName: formData.staffName || '',
      notes: formData.notes || '',
      status: 'Programado',
      assignments: enrichedAssignments,
      createdAt: new Date().toISOString()
    }
    setRentals(prev => [newRental, ...prev])
    addAuditEntry('Arriendo creado', `${newRental.orderNumber} · ${newRental.name}${newRental.clientName ? ' · ' + newRental.clientName : ''}`, 'arriendo')
    return newRental
  }

  const deleteRental = (rentalId) => {
    const rental = rentals.find(r => r.id === rentalId)
    if (!rental) return
    const unitIds = (rental.assignments || []).flatMap(a => a.unitIds || [])
    setRentals(prev => prev.filter(r => r.id !== rentalId))
    setProducts(prev => prev.map(product => ({
      ...product,
      units: product.units.map(u =>
        unitIds.includes(u.id) && u.state === 'Rental'
          ? { ...u, state: 'Disponible' }
          : u
      )
    })))
    addAuditEntry('Arriendo eliminado', `${rental?.orderNumber} · ${rental?.name}`, 'arriendo')
  }

  /* ── Agregar producto ── */
  /* ── Vincular / desvincular EPC ↔ unidad ──
   * Estas tres funciones son el ÚNICO punto de entrada para tocar epcMap.
   * Cada una actualiza el estado local DEL FRONTEND y, en paralelo, llama
   * al bridge (server/rfid-bridge.js) para que su epcMap.json persistido
   * en disco quede sincronizado — así un "Desvincular" en la UI también
   * borra el vínculo que la antena usa para resolver escaneos reales. */
  const linkEpc = (epc, unitId) => {
    setEpcMap(prev => ({ ...prev, [epc]: unitId }))
    fetch(`${BRIDGE_URL}/api/epcmap`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ epc, unitId })
    }).catch(() => { })
  }

  const unlinkEpc = (epc) => {
    setEpcMap(prev => { const n = { ...prev }; delete n[epc]; return n })
    fetch(`${BRIDGE_URL}/api/epcmap/${encodeURIComponent(epc)}`, { method: 'DELETE' }).catch(() => { })
  }

  const unlinkAllForProduct = (productId) => {
    const prod = products.find(p => p.id === productId)
    if (!prod) return
    const unitIds = new Set(prod.units.map(u => u.id))
    const epcsToUnlink = Object.keys(epcMap).filter(epc => unitIds.has(epcMap[epc]))

    setEpcMap(prev => {
      const next = { ...prev }
      epcsToUnlink.forEach(epc => delete next[epc])
      return next
    })
    epcsToUnlink.forEach(epc => {
      fetch(`${BRIDGE_URL}/api/epcmap/${encodeURIComponent(epc)}`, { method: 'DELETE' }).catch(() => { })
    })
  }

  /* ── Cambio de estado por scan RFID real ── */
  const markUnitOccupied = (unitId) => {
    setProducts(prev => prev.map(product => ({
      ...product,
      units: product.units.map(u =>
        u.id === unitId && u.state === 'Reservado'
          ? { ...u, state: 'Ocupado' }
          : u
      )
    })))
  }

  const markUnitAvailable = (unitId) => {
    setProducts(prev => prev.map(product => ({
      ...product,
      units: product.units.map(u =>
        u.id === unitId && u.state === 'Ocupado'
          ? { ...u, state: 'Disponible' }
          : u
      )
    })))
  }

  /* ── Cambio de estado por scan RFID real — Rental ──
   * F4 "Entrada a bodega" de un arriendo: la unidad vuelve de Rental a Disponible.
   * (El paso Disponible → Rental ya ocurre en createRental al crear el arriendo) */
  const markUnitBackFromRental = (unitId) => {
    setProducts(prev => prev.map(product => ({
      ...product,
      units: product.units.map(u =>
        u.id === unitId && u.state === 'Rental'
          ? { ...u, state: 'Disponible' }
          : u
      )
    })))
  }

  /* ────────────────────────────────────────────────────────────────────────
   * Historial — 3 registros separados (eventos / rentas / compras).
   *
   * Antes, la sección de Historial llamaba a un endpoint (api.getHistory())
   * que nunca devolvía nada real. Ahora el historial vive acá, junto al
   * resto del estado de la app, y se llena con 3 acciones reales:
   *  - closeEventToHistory  → al cerrar un evento (botón "Guardar y cerrar"
   *    tras completar F4 en Operaciones). El evento se sacó de `events`,
   *    así que desaparece de Operaciones — pero queda guardado aquí.
   *  - closeRentalToHistory → mismo concepto para arriendos (tras F4).
   *  - addProduct           → cada vez que se agrega stock nuevo, queda un
   *    registro de "compra/ingreso" — no hay otro punto de entrada de
   *    stock nuevo en el sistema, así que esto cubre el caso completo.
   * ──────────────────────────────────────────────────────────────────────── */
  const [eventHistory, setEventHistory] = useState([])
  const [rentalHistory, setRentalHistory] = useState([])
  const [purchaseHistory, setPurchaseHistory] = useState([])
  const [auditLog, setAuditLog] = useState([])

  /* ── Registrar entrada de auditoría ───────────────────────────────────
   * Cada acción relevante del sistema (crear/cerrar/eliminar evento,
   * arriendo o producto) agrega una entrada con: timestamp, usuario que
   * la realizó, descripción de la acción, detalle (N° orden + nombre) y
   * categoría (evento | arriendo | producto | sistema). */
  const addAuditEntry = React.useCallback((action, detail, category, user = 'Sistema') => {
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      user,
      action,
      detail: detail || '',
      category: category || 'sistema'
    }
    setAuditLog(prev => [entry, ...prev])
  }, [])

  // Etiquetas de fase para el Reporte de Operaciones (PHASES vive en
  // Operations.jsx; acá solo se necesita el texto para guardarlo en el
  // historial, así el reporte mensual no depende de que Operations.jsx
  // esté montado).
  const PHASE_LABELS = { f1: 'Despacho bodega', f2: 'Recepción evento', f3: 'Despacho evento', f4: 'Recepción bodega' }

  /* ── Cerrar evento → mover de Operaciones al Historial de Eventos ──
   * Se guarda el detalle completo (artículos, fases aprobadas e
   * incidencias/pérdidas con su fase y ubicación) para el Reporte de
   * Operaciones mensual. Antes solo se guardaba el conteo agregado de
   * incidencias, lo que hacía imposible saber QUÉ artículo se perdió,
   * en QUÉ fase y en QUÉ evento. */
  const closeEventToHistory = (event, opState, closedBy) => {
    if (!event) return
    const phases = opState?.phases || {}
    // lostItems vive a nivel de EVENTO (no por fase) — un artículo perdido
    // se registra una sola vez y queda excluido de "pendiente" en todas las
    // fases siguientes (ver Operations.jsx). Por eso el conteo/detalle de
    // pérdidas se lee de opState.lostItems, no de phases[key].incidents.
    const lostItems = opState?.lostItems || []
    const incidentsCount = lostItems.length

    const items = (event.assignments || []).map(a => {
      const prod = products.find(p => p.id === a.productId)
      return {
        productId: a.productId,
        name: prod?.name || 'Producto eliminado',
        sku: prod?.sku || '—',
        qty: a.qty
      }
    })

    const phasesApproved = Object.entries(phases).map(([key, p]) => ({
      key,
      label: PHASE_LABELS[key] || key,
      done: !!p.done,
      forced: !!p.forcedClose
    }))

    const lossDetails = lostItems.map(inc => ({
      item: inc.name || '—',
      sku: inc.sku || '—',
      // Se guarda la clave (F1/F2/F3/F4) Y la etiqueta completa por separado,
      // así el PDF y la vista pueden mostrar ambas sin ambigüedad (antes solo
      // se guardaba el label, y "Despacho" por sí solo no distingue F1
      // "Despacho bodega" de F3 "Despacho evento").
      phaseKey: inc.phaseKey || null,
      phase: `${(inc.phaseKey || '').toUpperCase()} · ${PHASE_LABELS[inc.phaseKey] || inc.phaseKey || '—'}`,
      state: inc.state || 'Perdido',
      reason: inc.reason || '',
      location: event.location || ''
    }))

    const entry = {
      id: Date.now(),
      orderNumber: event.orderNumber,
      name: event.name,
      date: event.date,
      location: event.location || '',
      totalItems: opState?.totalItems || (event.assignments || []).reduce((s, a) => s + a.qty, 0),
      incidentsCount,
      forcedClose: !!opState?.forcedBy,
      closedAt: new Date().toISOString(),
      closedBy: closedBy || 'Administrador',
      items,
      phasesApproved,
      lossDetails
    }
    setEventHistory(prev => [entry, ...prev])
    addAuditEntry('Evento cerrado (Operaciones)', `${event.orderNumber} · ${event.name}`, 'evento', closedBy)
    // Ya NO se elimina de `events`: antes desaparecía por completo, lo que
    // hacía que tampoco se pudiera ver en la página de Eventos (la lista
    // activa y el Historial comparten el mismo evento de origen). Ahora se
    // marca como "Concluido" y se mantiene en `events`, así sigue visible
    // en Eventos (con su estado) y en el filtro "Realizados" de Operaciones,
    // a la vez que su detalle completo queda en el Historial de Eventos.
    setEvents(prev => prev.map(e => e.id === event.id ? { ...e, status: 'Concluido' } : e))
  }

  /* ── Cerrar arriendo → mover de Operaciones al Historial de Rentas ── */
  const closeRentalToHistory = (rental, totalItems, closedBy) => {
    if (!rental) return
    const items = (rental.assignments || []).map(a => {
      const prod = products.find(p => p.id === a.productId)
      return {
        productId: a.productId,
        name: prod?.name || 'Producto eliminado',
        sku: prod?.sku || '—',
        qty: a.qty
      }
    })
    const entry = {
      id: Date.now(),
      orderNumber: rental.orderNumber,
      name: rental.name,
      clientName: rental.clientName || '',
      date: rental.date,
      endDate: rental.endDate || '',
      location: rental.location || '',
      totalItems: totalItems ?? (rental.assignments || []).reduce((s, a) => s + a.qty, 0),
      closedAt: new Date().toISOString(),
      closedBy: closedBy || 'Administrador',
      items
    }
    setRentalHistory(prev => [entry, ...prev])
    setRentals(prev => prev.filter(r => r.id !== rental.id))
    addAuditEntry('Arriendo cerrado (Operaciones)', `${rental.orderNumber} · ${rental.name}${rental.clientName ? ' · ' + rental.clientName : ''}`, 'arriendo', closedBy)
  }

  // Dado el prefijo de familia SKU (ej. "AUD"), busca el correlativo más
  // alto ya usado en esa familia entre los productos existentes y devuelve
  // el siguiente, con formato "FAMILIA-NNN" (ej. "AUD-008"). Si la familia
  // es nueva, arranca en 001. Esto evita que dos personas terminen
  // ingresando el mismo SKU a mano o se salten/repitan números.
  const nextSkuForFamily = (familyRaw) => {
    const family = (familyRaw || '').trim().toUpperCase()
    if (!family) return ''
    const re = new RegExp(`^${family}-(\\d+)$`, 'i')
    const nums = products
      .map(p => p.sku)
      .filter(Boolean)
      .map(s => {
        const m = s.match(re)
        return m ? parseInt(m[1], 10) : null
      })
      .filter(n => n !== null)
    const next = nums.length ? Math.max(...nums) + 1 : 1
    return `${family}-${String(next).padStart(3, '0')}`
  }

  // Elimina un producto completo del inventario (todas sus unidades). Por
  // ahora es una baja directa; el flujo de aprobación admin/operador para
  // esta acción se agrega en una etapa siguiente.
  const deleteProduct = (productId) => {
    // Antes esto borraba el producto sin soltar sus stickers RFID: el
    // epcMap (que vive en el bridge, separado de la lista de productos)
    // se quedaba con EPC → unitId apuntando a un producto que ya no
    // existe. Esos stickers quedaban "fantasma": al volver a escanearlos
    // RfidRegistrar los marcaba como "ya vinculados" a "Producto
    // desconocido" y no había forma de liberarlos desde la UI, porque
    // Productos Vinculados solo lista productos reales. Por eso ahora
    // se desvinculan sus EPCs ANTES de quitar el producto de la lista.
    const prod = products.find(p => p.id === productId)
    unlinkAllForProduct(productId)
    setProducts(prev => prev.filter(p => p.id !== productId))
    addAuditEntry('Producto eliminado', `${prod?.name || '—'} (${prod?.sku || '—'})`, 'producto')
  }

  /* Mismo flujo de aprobación que los eventos, pero para productos del
   * inventario: el operador solo marca `pendingDelete`, el admin aprueba
   * (deleteProduct real) o rechaza (vuelve a quedar normal). */
  const requestDeleteProduct = (productId, requestedBy) => {
    setProducts(prev => prev.map(p =>
      p.id === productId
        ? { ...p, pendingDelete: true, pendingDeleteBy: requestedBy || 'Operador', pendingDeleteAt: new Date().toISOString() }
        : p
    ))
  }

  const cancelDeleteProduct = (productId) => {
    setProducts(prev => prev.map(p =>
      p.id === productId
        ? { ...p, pendingDelete: false, pendingDeleteBy: null, pendingDeleteAt: null }
        : p
    ))
  }

  const addProduct = (data, user) => {
    const id = Date.now()
    const qty = Number(data.qty)
    const newProduct = {
      id,
      name: data.name,
      sku: data.sku,
      rfidBase: data.rfid,
      category: data.category,
      total: qty,
      description: data.description || '',
      units: Array.from({ length: qty }, (_, i) => ({
        id: `${id}-${i + 1}`,
        rfid: `${data.rfid}-${String(i + 1).padStart(2, '0')}`,
        state: 'Disponible'
      }))
    }
    setProducts(prev => [...prev, newProduct])
    addAuditEntry('Producto ingresado', `${data.name} (${data.sku}) · ${qty} unidades`, 'producto', user)
    setPurchaseHistory(prev => [{
      id: id + 1,
      date: new Date().toISOString(),
      productName: data.name,
      sku: data.sku,
      category: data.category,
      qty,
      user: user || 'Administrador'
    }, ...prev])
    return newProduct
  }

  /* ────────────────────────────────────────────────────────────────────────
   * Guardado automático en SQLite — un efecto por entidad, cada uno se
   * dispara solo cuando ESA entidad cambia (no en cada render del Provider
   * completo). Todos están guardados por `isHydrated` para no pisar la BD
   * con datos vacíos antes de que termine la carga inicial (ver el efecto
   * de loadAll más arriba). Si `window.api` no existe (fuera de Electron),
   * cada llamada es un no-op seguro. */
  React.useEffect(() => {
    if (!isHydrated || !window.api) return
    window.api.saveProducts(products).catch(() => { })
  }, [products, isHydrated])

  React.useEffect(() => {
    if (!isHydrated || !window.api) return
    window.api.saveEvents(events).catch(() => { })
  }, [events, isHydrated])

  React.useEffect(() => {
    if (!isHydrated || !window.api) return
    window.api.saveRentals(rentals).catch(() => { })
  }, [rentals, isHydrated])

  React.useEffect(() => {
    if (!isHydrated || !window.api) return
    window.api.saveOpStates(opStates).catch(() => { })
  }, [opStates, isHydrated])

  React.useEffect(() => {
    if (!isHydrated || !window.api) return
    window.api.saveEpcMap(epcMap).catch(() => { })
  }, [epcMap, isHydrated])

  React.useEffect(() => {
    if (!isHydrated || !window.api) return
    window.api.saveEventHistory(eventHistory).catch(() => { })
  }, [eventHistory, isHydrated])

  React.useEffect(() => {
    if (!isHydrated || !window.api) return
    window.api.saveRentalHistory(rentalHistory).catch(() => { })
  }, [rentalHistory, isHydrated])

  React.useEffect(() => {
    if (!isHydrated || !window.api) return
    window.api.savePurchaseHistory(purchaseHistory).catch(() => { })
  }, [purchaseHistory, isHydrated])

  React.useEffect(() => {
    if (!isHydrated || !window.api) return
    window.api.saveAuditLog(auditLog).catch(() => { })
  }, [auditLog, isHydrated])

  return (
    <InventoryContext.Provider value={{
      products, setProducts,
      events, setEvents,
      getReservedQty, getAvailableQty, getAvailableQtyForEvent, getLinkedAvailableQty,
      countByState,
      createEvent, updateEvent, deleteEvent,
      requestDeleteEvent, cancelDeleteEvent,
      rentals, setRentals, createRental, deleteRental,
      addProduct, deleteProduct, requestDeleteProduct, cancelDeleteProduct, nextSkuForFamily,
      opStates, setOpStates,
      epcMap, linkEpc, unlinkEpc, unlinkAllForProduct,
      markUnitOccupied, markUnitAvailable, markUnitBackFromRental,
      isActiveOnDate,
      eventHistory, rentalHistory, purchaseHistory,
      closeEventToHistory, closeRentalToHistory,
      auditLog, addAuditEntry
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
