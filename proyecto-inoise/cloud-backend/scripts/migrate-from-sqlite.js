/**
 * cloud-backend/scripts/migrate-from-sqlite.js
 *
 * Migración de UNA SOLA PASADA: lee el inoise.db real (SQLite, el que
 * usaba electron/db.js antes de la Parte D) y escribe todo en Postgres,
 * reutilizando las mismas funciones save* de cloud-backend/src/db.js que
 * ya usa la app en producción — así esto escribe exactamente igual que un
 * guardado normal desde el frontend, sin duplicar la lógica de Prisma.
 *
 * USO:
 *   node scripts/migrate-from-sqlite.js /ruta/a/inoise.db
 *   node scripts/migrate-from-sqlite.js /ruta/a/inoise.db --skip-users --skip-events
 *
 * --skip-users: migra productos/eventos/arriendos/historiales/epcMap/
 *   auditoría, pero NO usuarios, personal, sesiones ni chat interno (todo
 *   eso depende de ids de usuario) — para arrancar la cuenta de admin y el
 *   equipo de cero en vez de heredar las cuentas viejas del SQLite.
 *
 * --skip-events: migra productos/unidades/epcMap/auditoría/compras, pero
 *   deja eventos, arriendos y sus historiales en cero (se crean de cero en
 *   la app) — para arrancar la operación sin arrastrar eventos/arriendos
 *   viejos, sin perder el inventario real.
 *
 * IMPORTANTE:
 *  - Corré esto primero contra una COPIA del inoise.db real (nunca el
 *    archivo en vivo mientras la app lo tiene abierto) y contra un Postgres
 *    de prueba, para confirmar conteos antes de tocar producción.
 *  - Este script REEMPLAZA productos/eventos/arriendos/historiales en el
 *    Postgres de destino (mismo contrato que ya usan los PUT /api/data/*
 *    del frontend) — no es un merge. Pensado para correr una sola vez,
 *    antes de que el cliente empiece a operar sobre la nube.
 *  - Requiere better-sqlite3 instalado en cloud-backend (ver package.json)
 *    y DATABASE_URL en .env apuntando al Postgres DESTINO.
 */

require('dotenv').config()
const Database = require('better-sqlite3')
const {
  prisma,
  saveProducts, saveEvents, saveRentals, saveOpStates, saveEpcMap,
  saveEventHistory, saveRentalHistory, savePurchaseHistory, saveAuditLog
} = require('../src/db')

const dbPath = process.argv[2]
const skipUsers = process.argv.includes('--skip-users')
const skipEvents = process.argv.includes('--skip-events')
if (!dbPath) {
  console.error('Uso: node scripts/migrate-from-sqlite.js <ruta-a-inoise.db> [--skip-users] [--skip-events]')
  process.exit(1)
}

const sqlite = new Database(dbPath, { readonly: true, fileMustExist: true })

/* ── Lectores portados de electron/db.js (archivo ya borrado del repo tras
 * la Parte D — se recupera de la historia de git en "eebf602^") — leen
 * directo del SQLite en vez de depender de getDb(). ────────────────────── */

function loadProductsFromSqlite() {
  const products = sqlite.prepare('SELECT * FROM products').all()
  const units = sqlite.prepare('SELECT * FROM units').all()
  return products.map(p => ({
    id: p.id, name: p.name, sku: p.sku, rfidBase: p.rfid_base, category: p.category,
    total: p.total, description: p.description,
    pendingDelete: !!p.pending_delete, pendingDeleteBy: p.pending_delete_by, pendingDeleteAt: p.pending_delete_at,
    units: units.filter(u => u.product_id === p.id).map(u => ({ id: u.id, rfid: u.rfid, state: u.state }))
  }))
}

function loadEventsFromSqlite() {
  const events = sqlite.prepare('SELECT * FROM events').all()
  const assignments = sqlite.prepare('SELECT * FROM event_assignments').all()
  const units = sqlite.prepare('SELECT * FROM event_assignment_units').all()
  return events.map(e => ({
    id: e.id, orderNumber: e.order_number, name: e.name, date: e.date, location: e.location,
    notes: e.notes, status: e.status, createdAt: e.created_at,
    pendingDelete: !!e.pending_delete, pendingDeleteBy: e.pending_delete_by, pendingDeleteAt: e.pending_delete_at,
    pendingDeleteReason: e.pending_delete_reason, cancelReason: e.cancel_reason, cancelledBy: e.cancelled_by, cancelledAt: e.cancelled_at,
    staffIds: e.staff_ids ? JSON.parse(e.staff_ids) : [],
    assignments: assignments.filter(a => a.event_id === e.id).map(a => ({
      productId: a.product_id, qty: a.qty,
      unitIds: units.filter(u => u.assignment_id === a.id).map(u => u.unit_id)
    }))
  }))
}

function loadRentalsFromSqlite() {
  const rentals = sqlite.prepare('SELECT * FROM rentals').all()
  const assignments = sqlite.prepare('SELECT * FROM rental_assignments').all()
  const units = sqlite.prepare('SELECT * FROM rental_assignment_units').all()
  return rentals.map(r => ({
    id: r.id, orderNumber: r.order_number, name: r.name, date: r.date, endDate: r.end_date,
    clientName: r.client_name, staffName: r.staff_name, notes: r.notes, status: r.status, createdAt: r.created_at,
    pendingDelete: !!r.pending_delete, pendingDeleteBy: r.pending_delete_by, pendingDeleteAt: r.pending_delete_at,
    pendingDeleteReason: r.pending_delete_reason, cancelReason: r.cancel_reason, cancelledBy: r.cancelled_by, cancelledAt: r.cancelled_at,
    staffIds: r.staff_ids ? JSON.parse(r.staff_ids) : [],
    assignments: assignments.filter(a => a.rental_id === r.id).map(a => ({
      productId: a.product_id, qty: a.qty,
      unitIds: units.filter(u => u.assignment_id === a.id).map(u => u.unit_id)
    }))
  }))
}

const PHASE_KEYS = ['f1', 'f2', 'f3', 'f4']

function _loadOpStatesFromSqlite(tables, idColumn, unitInfo) {
  const states = sqlite.prepare(`SELECT * FROM ${tables.states}`).all()
  const phases = sqlite.prepare(`SELECT * FROM ${tables.phases}`).all()
  const scanned = sqlite.prepare(`SELECT * FROM ${tables.scanned}`).all()
  const incidents = sqlite.prepare(`SELECT * FROM ${tables.incidents}`).all()
  const result = {}
  for (const st of states) {
    const id = st[idColumn]
    const entityPhases = phases.filter(p => p[idColumn] === id)
    const phasesObj = {}
    for (const phaseKey of PHASE_KEYS) {
      const ph = entityPhases.find(p => p.phase_key === phaseKey)
      phasesObj[phaseKey] = {
        done: !!ph?.done, forcedClose: !!ph?.forced_close,
        scanned: scanned.filter(s => s[idColumn] === id && s.phase_key === phaseKey)
          .map(s => ({ id: s.unit_id, scannedAt: s.scanned_at, ...unitInfo(s.unit_id) })),
        incidents: incidents.filter(i => i[idColumn] === id && i.phase_key === phaseKey)
          .map(i => ({
            id: i.unit_id, name: i.name, rfid: i.rfid, state: i.state, reason: i.reason, reportedAt: i.reported_at,
            productId: unitInfo(i.unit_id).productId, sku: unitInfo(i.unit_id).sku
          }))
      }
    }
    result[id] = {
      totalItems: st.total_items, activePhase: st.active_phase, scanMode: st.scan_mode,
      forcedBy: st.forced_by_json ? JSON.parse(st.forced_by_json) : null,
      forceLog: st.force_log_json ? JSON.parse(st.force_log_json) : [],
      phases: phasesObj
    }
  }
  return result
}

function loadOpStatesFromSqlite() {
  const units = sqlite.prepare('SELECT * FROM units').all()
  const products = sqlite.prepare('SELECT * FROM products').all()
  const unitInfo = (unitId) => {
    const u = units.find(x => x.id === unitId)
    if (!u) return { rfid: null, name: null, sku: null, productId: null }
    const p = products.find(x => x.id === u.product_id)
    return { rfid: u.rfid, name: p?.name ?? null, sku: p?.sku ?? null, productId: u.product_id }
  }
  const EVENT_OP_TABLES = { states: 'op_states', phases: 'op_state_phases', scanned: 'op_state_scanned_units', incidents: 'op_state_incidents' }
  const RENTAL_OP_TABLES = { states: 'rental_op_states', phases: 'rental_op_state_phases', scanned: 'rental_op_state_scanned_units', incidents: 'rental_op_state_incidents' }
  return {
    ..._loadOpStatesFromSqlite(EVENT_OP_TABLES, 'event_id', unitInfo),
    ..._loadOpStatesFromSqlite(RENTAL_OP_TABLES, 'rental_id', unitInfo)
  }
}

function loadEpcMapFromSqlite() {
  const rows = sqlite.prepare('SELECT * FROM epc_map').all()
  const map = {}
  for (const r of rows) map[r.epc] = r.unit_id
  return map
}

function loadEventHistoryFromSqlite() {
  const parseJson = (s, fb) => { try { return s ? JSON.parse(s) : fb } catch { return fb } }
  return sqlite.prepare('SELECT * FROM event_history').all().map(e => ({
    id: e.id, orderNumber: e.order_number, name: e.name, date: e.date, location: e.location,
    totalItems: e.total_items, incidentsCount: e.incidents_count, forcedClose: !!e.forced_close,
    closedAt: e.closed_at, closedBy: e.closed_by,
    items: parseJson(e.items_json, []), phasesApproved: parseJson(e.phases_approved_json, []), lossDetails: parseJson(e.loss_details_json, [])
  }))
}

function loadRentalHistoryFromSqlite() {
  return sqlite.prepare('SELECT * FROM rental_history').all().map(r => ({
    id: r.id, orderNumber: r.order_number, name: r.name, clientName: r.client_name,
    date: r.date, endDate: r.end_date, totalItems: r.total_items, closedAt: r.closed_at, closedBy: r.closed_by
  }))
}

function loadPurchaseHistoryFromSqlite() {
  return sqlite.prepare('SELECT * FROM purchase_history').all().map(p => ({
    id: p.id, date: p.date, productName: p.product_name, sku: p.sku, category: p.category, qty: p.qty, user: p.user
  }))
}

function loadAuditLogFromSqlite() {
  return sqlite.prepare('SELECT * FROM audit_log').all().map(e => ({
    id: e.id, timestamp: e.timestamp, user: e.user, action: e.action, detail: e.detail, category: e.category
  }))
}

/* ── Usuarios, personal, sesiones, chat, ajustes: no pasan por save*
 * normales (esas generan ids/hashes NUEVOS) — se insertan directo con
 * Prisma, preservando ids y hashes de contraseña tal cual. Los logins con
 * hash PBKDF2 heredado siguen funcionando gracias al fallback agregado en
 * src/db.js (_verifyPassword), que además los upgradea a bcrypt solos en
 * el primer login exitoso tras la migración. ─────────────────────────── */

async function migrateUsers() {
  const rows = sqlite.prepare('SELECT * FROM users').all()
  for (const u of rows) {
    await prisma.user.upsert({
      where: { id: u.id },
      create: {
        id: u.id, role: u.role, nombre: u.nombre, apellido: u.apellido,
        email: u.email, cargo: u.cargo, avatar: u.avatar, telefono: u.telefono,
        username: u.username, passwordHash: u.password_hash, pinHash: u.pin_hash,
        active: u.active !== 0, trustedDeviceId: u.trusted_device_id, createdAt: u.created_at
      },
      update: {}
    })
  }
  return rows.length
}

async function migrateStaff() {
  const rows = sqlite.prepare('SELECT * FROM staff').all()
  for (const s of rows) {
    await prisma.staff.upsert({
      where: { id: s.id },
      create: {
        id: s.id, nombre: s.nombre, apellido: s.apellido, rut: s.rut, telefono: s.telefono,
        cargo: s.cargo, activo: s.activo !== 0, createdAt: s.created_at
      },
      update: {}
    })
  }
  return rows.length
}

async function migrateSettings() {
  const rows = sqlite.prepare('SELECT * FROM app_settings').all()
  for (const s of rows) {
    await prisma.appSetting.upsert({ where: { key: s.key }, create: { key: s.key, value: s.value }, update: { value: s.value } })
  }
  return rows.length
}

async function migrateSessions() {
  const rows = sqlite.prepare('SELECT * FROM sessions').all()
  for (const s of rows) {
    await prisma.session.upsert({
      where: { id: s.id },
      create: { id: s.id, userId: s.user_id, username: s.username, displayName: s.display_name, loginAt: s.login_at, logoutAt: s.logout_at, ip: s.ip },
      update: {}
    })
  }
  return rows.length
}

// messages.id es autoincrement en Postgres — al insertar ids explícitos
// hay que empujar la secuencia interna más allá del máximo migrado, si no
// el próximo mensaje real (creado sin id explícito) puede chocar con uno
// de estos ids ya usados.
async function migrateMessages() {
  const rows = sqlite.prepare('SELECT * FROM messages').all()
  for (const m of rows) {
    await prisma.message.upsert({
      where: { id: m.id },
      create: {
        id: m.id, fromUser: m.from_user, toUser: m.to_user, content: m.content,
        type: m.type, metadata: m.metadata, createdAt: m.created_at, readAt: m.read_at
      },
      update: {}
    })
  }
  if (rows.length) {
    await prisma.$executeRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('messages', 'id'), (SELECT COALESCE(MAX(id), 1) FROM messages))`
    )
  }
  return rows.length
}

async function main() {
  console.log('[Migración] Leyendo', dbPath)

  const products = loadProductsFromSqlite()
  const events = skipEvents ? [] : loadEventsFromSqlite()
  const rentals = skipEvents ? [] : loadRentalsFromSqlite()
  const opStates = skipEvents ? {} : loadOpStatesFromSqlite()
  const epcMap = loadEpcMapFromSqlite()
  const eventHistory = skipEvents ? [] : loadEventHistoryFromSqlite()
  const rentalHistory = skipEvents ? [] : loadRentalHistoryFromSqlite()
  const purchaseHistory = loadPurchaseHistoryFromSqlite()
  const auditLog = loadAuditLogFromSqlite()

  if (skipEvents) console.log('[Migración] --skip-events: eventos, arriendos, op-states e historiales quedan en 0')
  console.log(`[Migración] Encontrados: ${products.length} productos, ${events.length} eventos, ${rentals.length} arriendos, ${Object.keys(epcMap).length} tags vinculados`)

  console.log('[Migración] Escribiendo en Postgres (mismas funciones save* que usa la app)...')
  await saveProducts(products)
  await saveEvents(events)
  await saveRentals(rentals)
  await saveOpStates(opStates)
  await saveEpcMap(epcMap)
  await saveEventHistory(eventHistory)
  await saveRentalHistory(rentalHistory)
  await savePurchaseHistory(purchaseHistory)
  await saveAuditLog(auditLog)

  const nSettings = await migrateSettings()
  let nUsers = 0, nStaff = 0, nSessions = 0, nMessages = 0
  if (skipUsers) {
    console.log('[Migración] --skip-users: se omiten usuarios, personal, sesiones y chat (se crean de cero en la app)')
  } else {
    nUsers = await migrateUsers()
    nStaff = await migrateStaff()
    nSessions = await migrateSessions()
    nMessages = await migrateMessages()
  }

  console.log(`[Migración] Usuarios: ${nUsers} | Personal: ${nStaff} | Ajustes: ${nSettings} | Sesiones: ${nSessions} | Mensajes: ${nMessages}`)
  console.log('[Migración] Listo ✓')
}

main()
  .catch(e => { console.error('[Migración] ERROR:', e); process.exitCode = 1 })
  .finally(async () => { sqlite.close(); await prisma.$disconnect() })
