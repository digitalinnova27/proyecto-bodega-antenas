// cloud-backend/src/db.js
//
// Capa de datos — equivalente en Postgres/Prisma de electron/db.js.
// Mismo contrato de funciones (loadAll, save*/load*, usuarios, sesiones,
// chat, personal, settings, recuperación de contraseña, OTP de admin) para
// que el servidor Express de arriba sea un espejo casi directo de
// electron/server/index.js.
//
// Diferencias deliberadas respecto al original (ver plan de migración):
//  - Hash de contraseña: bcrypt en vez de PBKDF2 (más estándar, sin que el
//    comentario original dijera "scrypt" y el código hiciera otra cosa).
//  - _mapUser SIGUE sin incluir passwordHash — mismo fix que ya se aplicó
//    en electron/db.js, acá nace así desde el principio.
//  - Los ids de products/events/rentals/*_history son BigInt en Postgres
//    (vienen de Date.now() en el frontend, exceden un INT de 32 bits) pero
//    se devuelven como Number en el JSON de salida — caben sin perder
//    precisión porque Date.now() nunca se acerca a 2^53.
//  - "Borrar todo y reinsertar" se mantiene (mismo contrato que ya conoce
//    el frontend), pero usando las foreign keys DEFERRABLE que se
//    configuraron con prisma/make-fks-deferrable.sql — ver ese archivo
//    para el porqué.

const { PrismaClient } = require('@prisma/client')
const crypto = require('crypto')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

const PHASE_KEYS = ['f1', 'f2', 'f3', 'f4']

/* ── Helpers de conversión BigInt ↔ Number ──────────────────────────────── */
const toNum = (v) => (v === null || v === undefined ? v : Number(v))
const toBig = (v) => BigInt(Math.trunc(Number(v)))
const parseJson = (s, fallback) => {
  try { return s ? JSON.parse(s) : fallback } catch { return fallback }
}

/* ════════════════════════════════════════════════════════════════════════
 * Productos + unidades
 * ════════════════════════════════════════════════════════════════════════ */

async function saveProducts(products) {
  await prisma.$transaction(async (tx) => {
    await tx.unit.deleteMany()
    await tx.product.deleteMany()
    await tx.product.createMany({
      data: (products || []).map(p => ({
        id: toBig(p.id), name: p.name, sku: p.sku ?? null, rfidBase: p.rfidBase ?? null,
        category: p.category ?? null, total: p.total ?? 0, description: p.description ?? null,
        pendingDelete: !!p.pendingDelete, pendingDeleteBy: p.pendingDeleteBy ?? null, pendingDeleteAt: p.pendingDeleteAt ?? null
      }))
    })
    const allUnits = (products || []).flatMap(p => (p.units || []).map(u => ({
      id: u.id, productId: toBig(p.id), rfid: u.rfid ?? null, state: u.state || 'Disponible'
    })))
    if (allUnits.length) await tx.unit.createMany({ data: allUnits })
  })
}

async function loadProducts() {
  const products = await prisma.product.findMany({ include: { units: true } })
  return products.map(p => ({
    id: toNum(p.id), name: p.name, sku: p.sku, rfidBase: p.rfidBase, category: p.category,
    total: p.total, description: p.description,
    pendingDelete: p.pendingDelete, pendingDeleteBy: p.pendingDeleteBy, pendingDeleteAt: p.pendingDeleteAt,
    units: p.units.map(u => ({ id: u.id, rfid: u.rfid, state: u.state }))
  }))
}

/* ════════════════════════════════════════════════════════════════════════
 * RF-011 — doble reserva por condición de carrera
 *
 * Dos PCs asignando equipos casi al mismo tiempo pueden terminar
 * reclamando la misma unidad física para dos eventos/arriendos distintos
 * — cada guardado "reemplaza todo" (ver cabecera del archivo), así que sin
 * esta validación gana el último PUT en silencio, sin aviso para nadie.
 *
 * Se usa el ESTADO REAL de la unidad (tabla units, no el texto de status
 * del evento — ese tiene variantes como "Suspendido" cuyo efecto sobre la
 * disponibilidad no está definido con certeza) como la señal de verdad de
 * si está libre u ocupada ahora mismo. Una unidad con estado Reservado/
 * Ocupado/Rental solo puede seguir reclamándola el MISMO evento/arriendo
 * que ya la tenía en la base — cualquier otro reclamo se rechaza.
 * ════════════════════════════════════════════════════════════════════════ */

function _assignedUnitHolders(list) {
  const holder = new Map() // unitId -> id del evento/arriendo que lo tiene
  for (const item of list || []) {
    for (const a of item.assignments || []) {
      for (const unitId of a.unitIds || []) holder.set(unitId, item.id)
    }
  }
  return holder
}

const _BUSY_UNIT_STATES = new Set(['Reservado', 'Ocupado', 'Rental'])

/** Devuelve un mensaje de error si `incomingList` reclama una unidad que ya
 *  está ocupada por otro evento/arriendo (en la misma colección o en la
 *  otra), o null si no hay conflicto. */
async function findDoubleBookingConflict(incomingList, existingSameList, existingOtherList) {
  const claimedBy = _assignedUnitHolders(incomingList)
  if (!claimedBy.size) return null

  // Conflicto DENTRO del propio payload entrante (dos ítems nuevos pisándose)
  const seen = new Map()
  for (const item of incomingList || []) {
    for (const a of item.assignments || []) {
      for (const unitId of a.unitIds || []) {
        const prev = seen.get(unitId)
        if (prev !== undefined && String(prev) !== String(item.id)) {
          return `La unidad ${unitId} quedaría asignada dos veces en este mismo guardado.`
        }
        seen.set(unitId, item.id)
      }
    }
  }

  const sameHolder = _assignedUnitHolders(existingSameList)
  const otherHolder = _assignedUnitHolders(existingOtherList)

  const units = await prisma.unit.findMany({
    where: { id: { in: [...claimedBy.keys()] } },
    select: { id: true, state: true }
  })
  for (const u of units) {
    if (!_BUSY_UNIT_STATES.has(u.state)) continue
    if (otherHolder.has(u.id)) {
      return `La unidad ${u.id} ya está asignada a otra operación activa (cruzada entre eventos y arriendos) — recargá la pantalla e intentá de nuevo.`
    }
    const currentHolder = sameHolder.get(u.id)
    const claimant = claimedBy.get(u.id)
    if (currentHolder !== undefined && String(currentHolder) !== String(claimant)) {
      return `La unidad ${u.id} ya fue asignada por otra persona mientras tanto — recargá la pantalla e intentá de nuevo.`
    }
  }
  return null
}

/* ════════════════════════════════════════════════════════════════════════
 * Eventos + asignaciones
 * ════════════════════════════════════════════════════════════════════════ */

async function saveEvents(events) {
  await prisma.$transaction(async (tx) => {
    await tx.eventAssignmentUnit.deleteMany()
    await tx.eventAssignment.deleteMany()
    await tx.event.deleteMany()
    await tx.event.createMany({
      data: (events || []).map(e => ({
        id: toBig(e.id), orderNumber: e.orderNumber ?? null, name: e.name, date: e.date ?? null,
        location: e.location ?? null, notes: e.notes ?? null, status: e.status || 'Programado',
        createdAt: e.createdAt ?? null,
        pendingDelete: !!e.pendingDelete, pendingDeleteBy: e.pendingDeleteBy ?? null, pendingDeleteAt: e.pendingDeleteAt ?? null,
        pendingDeleteReason: e.pendingDeleteReason ?? null,
        cancelReason: e.cancelReason ?? null, cancelledBy: e.cancelledBy ?? null, cancelledAt: e.cancelledAt ?? null,
        staffIds: e.staffIds?.length ? JSON.stringify(e.staffIds) : null
      }))
    })
    for (const e of events || []) {
      for (const a of e.assignments || []) {
        const created = await tx.eventAssignment.create({
          data: { eventId: toBig(e.id), productId: toBig(a.productId), qty: a.qty || 0 }
        })
        if (a.unitIds?.length) {
          await tx.eventAssignmentUnit.createMany({
            data: a.unitIds.map(unitId => ({ assignmentId: created.id, unitId }))
          })
        }
      }
    }
  })
}

async function loadEvents() {
  const events = await prisma.event.findMany({
    include: { assignments: { include: { units: true } } }
  })
  return events.map(e => ({
    id: toNum(e.id), orderNumber: e.orderNumber, name: e.name, date: e.date, location: e.location,
    notes: e.notes, status: e.status, createdAt: e.createdAt,
    pendingDelete: e.pendingDelete, pendingDeleteBy: e.pendingDeleteBy, pendingDeleteAt: e.pendingDeleteAt,
    pendingDeleteReason: e.pendingDeleteReason,
    cancelReason: e.cancelReason, cancelledBy: e.cancelledBy, cancelledAt: e.cancelledAt,
    staffIds: e.staffIds ? JSON.parse(e.staffIds) : [],
    assignments: e.assignments.map(a => ({
      productId: toNum(a.productId), qty: a.qty, unitIds: a.units.map(u => u.unitId)
    }))
  }))
}

/* ════════════════════════════════════════════════════════════════════════
 * Arriendos + asignaciones
 * ════════════════════════════════════════════════════════════════════════ */

async function saveRentals(rentals) {
  await prisma.$transaction(async (tx) => {
    await tx.rentalAssignmentUnit.deleteMany()
    await tx.rentalAssignment.deleteMany()
    await tx.rental.deleteMany()
    await tx.rental.createMany({
      data: (rentals || []).map(r => ({
        id: toBig(r.id), orderNumber: r.orderNumber ?? null, name: r.name, date: r.date ?? null,
        endDate: r.endDate ?? null, clientName: r.clientName ?? null, staffName: r.staffName ?? null,
        notes: r.notes ?? null, status: r.status || 'Programado', createdAt: r.createdAt ?? null,
        pendingDelete: !!r.pendingDelete, pendingDeleteBy: r.pendingDeleteBy ?? null, pendingDeleteAt: r.pendingDeleteAt ?? null,
        pendingDeleteReason: r.pendingDeleteReason ?? null,
        cancelReason: r.cancelReason ?? null, cancelledBy: r.cancelledBy ?? null, cancelledAt: r.cancelledAt ?? null,
        staffIds: r.staffIds?.length ? JSON.stringify(r.staffIds) : null
      }))
    })
    for (const r of rentals || []) {
      for (const a of r.assignments || []) {
        const created = await tx.rentalAssignment.create({
          data: { rentalId: toBig(r.id), productId: toBig(a.productId), qty: a.qty || 0 }
        })
        if (a.unitIds?.length) {
          await tx.rentalAssignmentUnit.createMany({
            data: a.unitIds.map(unitId => ({ assignmentId: created.id, unitId }))
          })
        }
      }
    }
  })
}

async function loadRentals() {
  const rentals = await prisma.rental.findMany({
    include: { assignments: { include: { units: true } } }
  })
  return rentals.map(r => ({
    id: toNum(r.id), orderNumber: r.orderNumber, name: r.name, date: r.date, endDate: r.endDate,
    clientName: r.clientName, staffName: r.staffName, notes: r.notes, status: r.status, createdAt: r.createdAt,
    pendingDelete: r.pendingDelete, pendingDeleteBy: r.pendingDeleteBy, pendingDeleteAt: r.pendingDeleteAt,
    pendingDeleteReason: r.pendingDeleteReason,
    cancelReason: r.cancelReason, cancelledBy: r.cancelledBy, cancelledAt: r.cancelledAt,
    staffIds: r.staffIds ? JSON.parse(r.staffIds) : [],
    assignments: r.assignments.map(a => ({
      productId: toNum(a.productId), qty: a.qty, unitIds: a.units.map(u => u.unitId)
    }))
  }))
}

/* ════════════════════════════════════════════════════════════════════════
 * Progreso de fases en Operaciones (opStates) — eventos y arriendos
 * mezclados en un solo mapa { [id]: op } del lado de React, repartidos acá
 * según a qué tabla pertenezca ese id. Mismo mecanismo que electron/db.js.
 * ════════════════════════════════════════════════════════════════════════ */

async function saveOpStates(opStates) {
  const entries = Object.entries(opStates || {}).filter(([, op]) => !!op)
  if (!entries.length) {
    await prisma.$transaction([
      prisma.opStateIncident.deleteMany(), prisma.opStateScannedUnit.deleteMany(),
      prisma.opStatePhase.deleteMany(), prisma.opState.deleteMany(),
      prisma.rentalOpStateIncident.deleteMany(), prisma.rentalOpStateScannedUnit.deleteMany(),
      prisma.rentalOpStatePhase.deleteMany(), prisma.rentalOpState.deleteMany()
    ])
    return
  }

  const ids = entries.map(([id]) => toBig(id))
  const [eventRows, rentalRows] = await Promise.all([
    prisma.event.findMany({ where: { id: { in: ids } }, select: { id: true } }),
    prisma.rental.findMany({ where: { id: { in: ids } }, select: { id: true } })
  ])
  const eventIds = new Set(eventRows.map(e => e.id.toString()))
  const rentalIds = new Set(rentalRows.map(r => r.id.toString()))

  const eventEntries = entries.filter(([id]) => eventIds.has(toBig(id).toString()))
  const rentalEntries = entries.filter(([id]) => rentalIds.has(toBig(id).toString()))
  // Entradas que no corresponden a ningún evento/arriendo vivo (ej. se
  // borró mientras tanto) se descartan en silencio, igual que en el original.

  await prisma.$transaction(async (tx) => {
    await tx.opStateIncident.deleteMany()
    await tx.opStateScannedUnit.deleteMany()
    await tx.opStatePhase.deleteMany()
    await tx.opState.deleteMany()
    for (const [idStr, op] of eventEntries) {
      const id = toBig(idStr)
      await tx.opState.create({
        data: {
          eventId: id, totalItems: op.totalItems || 0, activePhase: op.activePhase ?? null,
          scanMode: op.scanMode ?? null,
          forcedByJson: op.forcedBy ? JSON.stringify(op.forcedBy) : null,
          forceLogJson: op.forceLog ? JSON.stringify(op.forceLog) : null
        }
      })
      for (const phaseKey of PHASE_KEYS) {
        const phase = (op.phases || {})[phaseKey]
        if (!phase) continue
        await tx.opStatePhase.create({ data: { eventId: id, phaseKey, done: !!phase.done, forcedClose: !!phase.forcedClose } })
        if (phase.scanned?.length) {
          await tx.opStateScannedUnit.createMany({
            data: phase.scanned.map(s => ({ eventId: id, phaseKey, unitId: s.id, scannedAt: s.scannedAt ?? null }))
          })
        }
        if (phase.incidents?.length) {
          await tx.opStateIncident.createMany({
            data: phase.incidents.map(inc => ({
              eventId: id, phaseKey, unitId: inc.id ?? null, name: inc.name ?? null, rfid: inc.rfid ?? null,
              state: inc.state ?? null, reason: inc.reason ?? null, reportedAt: inc.reportedAt ?? null
            }))
          })
        }
      }
    }
  })

  await prisma.$transaction(async (tx) => {
    await tx.rentalOpStateIncident.deleteMany()
    await tx.rentalOpStateScannedUnit.deleteMany()
    await tx.rentalOpStatePhase.deleteMany()
    await tx.rentalOpState.deleteMany()
    for (const [idStr, op] of rentalEntries) {
      const id = toBig(idStr)
      await tx.rentalOpState.create({
        data: {
          rentalId: id, totalItems: op.totalItems || 0, activePhase: op.activePhase ?? null,
          scanMode: op.scanMode ?? null,
          forcedByJson: op.forcedBy ? JSON.stringify(op.forcedBy) : null,
          forceLogJson: op.forceLog ? JSON.stringify(op.forceLog) : null
        }
      })
      for (const phaseKey of PHASE_KEYS) {
        const phase = (op.phases || {})[phaseKey]
        if (!phase) continue
        await tx.rentalOpStatePhase.create({ data: { rentalId: id, phaseKey, done: !!phase.done, forcedClose: !!phase.forcedClose } })
        if (phase.scanned?.length) {
          await tx.rentalOpStateScannedUnit.createMany({
            data: phase.scanned.map(s => ({ rentalId: id, phaseKey, unitId: s.id, scannedAt: s.scannedAt ?? null }))
          })
        }
        if (phase.incidents?.length) {
          await tx.rentalOpStateIncident.createMany({
            data: phase.incidents.map(inc => ({
              rentalId: id, phaseKey, unitId: inc.id ?? null, name: inc.name ?? null, rfid: inc.rfid ?? null,
              state: inc.state ?? null, reason: inc.reason ?? null, reportedAt: inc.reportedAt ?? null
            }))
          })
        }
      }
    }
  })
}

async function _unitInfoMap() {
  const [units, products] = await Promise.all([
    prisma.unit.findMany(), prisma.product.findMany({ select: { id: true, name: true, sku: true } })
  ])
  const prodById = new Map(products.map(p => [p.id.toString(), p]))
  return (unitId) => {
    const u = units.find(x => x.id === unitId)
    if (!u) return { rfid: null, name: null, sku: null, productId: null }
    const p = prodById.get(u.productId.toString())
    return { rfid: u.rfid, name: p?.name ?? null, sku: p?.sku ?? null, productId: toNum(u.productId) }
  }
}

async function loadOpStates() {
  const unitInfo = await _unitInfoMap()

  const [states, phases, scanned, incidents] = await Promise.all([
    prisma.opState.findMany(), prisma.opStatePhase.findMany(),
    prisma.opStateScannedUnit.findMany(), prisma.opStateIncident.findMany()
  ])
  const [rStates, rPhases, rScanned, rIncidents] = await Promise.all([
    prisma.rentalOpState.findMany(), prisma.rentalOpStatePhase.findMany(),
    prisma.rentalOpStateScannedUnit.findMany(), prisma.rentalOpStateIncident.findMany()
  ])

  const build = (states, phases, scanned, incidents, idField) => {
    const result = {}
    for (const st of states) {
      const id = st[idField]
      const idKey = toNum(id)
      const entityPhases = phases.filter(p => p[idField] === id)
      const phasesObj = {}
      for (const phaseKey of PHASE_KEYS) {
        const ph = entityPhases.find(p => p.phaseKey === phaseKey)
        phasesObj[phaseKey] = {
          done: !!ph?.done, forcedClose: !!ph?.forcedClose,
          scanned: scanned.filter(s => s[idField] === id && s.phaseKey === phaseKey)
            .map(s => ({ id: s.unitId, scannedAt: s.scannedAt, ...unitInfo(s.unitId) })),
          incidents: incidents.filter(i => i[idField] === id && i.phaseKey === phaseKey)
            .map(i => ({
              id: i.unitId, name: i.name, rfid: i.rfid, state: i.state, reason: i.reason, reportedAt: i.reportedAt,
              productId: unitInfo(i.unitId).productId, sku: unitInfo(i.unitId).sku
            }))
        }
      }
      result[idKey] = {
        totalItems: st.totalItems, activePhase: st.activePhase, scanMode: st.scanMode,
        forcedBy: st.forcedByJson ? JSON.parse(st.forcedByJson) : null,
        forceLog: st.forceLogJson ? JSON.parse(st.forceLogJson) : [],
        phases: phasesObj
      }
    }
    return result
  }

  return {
    ...build(states, phases, scanned, incidents, 'eventId'),
    ...build(rStates, rPhases, rScanned, rIncidents, 'rentalId')
  }
}

/* ════════════════════════════════════════════════════════════════════════
 * Vínculos RFID ↔ unidad (epcMap)
 * ════════════════════════════════════════════════════════════════════════ */

async function saveEpcMap(epcMap) {
  await prisma.$transaction(async (tx) => {
    await tx.epcMap.deleteMany()
    const data = Object.entries(epcMap || {}).map(([epc, unitId]) => ({ epc, unitId }))
    if (data.length) await tx.epcMap.createMany({ data })
  })
}

async function loadEpcMap() {
  const rows = await prisma.epcMap.findMany()
  const map = {}
  for (const r of rows) map[r.epc] = r.unitId
  return map
}

/* ════════════════════════════════════════════════════════════════════════
 * Historiales (eventos / rentas / compras / auditoría)
 * ════════════════════════════════════════════════════════════════════════ */

async function saveEventHistory(list) {
  await prisma.$transaction(async (tx) => {
    await tx.eventHistory.deleteMany()
    const data = (list || []).map(e => ({
      id: toBig(e.id), orderNumber: e.orderNumber ?? null, name: e.name ?? null, date: e.date ?? null,
      location: e.location ?? null, totalItems: e.totalItems ?? 0, incidentsCount: e.incidentsCount ?? 0,
      forcedClose: !!e.forcedClose, closedAt: e.closedAt ?? null, closedBy: e.closedBy ?? null,
      itemsJson: JSON.stringify(e.items ?? []), phasesApprovedJson: JSON.stringify(e.phasesApproved ?? []),
      lossDetailsJson: JSON.stringify(e.lossDetails ?? [])
    }))
    if (data.length) await tx.eventHistory.createMany({ data })
  })
}

async function loadEventHistory() {
  const rows = await prisma.eventHistory.findMany({ orderBy: { closedAt: 'desc' } })
  return rows.map(e => ({
    id: toNum(e.id), orderNumber: e.orderNumber, name: e.name, date: e.date, location: e.location,
    totalItems: e.totalItems, incidentsCount: e.incidentsCount, forcedClose: e.forcedClose,
    closedAt: e.closedAt, closedBy: e.closedBy,
    items: parseJson(e.itemsJson, []), phasesApproved: parseJson(e.phasesApprovedJson, []), lossDetails: parseJson(e.lossDetailsJson, [])
  }))
}

async function saveRentalHistory(list) {
  await prisma.$transaction(async (tx) => {
    await tx.rentalHistory.deleteMany()
    const data = (list || []).map(r => ({
      id: toBig(r.id), orderNumber: r.orderNumber ?? null, name: r.name ?? null, clientName: r.clientName ?? null,
      date: r.date ?? null, endDate: r.endDate ?? null, totalItems: r.totalItems ?? 0,
      closedAt: r.closedAt ?? null, closedBy: r.closedBy ?? null
    }))
    if (data.length) await tx.rentalHistory.createMany({ data })
  })
}

async function loadRentalHistory() {
  const rows = await prisma.rentalHistory.findMany({ orderBy: { closedAt: 'desc' } })
  return rows.map(r => ({
    id: toNum(r.id), orderNumber: r.orderNumber, name: r.name, clientName: r.clientName,
    date: r.date, endDate: r.endDate, totalItems: r.totalItems, closedAt: r.closedAt, closedBy: r.closedBy
  }))
}

async function savePurchaseHistory(list) {
  await prisma.$transaction(async (tx) => {
    await tx.purchaseHistory.deleteMany()
    const data = (list || []).map(p => ({
      id: toBig(p.id), date: p.date ?? null, productName: p.productName ?? null, sku: p.sku ?? null,
      category: p.category ?? null, qty: p.qty ?? 0, user: p.user ?? null
    }))
    if (data.length) await tx.purchaseHistory.createMany({ data })
  })
}

async function loadPurchaseHistory() {
  const rows = await prisma.purchaseHistory.findMany({ orderBy: { date: 'desc' } })
  return rows.map(p => ({
    id: toNum(p.id), date: p.date, productName: p.productName, sku: p.sku, category: p.category, qty: p.qty, user: p.user
  }))
}

async function saveAuditLog(list) {
  await prisma.$transaction(async (tx) => {
    await tx.auditLog.deleteMany()
    const data = (list || []).map(e => ({
      id: String(e.id), timestamp: e.timestamp ?? null, user: e.user ?? null, action: e.action ?? '',
      detail: e.detail ?? null, category: e.category ?? null
    }))
    if (data.length) await tx.auditLog.createMany({ data })
  })
}

async function loadAuditLog() {
  const rows = await prisma.auditLog.findMany({ orderBy: { timestamp: 'desc' } })
  return rows.map(e => ({ id: e.id, timestamp: e.timestamp, user: e.user, action: e.action, detail: e.detail, category: e.category }))
}

/* ════════════════════════════════════════════════════════════════════════
 * Carga inicial completa
 * ════════════════════════════════════════════════════════════════════════ */

async function loadAll() {
  const [products, events, rentals, opStates, epcMap, eventHistory, rentalHistory, purchaseHistory, auditLog] = await Promise.all([
    loadProducts(), loadEvents(), loadRentals(), loadOpStates(), loadEpcMap(),
    loadEventHistory(), loadRentalHistory(), loadPurchaseHistory(), loadAuditLog()
  ])
  return { products, events, rentals, opStates, epcMap, eventHistory, rentalHistory, purchaseHistory, auditLog }
}

/* ════════════════════════════════════════════════════════════════════════
 * Usuarios — bcrypt en vez de PBKDF2 (ver nota al principio del archivo)
 * ════════════════════════════════════════════════════════════════════════ */

const BCRYPT_ROUNDS = 12

async function _hashPassword(password) {
  return bcrypt.hash(String(password), BCRYPT_ROUNDS)
}

const _looksLikeBcrypt = (hash) => typeof hash === 'string' && /^\$2[aby]\$/.test(hash)

/* Verifica un hash con el PBKDF2 "salt:hash" que usaba electron/db.js
 * (10000 iteraciones, sha256) — necesario SOLO para los usuarios migrados
 * desde el SQLite real del cliente (ver scripts/migrate-from-sqlite.js),
 * cuyos hashes se copian tal cual porque no hay forma de recuperar la
 * contraseña en texto plano para rehashearla con bcrypt de entrada. */
function _pbkdf2Verify(password, stored) {
  return new Promise((resolve) => {
    const colonIdx = typeof stored === 'string' ? stored.indexOf(':') : -1
    if (colonIdx === -1) return resolve(false)
    const salt = stored.slice(0, colonIdx)
    const expected = stored.slice(colonIdx + 1)
    crypto.pbkdf2(String(password), salt, 10000, 64, 'sha256', (err, derivedKey) => {
      resolve(!err && derivedKey.toString('hex') === expected)
    })
  })
}

async function _verifyPassword(password, stored) {
  try {
    if (_looksLikeBcrypt(stored)) return await bcrypt.compare(String(password), stored)
    return await _pbkdf2Verify(password, stored)
  } catch (err) { console.error('[Auth] verify error:', err.message); return false }
}

// NUNCA incluir passwordHash acá — ver electron/db.js _mapUser para el porqué.
function _mapUser(u) {
  return {
    id: u.id, role: u.role, nombre: u.nombre, apellido: u.apellido,
    email: u.email ?? '', cargo: u.cargo ?? '', avatar: u.avatar ?? '', telefono: u.telefono ?? '',
    username: u.username, hasPin: !!u.pinHash, active: u.active !== false, createdAt: u.createdAt
  }
}

async function loadUsers() {
  const rows = await prisma.user.findMany({ orderBy: { createdAt: 'asc' } })
  return rows.map(_mapUser)
}

async function createUser(data, plainPassword) {
  const id = `usr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  const hash = await _hashPassword(plainPassword)
  const now = new Date().toISOString()
  await prisma.user.create({
    data: {
      id, role: data.role, nombre: data.nombre, apellido: data.apellido,
      email: data.email || null, cargo: data.cargo || null, avatar: data.avatar || null,
      username: data.username, passwordHash: hash, telefono: data.telefono || null, createdAt: now
    }
  })
  return { id, ...data, createdAt: now }
}

async function updateUser(id, fields, plainPassword) {
  const data = {
    nombre: fields.nombre, apellido: fields.apellido, email: fields.email || null,
    cargo: fields.cargo || null, avatar: fields.avatar || null, username: fields.username,
    telefono: fields.telefono || null
  }
  if (fields.role) data.role = fields.role
  if (plainPassword) data.passwordHash = await _hashPassword(plainPassword)
  await prisma.user.update({ where: { id }, data })
}

async function deleteUser(id) {
  await prisma.user.delete({ where: { id } })
}

async function authLogin(username, plainPassword) {
  const u = await prisma.user.findUnique({ where: { username } })
  if (!u) return null
  if (!u.active) return { disabled: true }
  if (!(await _verifyPassword(plainPassword, u.passwordHash))) return null
  if (!_looksLikeBcrypt(u.passwordHash)) {
    // Login correcto con un hash heredado del SQLite viejo (PBKDF2) — se
    // reemplaza por bcrypt ahora que tenemos la contraseña en texto plano a
    // mano. Transparente para el usuario, no hace falta resetear nada.
    try { await prisma.user.update({ where: { id: u.id }, data: { passwordHash: await _hashPassword(plainPassword) } }) }
    catch (e) { console.error('[Auth] No se pudo re-hashear password heredado:', e.message) }
  }
  return {
    id: u.id, role: u.role, nombre: u.nombre, apellido: u.apellido,
    email: u.email ?? '', cargo: u.cargo ?? '', avatar: u.avatar ?? '',
    username: u.username, hasPin: !!u.pinHash, active: true, createdAt: u.createdAt
  }
}

async function countAdmins() {
  return prisma.user.count({ where: { role: 'admin' } })
}

/* ── PIN de acceso rápido — mismo esquema liviano que el original (SHA-256
 * sin salt fuerte, es un segundo factor corto, no reemplazo de contraseña) ── */
/* ── RNF-006: el PIN pasó de SHA-256(userId+':'+pin) a bcrypt ───────────
 * SHA-256 es rápido de calcular — con solo 10.000 combinaciones posibles
 * (4 dígitos), un PIN filtrado junto con la base se puede probar entero en
 * segundos. bcrypt es deliberadamente lento, hace inviable esa fuerza
 * bruta offline aunque la base se filtre. _legacyPinHash/_verifyPin dan el
 * mismo camino de migración perezosa que ya se usa para las contraseñas:
 * un PIN viejo se verifica una última vez con el algoritmo anterior y, si
 * es correcto, se reemplaza por bcrypt ahí mismo — nadie necesita volver a
 * configurar su PIN a mano. */
function _legacyPinHash(userId, pin) {
  return crypto.createHash('sha256').update(userId + ':' + String(pin)).digest('hex')
}

async function _verifyPin(userId, pin, stored) {
  if (_looksLikeBcrypt(stored)) return bcrypt.compare(String(pin), stored)
  return _legacyPinHash(userId, pin) === stored
}

async function setUserPin(userId, pin) {
  const hash = await bcrypt.hash(String(pin), BCRYPT_ROUNDS)
  return prisma.user.update({ where: { id: userId }, data: { pinHash: hash } })
}

function removeUserPin(userId) {
  return prisma.user.update({ where: { id: userId }, data: { pinHash: null } })
}

async function authLoginPin(userId, pin) {
  const u = await prisma.user.findUnique({ where: { id: userId } })
  if (!u || !u.pinHash) return null
  if (!u.active) return { disabled: true }
  const valid = await _verifyPin(userId, pin, u.pinHash)
  if (!valid) return null
  if (!_looksLikeBcrypt(u.pinHash)) {
    try { await prisma.user.update({ where: { id: userId }, data: { pinHash: await bcrypt.hash(String(pin), BCRYPT_ROUNDS) } }) }
    catch (e) { console.error('[Auth] No se pudo re-hashear PIN heredado:', e.message) }
  }
  return {
    id: u.id, role: u.role, nombre: u.nombre, apellido: u.apellido,
    email: u.email ?? '', cargo: u.cargo ?? '', avatar: u.avatar ?? '',
    username: u.username, hasPin: true, active: true, createdAt: u.createdAt
  }
}

function setUserActive(id, active) {
  return prisma.user.update({ where: { id }, data: { active: !!active } })
}

/* ════════════════════════════════════════════════════════════════════════
 * Sesiones
 * ════════════════════════════════════════════════════════════════════════ */

async function createSession(userId, username, displayName, ip) {
  const id = `ses-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  await prisma.session.create({
    data: { id, userId, username, displayName: displayName || null, loginAt: new Date().toISOString(), ip: ip || null }
  })
  return id
}

async function closeSession(id) {
  if (!id) return
  await prisma.session.updateMany({ where: { id, logoutAt: null }, data: { logoutAt: new Date().toISOString() } })
}

async function closeAllOpenSessions() {
  await prisma.session.updateMany({ where: { logoutAt: null }, data: { logoutAt: new Date().toISOString() } })
}

async function loadUserSessions(userId, limit = 30) {
  const rows = await prisma.session.findMany({ where: { userId }, orderBy: { loginAt: 'desc' }, take: limit })
  return rows.map(s => ({
    id: s.id, userId: s.userId, username: s.username, displayName: s.displayName,
    loginAt: s.loginAt, logoutAt: s.logoutAt, ip: s.ip
  }))
}

/* ════════════════════════════════════════════════════════════════════════
 * Chat interno
 * ════════════════════════════════════════════════════════════════════════ */

async function getConversation(userA, userB) {
  return prisma.message.findMany({
    where: { OR: [{ fromUser: userA, toUser: userB }, { fromUser: userB, toUser: userA }] },
    orderBy: { id: 'asc' }
  })
}

async function createMessage(fromUser, toUser, content, type, metadata) {
  return prisma.message.create({
    data: {
      fromUser, toUser, content, type: type || 'text',
      metadata: metadata ? JSON.stringify(metadata) : null,
      createdAt: new Date().toISOString()
    }
  })
}

async function markMessageRead(messageId, userId) {
  await prisma.message.updateMany({
    where: { id: messageId, toUser: userId, readAt: null },
    data: { readAt: new Date().toISOString() }
  })
}

async function countUnread(userId) {
  return prisma.message.count({ where: { toUser: userId, readAt: null } })
}

async function countUnreadBySender(userId) {
  const rows = await prisma.message.groupBy({ by: ['fromUser'], where: { toUser: userId, readAt: null }, _count: true })
  const bySender = {}
  rows.forEach(r => { bySender[r.fromUser] = r._count })
  return bySender
}

async function markConversationRead(userId, withUser) {
  await prisma.message.updateMany({
    where: { toUser: userId, fromUser: withUser, readAt: null },
    data: { readAt: new Date().toISOString() }
  })
}

/* ════════════════════════════════════════════════════════════════════════
 * Personal (Staff)
 * ════════════════════════════════════════════════════════════════════════ */

async function loadStaff() {
  const rows = await prisma.staff.findMany({ orderBy: { apellido: 'asc' } })
  return rows.map(s => ({
    id: s.id, nombre: s.nombre, apellido: s.apellido, rut: s.rut ?? '', telefono: s.telefono ?? '',
    cargo: s.cargo ?? '', activo: s.activo !== false, createdAt: s.createdAt
  }))
}

async function createStaff(data) {
  const id = `stf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  const now = new Date().toISOString()
  await prisma.staff.create({
    data: { id, nombre: data.nombre, apellido: data.apellido, rut: data.rut || null, telefono: data.telefono || null, cargo: data.cargo || null, activo: true, createdAt: now }
  })
  return { id, ...data, activo: true, createdAt: now }
}

async function updateStaff(id, data) {
  await prisma.staff.update({
    where: { id },
    data: { nombre: data.nombre, apellido: data.apellido, rut: data.rut || null, telefono: data.telefono || null, cargo: data.cargo || null, activo: data.activo !== false }
  })
}

async function deleteStaff(id) {
  await prisma.staff.delete({ where: { id } })
}

/* ════════════════════════════════════════════════════════════════════════
 * Configuración general (clave/valor)
 * ════════════════════════════════════════════════════════════════════════ */

async function getSetting(key) {
  const row = await prisma.appSetting.findUnique({ where: { key } })
  return row ? row.value : null
}

async function setSetting(key, value) {
  await prisma.appSetting.upsert({ where: { key }, create: { key, value }, update: { value } })
}

/* ════════════════════════════════════════════════════════════════════════
 * Recuperación de contraseña
 * ════════════════════════════════════════════════════════════════════════ */

async function createPasswordReset(userId) {
  const code = String(Math.floor(100000 + Math.random() * 900000))
  const codeHash = crypto.createHash('sha256').update(code).digest('hex')
  const now = new Date()
  const expiresAt = new Date(now.getTime() + 15 * 60 * 1000).toISOString()
  await prisma.$transaction([
    prisma.passwordReset.updateMany({ where: { userId, used: false }, data: { used: true } }),
    prisma.passwordReset.create({ data: { userId, codeHash, expiresAt, used: false, createdAt: now.toISOString() } })
  ])
  return code
}

async function verifyAndConsumePasswordReset(userId, code) {
  const codeHash = crypto.createHash('sha256').update(String(code)).digest('hex')
  const row = await prisma.passwordReset.findFirst({
    where: { userId, used: false, expiresAt: { gt: new Date().toISOString() } },
    orderBy: { createdAt: 'desc' }
  })
  if (!row || row.codeHash !== codeHash) return false
  await prisma.passwordReset.update({ where: { id: row.id }, data: { used: true } })
  return true
}

async function setUserPassword(userId, plainPassword) {
  const hash = await _hashPassword(plainPassword)
  await prisma.user.update({ where: { id: userId }, data: { passwordHash: hash } })
}

/* ════════════════════════════════════════════════════════════════════════
 * Dispositivo de confianza del administrador + OTP de login
 * ════════════════════════════════════════════════════════════════════════ */

async function setTrustedDeviceId(userId, deviceId) {
  if (!deviceId) return
  await prisma.user.update({ where: { id: userId }, data: { trustedDeviceId: deviceId } })
}

async function isTrustedDevice(deviceId) {
  const admins = await prisma.user.findMany({ where: { role: 'admin', active: true }, select: { trustedDeviceId: true } })
  if (admins.length === 0) return true
  if (admins.every(a => !a.trustedDeviceId)) return true
  if (!deviceId) return false
  return admins.some(a => a.trustedDeviceId === deviceId)
}

async function createAdminLoginOtp(username) {
  const u = await prisma.user.findFirst({ where: { username, role: 'admin' } })
  if (!u || !u.active) return null
  const code = String(Math.floor(100000 + Math.random() * 900000))
  const codeHash = crypto.createHash('sha256').update(code).digest('hex')
  const now = new Date()
  const expiresAt = new Date(now.getTime() + 10 * 60 * 1000).toISOString()
  await prisma.$transaction([
    prisma.adminLoginOtp.updateMany({ where: { userId: u.id, used: false }, data: { used: true } }),
    prisma.adminLoginOtp.create({ data: { userId: u.id, codeHash, expiresAt, used: false, createdAt: now.toISOString() } })
  ])
  return { code, user: u }
}

async function verifyAdminLoginOtp(username, code) {
  const u = await prisma.user.findFirst({ where: { username, role: 'admin' } })
  if (!u || !u.active) return null
  const codeHash = crypto.createHash('sha256').update(String(code)).digest('hex')
  const row = await prisma.adminLoginOtp.findFirst({
    where: { userId: u.id, used: false, expiresAt: { gt: new Date().toISOString() } },
    orderBy: { createdAt: 'desc' }
  })
  if (!row || row.codeHash !== codeHash) return null
  await prisma.adminLoginOtp.update({ where: { id: row.id }, data: { used: true } })
  return {
    id: u.id, role: u.role, nombre: u.nombre, apellido: u.apellido,
    email: u.email ?? '', cargo: u.cargo ?? '', avatar: u.avatar ?? '',
    username: u.username, hasPin: !!u.pinHash, active: true, createdAt: u.createdAt
  }
}

module.exports = {
  prisma,
  loadAll,
  findDoubleBookingConflict,
  saveProducts, loadProducts,
  saveEvents, loadEvents,
  saveRentals, loadRentals,
  saveOpStates, loadOpStates,
  saveEpcMap, loadEpcMap,
  saveEventHistory, loadEventHistory,
  saveRentalHistory, loadRentalHistory,
  savePurchaseHistory, loadPurchaseHistory,
  saveAuditLog, loadAuditLog,
  loadUsers, createUser, updateUser, deleteUser, authLogin, countAdmins,
  setUserPin, removeUserPin, authLoginPin, setUserActive,
  createSession, closeSession, closeAllOpenSessions, loadUserSessions,
  getConversation, createMessage, markMessageRead, countUnread, countUnreadBySender, markConversationRead,
  loadStaff, createStaff, updateStaff, deleteStaff,
  getSetting, setSetting,
  createPasswordReset, verifyAndConsumePasswordReset, setUserPassword,
  setTrustedDeviceId, isTrustedDevice, createAdminLoginOtp, verifyAdminLoginOtp
}
