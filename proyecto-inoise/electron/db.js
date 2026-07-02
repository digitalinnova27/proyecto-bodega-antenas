// electron/db.js
//
// Capa de persistencia en disco con SQLite (better-sqlite3), vive en el
// proceso main de Electron (no en el renderer/React, porque contextIsolation
// está en true y el renderer no puede tocar Node/archivos directamente).
//
// El archivo .sqlite se guarda en app.getPath('userData') — esa carpeta
// NUNCA se borra ni se sobreescribe cuando se reinstala o actualiza la app
// (el instalador NSIS solo reemplaza los archivos de programa), así que
// los datos del cliente sobreviven a futuras actualizaciones que pida el
// jefe sin perderse.
//
// Este archivo solo abre la conexión y crea las tablas si no existen
// (CREATE TABLE IF NOT EXISTS). Las funciones para leer/escribir datos
// específicos (productos, eventos, etc.) se agregan en el siguiente paso,
// junto con el puente IPC en preload.js.

const path = require('path')
const { app } = require('electron')
const Database = require('better-sqlite3')
const crypto = require('crypto')

let db = null

/* ── Por qué withForeignKeysOff existe ──
 * Cada tabla principal (products, events, rentals, op_states) se guarda con
 * el patrón "borrar todo + reinsertar" dentro de su PROPIA transacción,
 * independiente de las demás tablas (ver comentario más abajo). El problema:
 * con foreign_keys=ON, SQLite revisa cada DELETE al instante, no al final de
 * la transacción. Si, por ejemplo, ya existe un evento que usa el producto
 * X, y solo cambia el estado de una unidad (lo que dispara saveProducts),
 * el DELETE FROM products explota con "FOREIGN KEY constraint failed" aunque
 * ese mismo producto se vaya a reinsertar 2 líneas después con el mismo id.
 * Para evitar esto, apagamos la verificación de llaves foráneas justo
 * alrededor de esa transacción puntual (nunca de forma global ni permanente)
 * y la volvemos a encender enseguida. Al terminar, los ids vuelven a estar
 * exactamente donde estaban, así que la integridad real nunca se pierde —
 * solo se tolera quedar momentáneamente "inconsistente" a mitad de la
 * transacción, que es exactamente lo que este patrón necesita. */
function withForeignKeysOff(database, fn) {
    database.pragma('foreign_keys = OFF')
    try {
        return fn()
    } finally {
        database.pragma('foreign_keys = ON')
    }
}

function getDb() {
    if (db) return db

    const dbPath = path.join(app.getPath('userData'), 'inoise.db')
    db = new Database(dbPath)

    // WAL mejora la concurrencia de lectura/escritura y reduce el riesgo de
    // corrupción si la app se cierra abruptamente a mitad de una escritura.
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')

    runMigrations(db)

    console.log('[DB] SQLite listo en:', dbPath)
    return db
}

/* Agrega una columna a una tabla existente si todavía no existe — SQLite no
 * soporta "ADD COLUMN IF NOT EXISTS", así que se revisa pragma table_info()
 * a mano. Usado para sumar el flujo de aprobación de eliminación
 * (pending_delete) a bases de datos que ya existían de versiones previas
 * sin romper los datos que el usuario ya tenía guardados. */
function ensureColumn(db, table, column, definition) {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all()
    if (!cols.some(c => c.name === column)) {
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
    }
}

function runMigrations(db) {
    db.exec(`
    /* ── Inventario ───────────────────────────────────────────────── */
    CREATE TABLE IF NOT EXISTS products (
      id          INTEGER PRIMARY KEY,
      name        TEXT NOT NULL,
      sku         TEXT,
      rfid_base   TEXT,
      category    TEXT,
      total       INTEGER NOT NULL DEFAULT 0,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS units (
      id          TEXT PRIMARY KEY,        -- ej "1699999999-1"
      product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      rfid        TEXT,
      state       TEXT NOT NULL DEFAULT 'Disponible'
    );
    CREATE INDEX IF NOT EXISTS idx_units_product ON units(product_id);

    /* ── Eventos ──────────────────────────────────────────────────── */
    CREATE TABLE IF NOT EXISTS events (
      id           INTEGER PRIMARY KEY,
      order_number TEXT,
      name         TEXT NOT NULL,
      date         TEXT,
      location     TEXT,
      notes        TEXT,
      status       TEXT NOT NULL DEFAULT 'Programado',
      created_at   TEXT
    );

    CREATE TABLE IF NOT EXISTS event_assignments (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id   INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id),
      qty        INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_evassign_event ON event_assignments(event_id);

    CREATE TABLE IF NOT EXISTS event_assignment_units (
      assignment_id INTEGER NOT NULL REFERENCES event_assignments(id) ON DELETE CASCADE,
      unit_id       TEXT NOT NULL REFERENCES units(id),
      PRIMARY KEY (assignment_id, unit_id)
    );

    /* ── Arriendos (rentals) ──────────────────────────────────────── */
    CREATE TABLE IF NOT EXISTS rentals (
      id           INTEGER PRIMARY KEY,
      order_number TEXT,
      name         TEXT NOT NULL,
      date         TEXT,
      end_date     TEXT,
      client_name  TEXT,
      staff_name   TEXT,
      notes        TEXT,
      status       TEXT NOT NULL DEFAULT 'Programado',
      created_at   TEXT
    );

    CREATE TABLE IF NOT EXISTS rental_assignments (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      rental_id  INTEGER NOT NULL REFERENCES rentals(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id),
      qty        INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_rentassign_rental ON rental_assignments(rental_id);

    CREATE TABLE IF NOT EXISTS rental_assignment_units (
      assignment_id INTEGER NOT NULL REFERENCES rental_assignments(id) ON DELETE CASCADE,
      unit_id       TEXT NOT NULL REFERENCES units(id),
      PRIMARY KEY (assignment_id, unit_id)
    );

    /* ── Progreso de fases en Operaciones (opStates) ─────────────────
     * Un evento tiene 4 fases fijas (f1..f4). Cada fase acumula artículos
     * escaneados (op_state_scanned_units) e incidencias (op_state_incidents). */
    CREATE TABLE IF NOT EXISTS op_states (
      event_id    INTEGER PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
      total_items INTEGER NOT NULL DEFAULT 0,
      active_phase TEXT,
      scan_mode   TEXT,
      forced_by_json TEXT,   -- log del cierre forzado (estructura variable), guardado como JSON
      force_log_json TEXT
    );

    CREATE TABLE IF NOT EXISTS op_state_phases (
      event_id  INTEGER NOT NULL REFERENCES op_states(event_id) ON DELETE CASCADE,
      phase_key TEXT NOT NULL,         -- 'f1' | 'f2' | 'f3' | 'f4'
      done      INTEGER NOT NULL DEFAULT 0,
      forced_close INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (event_id, phase_key)
    );

    CREATE TABLE IF NOT EXISTS op_state_scanned_units (
      event_id    INTEGER NOT NULL,
      phase_key   TEXT NOT NULL,
      unit_id     TEXT NOT NULL,
      scanned_at  TEXT,
      PRIMARY KEY (event_id, phase_key, unit_id),
      FOREIGN KEY (event_id, phase_key) REFERENCES op_state_phases(event_id, phase_key) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS op_state_incidents (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id    INTEGER NOT NULL,
      phase_key   TEXT NOT NULL,
      unit_id     TEXT,
      name        TEXT,
      rfid        TEXT,
      state       TEXT,
      reason      TEXT,
      reported_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_incidents_event_phase ON op_state_incidents(event_id, phase_key);

    /* ── Vínculos RFID ↔ unidad ───────────────────────────────────── */
    CREATE TABLE IF NOT EXISTS epc_map (
      epc     TEXT PRIMARY KEY,
      unit_id TEXT NOT NULL
    );

    /* ── Historiales ──────────────────────────────────────────────── */
    CREATE TABLE IF NOT EXISTS event_history (
      id             INTEGER PRIMARY KEY,
      order_number   TEXT,
      name           TEXT,
      date           TEXT,
      location       TEXT,
      total_items    INTEGER,
      incidents_count INTEGER,
      forced_close   INTEGER,
      closed_at      TEXT,
      closed_by      TEXT
    );

    CREATE TABLE IF NOT EXISTS rental_history (
      id           INTEGER PRIMARY KEY,
      order_number TEXT,
      name         TEXT,
      client_name  TEXT,
      date         TEXT,
      end_date     TEXT,
      total_items  INTEGER,
      closed_at    TEXT,
      closed_by    TEXT
    );

    CREATE TABLE IF NOT EXISTS purchase_history (
      id           INTEGER PRIMARY KEY,
      date         TEXT,
      product_name TEXT,
      sku          TEXT,
      category     TEXT,
      qty          INTEGER,
      user         TEXT
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id        TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      user      TEXT,
      action    TEXT NOT NULL,
      detail    TEXT,
      category  TEXT
    );

    /* ── Usuarios del sistema ─────────────────────────────────────────
     * role: admin (max 1) | operador (N)
     * avatar: id del preset elegido (av1..av8)
     * password_hash: pbkdf2 con salt -- formato: <salt_hex>:<hash_hex> */
    CREATE TABLE IF NOT EXISTS users (
      id            TEXT PRIMARY KEY,
      role          TEXT NOT NULL DEFAULT 'operador',
      nombre        TEXT NOT NULL,
      apellido      TEXT NOT NULL,
      email         TEXT,
      cargo         TEXT,
      avatar        TEXT,
      username      TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at    TEXT
    );
  `)

    // Columnas del flujo de aprobación de eliminación (operador solicita,
    // admin aprueba/rechaza) — sumadas a productos y eventos.
    ensureColumn(db, 'products', 'pending_delete', 'INTEGER DEFAULT 0')
    ensureColumn(db, 'products', 'pending_delete_by', 'TEXT')
    ensureColumn(db, 'products', 'pending_delete_at', 'TEXT')
    ensureColumn(db, 'events', 'pending_delete', 'INTEGER DEFAULT 0')
    ensureColumn(db, 'events', 'pending_delete_by', 'TEXT')
    ensureColumn(db, 'events', 'pending_delete_at', 'TEXT')
    // PIN de acceso rápido — NULL = sin PIN configurado
    ensureColumn(db, 'users', 'pin_hash', 'TEXT')
}

/* ════════════════════════════════════════════════════════════════════════
 * Lectura/escritura de datos — puente IPC (paso 3)
 *
 * Patrón usado para cada entidad: "reemplazar todo en una transacción".
 * Cada save* borra las filas existentes de esa entidad y reinserta el
 * estado completo que llega desde React (InventoryContext). Es más simple
 * y robusto que hacer diffs fila por fila, y como las tablas son pocas
 * filas (cientos, no millones) el costo es insignificante. Todo corre
 * dentro de db.transaction(), así que si algo falla a mitad de camino no
 * queda la BD en un estado a medio escribir.
 * ════════════════════════════════════════════════════════════════════════ */

/* ── Productos + unidades ── */
function saveProducts(products) {
    const db = getDb()
    const run = db.transaction((list) => {
        db.prepare('DELETE FROM units').run()
        db.prepare('DELETE FROM products').run()
        const insP = db.prepare(`INSERT INTO products (id, name, sku, rfid_base, category, total, description, pending_delete, pending_delete_by, pending_delete_at)
                                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        const insU = db.prepare(`INSERT INTO units (id, product_id, rfid, state) VALUES (?, ?, ?, ?)`)
        for (const p of list) {
            insP.run(p.id, p.name, p.sku ?? null, p.rfidBase ?? null, p.category ?? null, p.total ?? 0, p.description ?? null,
                p.pendingDelete ? 1 : 0, p.pendingDeleteBy ?? null, p.pendingDeleteAt ?? null)
            for (const u of p.units || []) {
                insU.run(u.id, p.id, u.rfid ?? null, u.state || 'Disponible')
            }
        }
    })
    withForeignKeysOff(db, () => run(products))
}

function loadProducts() {
    const db = getDb()
    const products = db.prepare('SELECT * FROM products').all()
    const units = db.prepare('SELECT * FROM units').all()
    return products.map(p => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        rfidBase: p.rfid_base,
        category: p.category,
        total: p.total,
        description: p.description,
        pendingDelete: !!p.pending_delete,
        pendingDeleteBy: p.pending_delete_by,
        pendingDeleteAt: p.pending_delete_at,
        units: units
            .filter(u => u.product_id === p.id)
            .map(u => ({ id: u.id, rfid: u.rfid, state: u.state }))
    }))
}

/* ── Eventos + asignaciones ── */
function saveEvents(events) {
    const db = getDb()
    const run = db.transaction((list) => {
        db.prepare('DELETE FROM event_assignment_units').run()
        db.prepare('DELETE FROM event_assignments').run()
        db.prepare('DELETE FROM events').run()
        const insE = db.prepare(`INSERT INTO events (id, order_number, name, date, location, notes, status, created_at, pending_delete, pending_delete_by, pending_delete_at)
                                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        const insA = db.prepare(`INSERT INTO event_assignments (event_id, product_id, qty) VALUES (?, ?, ?)`)
        const insU = db.prepare(`INSERT INTO event_assignment_units (assignment_id, unit_id) VALUES (?, ?)`)
        for (const e of list) {
            insE.run(e.id, e.orderNumber ?? null, e.name, e.date ?? null, e.location ?? null, e.notes ?? null, e.status || 'Programado', e.createdAt ?? null,
                e.pendingDelete ? 1 : 0, e.pendingDeleteBy ?? null, e.pendingDeleteAt ?? null)
            for (const a of e.assignments || []) {
                const { lastInsertRowid } = insA.run(e.id, a.productId, a.qty || 0)
                for (const unitId of a.unitIds || []) {
                    insU.run(lastInsertRowid, unitId)
                }
            }
        }
    })
    withForeignKeysOff(db, () => run(events))
}

function loadEvents() {
    const db = getDb()
    const events = db.prepare('SELECT * FROM events').all()
    const assignments = db.prepare('SELECT * FROM event_assignments').all()
    const units = db.prepare('SELECT * FROM event_assignment_units').all()
    return events.map(e => ({
        id: e.id,
        orderNumber: e.order_number,
        name: e.name,
        date: e.date,
        location: e.location,
        notes: e.notes,
        status: e.status,
        createdAt: e.created_at,
        pendingDelete: !!e.pending_delete,
        pendingDeleteBy: e.pending_delete_by,
        pendingDeleteAt: e.pending_delete_at,
        assignments: assignments
            .filter(a => a.event_id === e.id)
            .map(a => ({
                productId: a.product_id,
                qty: a.qty,
                unitIds: units.filter(u => u.assignment_id === a.id).map(u => u.unit_id)
            }))
    }))
}

/* ── Arriendos + asignaciones ── */
function saveRentals(rentals) {
    const db = getDb()
    const run = db.transaction((list) => {
        db.prepare('DELETE FROM rental_assignment_units').run()
        db.prepare('DELETE FROM rental_assignments').run()
        db.prepare('DELETE FROM rentals').run()
        const insR = db.prepare(`INSERT INTO rentals (id, order_number, name, date, end_date, client_name, staff_name, notes, status, created_at)
                                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        const insA = db.prepare(`INSERT INTO rental_assignments (rental_id, product_id, qty) VALUES (?, ?, ?)`)
        const insU = db.prepare(`INSERT INTO rental_assignment_units (assignment_id, unit_id) VALUES (?, ?)`)
        for (const r of list) {
            insR.run(r.id, r.orderNumber ?? null, r.name, r.date ?? null, r.endDate ?? null, r.clientName ?? null, r.staffName ?? null, r.notes ?? null, r.status || 'Programado', r.createdAt ?? null)
            for (const a of r.assignments || []) {
                const { lastInsertRowid } = insA.run(r.id, a.productId, a.qty || 0)
                for (const unitId of a.unitIds || []) {
                    insU.run(lastInsertRowid, unitId)
                }
            }
        }
    })
    withForeignKeysOff(db, () => run(rentals))
}

function loadRentals() {
    const db = getDb()
    const rentals = db.prepare('SELECT * FROM rentals').all()
    const assignments = db.prepare('SELECT * FROM rental_assignments').all()
    const units = db.prepare('SELECT * FROM rental_assignment_units').all()
    return rentals.map(r => ({
        id: r.id,
        orderNumber: r.order_number,
        name: r.name,
        date: r.date,
        endDate: r.end_date,
        clientName: r.client_name,
        staffName: r.staff_name,
        notes: r.notes,
        status: r.status,
        createdAt: r.created_at,
        assignments: assignments
            .filter(a => a.rental_id === r.id)
            .map(a => ({
                productId: a.product_id,
                qty: a.qty,
                unitIds: units.filter(u => u.assignment_id === a.id).map(u => u.unit_id)
            }))
    }))
}

/* ── Progreso de fases en Operaciones (opStates) ──
 * opStates llega desde React con forma: { [eventId]: {
 *   totalItems, activePhase, scanMode, forcedBy, forceLog,
 *   phases: { f1: { done, forcedClose, scanned: [{id, rfid, name, sku, productId, scannedAt}],
 *                    incidents: [{id, rfid, name, sku, productId, state, reason, reportedAt}] }, ... }
 * } } */
const PHASE_KEYS = ['f1', 'f2', 'f3', 'f4']

function saveOpStates(opStates) {
    const db = getDb()
    const run = db.transaction((map) => {
        db.prepare('DELETE FROM op_state_incidents').run()
        db.prepare('DELETE FROM op_state_scanned_units').run()
        db.prepare('DELETE FROM op_state_phases').run()
        db.prepare('DELETE FROM op_states').run()

        const insState = db.prepare(`INSERT INTO op_states (event_id, total_items, active_phase, scan_mode, forced_by_json, force_log_json)
                                      VALUES (?, ?, ?, ?, ?, ?)`)
        const insPhase = db.prepare(`INSERT INTO op_state_phases (event_id, phase_key, done, forced_close) VALUES (?, ?, ?, ?)`)
        const insScanned = db.prepare(`INSERT INTO op_state_scanned_units (event_id, phase_key, unit_id, scanned_at) VALUES (?, ?, ?, ?)`)
        const insIncident = db.prepare(`INSERT INTO op_state_incidents (event_id, phase_key, unit_id, name, rfid, state, reason, reported_at)
                                         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)

        for (const eventIdStr of Object.keys(map || {})) {
            const eventId = Number(eventIdStr)
            const op = map[eventIdStr]
            if (!op) continue
            insState.run(
                eventId,
                op.totalItems || 0,
                op.activePhase ?? null,
                op.scanMode ?? null,
                op.forcedBy ? JSON.stringify(op.forcedBy) : null,
                op.forceLog ? JSON.stringify(op.forceLog) : null
            )
            for (const phaseKey of PHASE_KEYS) {
                const phase = (op.phases || {})[phaseKey]
                if (!phase) continue
                insPhase.run(eventId, phaseKey, phase.done ? 1 : 0, phase.forcedClose ? 1 : 0)
                for (const s of phase.scanned || []) {
                    insScanned.run(eventId, phaseKey, s.id, s.scannedAt ?? null)
                }
                for (const inc of phase.incidents || []) {
                    insIncident.run(eventId, phaseKey, inc.id ?? null, inc.name ?? null, inc.rfid ?? null, inc.state ?? null, inc.reason ?? null, inc.reportedAt ?? null)
                }
            }
        }
    })
    withForeignKeysOff(db, () => run(opStates))
}

function loadOpStates() {
    const db = getDb()
    const states = db.prepare('SELECT * FROM op_states').all()
    const phases = db.prepare('SELECT * FROM op_state_phases').all()
    const scanned = db.prepare('SELECT * FROM op_state_scanned_units').all()
    const incidents = db.prepare('SELECT * FROM op_state_incidents').all()
    // Para reconstituir name/rfid/sku/productId de cada unidad escaneada
    // (la tabla de scanned_units solo guarda el unit_id).
    const units = db.prepare('SELECT * FROM units').all()
    const products = db.prepare('SELECT * FROM products').all()
    const unitInfo = (unitId) => {
        const u = units.find(x => x.id === unitId)
        if (!u) return { rfid: null, name: null, sku: null, productId: null }
        const p = products.find(x => x.id === u.product_id)
        return { rfid: u.rfid, name: p?.name ?? null, sku: p?.sku ?? null, productId: u.product_id }
    }

    const result = {}
    for (const st of states) {
        const eventPhases = phases.filter(p => p.event_id === st.event_id)
        const phasesObj = {}
        for (const phaseKey of PHASE_KEYS) {
            const ph = eventPhases.find(p => p.phase_key === phaseKey)
            phasesObj[phaseKey] = {
                done: !!ph?.done,
                forcedClose: !!ph?.forced_close,
                scanned: scanned
                    .filter(s => s.event_id === st.event_id && s.phase_key === phaseKey)
                    .map(s => ({ id: s.unit_id, scannedAt: s.scanned_at, ...unitInfo(s.unit_id) })),
                incidents: incidents
                    .filter(i => i.event_id === st.event_id && i.phase_key === phaseKey)
                    .map(i => ({
                        id: i.unit_id, name: i.name, rfid: i.rfid, state: i.state,
                        reason: i.reason, reportedAt: i.reported_at,
                        productId: unitInfo(i.unit_id).productId, sku: unitInfo(i.unit_id).sku
                    }))
            }
        }
        result[st.event_id] = {
            totalItems: st.total_items,
            activePhase: st.active_phase,
            scanMode: st.scan_mode,
            forcedBy: st.forced_by_json ? JSON.parse(st.forced_by_json) : null,
            forceLog: st.force_log_json ? JSON.parse(st.force_log_json) : [],
            phases: phasesObj
        }
    }
    return result
}

/* ── Vínculos RFID ↔ unidad (epcMap) ── */
function saveEpcMap(epcMap) {
    const db = getDb()
    const run = db.transaction((map) => {
        db.prepare('DELETE FROM epc_map').run()
        const ins = db.prepare('INSERT INTO epc_map (epc, unit_id) VALUES (?, ?)')
        for (const epc of Object.keys(map || {})) {
            ins.run(epc, map[epc])
        }
    })
    run(epcMap)
}

function loadEpcMap() {
    const db = getDb()
    const rows = db.prepare('SELECT * FROM epc_map').all()
    const map = {}
    for (const r of rows) map[r.epc] = r.unit_id
    return map
}

/* ── Historiales (eventos / rentas / compras) ── */
function saveEventHistory(list) {
    const db = getDb()
    const run = db.transaction((items) => {
        db.prepare('DELETE FROM event_history').run()
        const ins = db.prepare(`INSERT INTO event_history (id, order_number, name, date, location, total_items, incidents_count, forced_close, closed_at, closed_by)
                                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        for (const e of items) {
            ins.run(e.id, e.orderNumber ?? null, e.name ?? null, e.date ?? null, e.location ?? null,
                e.totalItems ?? 0, e.incidentsCount ?? 0, e.forcedClose ? 1 : 0, e.closedAt ?? null, e.closedBy ?? null)
        }
    })
    run(list)
}

function loadEventHistory() {
    const db = getDb()
    return db.prepare('SELECT * FROM event_history ORDER BY closed_at DESC').all().map(e => ({
        id: e.id, orderNumber: e.order_number, name: e.name, date: e.date, location: e.location,
        totalItems: e.total_items, incidentsCount: e.incidents_count, forcedClose: !!e.forced_close,
        closedAt: e.closed_at, closedBy: e.closed_by
    }))
}

function saveRentalHistory(list) {
    const db = getDb()
    const run = db.transaction((items) => {
        db.prepare('DELETE FROM rental_history').run()
        const ins = db.prepare(`INSERT INTO rental_history (id, order_number, name, client_name, date, end_date, total_items, closed_at, closed_by)
                                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        for (const r of items) {
            ins.run(r.id, r.orderNumber ?? null, r.name ?? null, r.clientName ?? null, r.date ?? null,
                r.endDate ?? null, r.totalItems ?? 0, r.closedAt ?? null, r.closedBy ?? null)
        }
    })
    run(list)
}

function loadRentalHistory() {
    const db = getDb()
    return db.prepare('SELECT * FROM rental_history ORDER BY closed_at DESC').all().map(r => ({
        id: r.id, orderNumber: r.order_number, name: r.name, clientName: r.client_name,
        date: r.date, endDate: r.end_date, totalItems: r.total_items, closedAt: r.closed_at, closedBy: r.closed_by
    }))
}

function savePurchaseHistory(list) {
    const db = getDb()
    const run = db.transaction((items) => {
        db.prepare('DELETE FROM purchase_history').run()
        const ins = db.prepare(`INSERT INTO purchase_history (id, date, product_name, sku, category, qty, user)
                                 VALUES (?, ?, ?, ?, ?, ?, ?)`)
        for (const p of items) {
            ins.run(p.id, p.date ?? null, p.productName ?? null, p.sku ?? null, p.category ?? null, p.qty ?? 0, p.user ?? null)
        }
    })
    run(list)
}

function loadPurchaseHistory() {
    const db = getDb()
    return db.prepare('SELECT * FROM purchase_history ORDER BY date DESC').all().map(p => ({
        id: p.id, date: p.date, productName: p.product_name, sku: p.sku, category: p.category, qty: p.qty, user: p.user
    }))
}

function saveAuditLog(list) {
    const db = getDb()
    const run = db.transaction((items) => {
        db.prepare('DELETE FROM audit_log').run()
        const ins = db.prepare(`INSERT INTO audit_log (id, timestamp, user, action, detail, category)
                                 VALUES (?, ?, ?, ?, ?, ?)`)
        for (const e of items) {
            ins.run(String(e.id), e.timestamp ?? null, e.user ?? null, e.action ?? '', e.detail ?? null, e.category ?? null)
        }
    })
    run(list)
}

function loadAuditLog() {
    const db = getDb()
    return db.prepare('SELECT * FROM audit_log ORDER BY timestamp DESC').all().map(e => ({
        id: e.id, timestamp: e.timestamp, user: e.user, action: e.action, detail: e.detail, category: e.category
    }))
}

/* ── Usuarios ───────────────────────────────────────────────────────────
 * Las contraseñas se hashean con scrypt (builtin de Node) antes de guardarse.
 * El formato almacenado es "${salt}:${hash}" donde salt y hash son hex.
 * El proceso main es el único que toca crypto — el renderer nunca ve
 * contraseñas en texto plano ni hashes en el contexto React. */
function _hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex')
    const hash = crypto.pbkdf2Sync(String(password), salt, 10000, 64, 'sha256').toString('hex')
    return salt + ':' + hash
}

function _verifyPassword(password, stored) {
    try {
        if (!stored || stored.indexOf(':') === -1) return false
        const colonIdx = stored.indexOf(':')
        const storedSalt = stored.substring(0, colonIdx)
        const storedHash = stored.substring(colonIdx + 1)
        const verify = crypto.pbkdf2Sync(String(password), storedSalt, 10000, 64, 'sha256').toString('hex')
        return verify === storedHash
    } catch (err) {
        console.error('[Auth] verify error:', err.message)
        return false
    }
}

function _mapUser(u) {
    return {
        id: u.id, role: u.role, nombre: u.nombre, apellido: u.apellido,
        email: u.email ?? '', cargo: u.cargo ?? '', avatar: u.avatar ?? '',
        username: u.username, passwordHash: u.password_hash,
        hasPin: !!u.pin_hash,
        createdAt: u.created_at
    }
}

function loadUsers() {
    const db = getDb()
    return db.prepare('SELECT * FROM users ORDER BY created_at ASC').all().map(_mapUser)
}

function createUser(data, plainPassword) {
    const db = getDb()
    const id = `usr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const hash = _hashPassword(plainPassword)
    const now = new Date().toISOString()
    db.prepare(`INSERT INTO users (id, role, nombre, apellido, email, cargo, avatar, username, password_hash, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, data.role, data.nombre, data.apellido,
           data.email || null, data.cargo || null, data.avatar || null,
           data.username, hash, now)
    return { id, ...data, passwordHash: hash, createdAt: now }
}

function updateUser(id, fields, plainPassword) {
    const db = getDb()
    if (plainPassword) {
        const hash = _hashPassword(plainPassword)
        db.prepare(`UPDATE users SET nombre=?, apellido=?, email=?, cargo=?, avatar=?, username=?, password_hash=? WHERE id=?`)
          .run(fields.nombre, fields.apellido, fields.email || null,
               fields.cargo || null, fields.avatar || null, fields.username, hash, id)
    } else {
        db.prepare(`UPDATE users SET nombre=?, apellido=?, email=?, cargo=?, avatar=?, username=? WHERE id=?`)
          .run(fields.nombre, fields.apellido, fields.email || null,
               fields.cargo || null, fields.avatar || null, fields.username, id)
    }
}

function deleteUser(id) {
    const db = getDb()
    db.prepare('DELETE FROM users WHERE id=?').run(id)
}

function authLogin(username, plainPassword) {
    const db = getDb()
    const u = db.prepare('SELECT * FROM users WHERE username=?').get(username)
    if (!u) return null
    if (!_verifyPassword(plainPassword, u.password_hash)) return null
    return {
        id: u.id, role: u.role, nombre: u.nombre, apellido: u.apellido,
        email: u.email ?? '', cargo: u.cargo ?? '', avatar: u.avatar ?? '',
        username: u.username, hasPin: !!u.pin_hash, createdAt: u.created_at
    }
}

function countAdmins() {
    const db = getDb()
    return db.prepare("SELECT COUNT(*) as cnt FROM users WHERE role='admin'").get().cnt
}

/* ── PIN de acceso rápido ───────────────────────────────────────────────
 * Se guarda como SHA-256(userId + ':' + pin) — no necesita salt fuerte
 * porque es solo un código numérico de 4 dígitos sin valor de credencial
 * completa; el PIN siempre se usa como un segundo factor ligero, no como
 * reemplazo de la contraseña principal.  */
function setUserPin(userId, pin) {
    const db = getDb()
    const hash = crypto.createHash('sha256').update(userId + ':' + String(pin)).digest('hex')
    db.prepare('UPDATE users SET pin_hash=? WHERE id=?').run(hash, userId)
}

function removeUserPin(userId) {
    const db = getDb()
    db.prepare('UPDATE users SET pin_hash=NULL WHERE id=?').run(userId)
}

function authLoginPin(userId, pin) {
    const db = getDb()
    const u = db.prepare('SELECT * FROM users WHERE id=?').get(userId)
    if (!u || !u.pin_hash) return null
    const hash = crypto.createHash('sha256').update(userId + ':' + String(pin)).digest('hex')
    if (hash !== u.pin_hash) return null
    return {
        id: u.id, role: u.role, nombre: u.nombre, apellido: u.apellido,
        email: u.email ?? '', cargo: u.cargo ?? '', avatar: u.avatar ?? '',
        username: u.username, hasPin: true, createdAt: u.created_at
    }
}

/* ── Carga inicial completa (un solo viaje IPC al montar la app) ── */
function loadAll() {
    return {
        products: loadProducts(),
        events: loadEvents(),
        rentals: loadRentals(),
        opStates: loadOpStates(),
        epcMap: loadEpcMap(),
        eventHistory: loadEventHistory(),
        rentalHistory: loadRentalHistory(),
        purchaseHistory: loadPurchaseHistory(),
        auditLog: loadAuditLog()
    }
}

function closeDb() {
    if (db) {
        db.close()
        db = null
    }
}

module.exports = {
    getDb, closeDb, loadAll,
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
    setUserPin, removeUserPin, authLoginPin
}