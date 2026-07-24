const dgram = require('dgram')
const { WebSocketServer } = require('ws')
const http = require('http')
const fs = require('fs')
const path = require('path')

const UDP_PORT = 6001
const WS_PORT = 3001
const HTTP_PORT = 3002

/* ── Dónde guardar epcMap.json ──
 * Si este archivo corre DENTRO de Electron (caso normal, vía require() en
 * electron/main.js), guardamos epcMap.json en app.getPath('userData') —
 * la misma carpeta segura donde vive inoise.db, que el instalador NUNCA
 * borra ni sobreescribe entre versiones. Esto es necesario porque una vez
 * empaquetado en el .exe, la carpeta del propio script (__dirname) queda
 * adentro de app.asar, que es de SOLO LECTURA — escribir ahí fallaría en
 * silencio y los vínculos sticker↔producto nuevos no se guardarían nunca.
 *
 * Si en cambio este archivo corre suelto, fuera de Electron (ej. `node
 * server/rfid-bridge.js` para pruebas manuales), no hay app.getPath
 * disponible, así que se mantiene el comportamiento de siempre: guardar
 * junto al script. */
let epcMapDir = __dirname
try {
    if (process.versions && process.versions.electron) {
        const { app } = require('electron')
        epcMapDir = app.getPath('userData')
    }
} catch (e) {
    // No estamos en un contexto de Electron utilizable; seguimos con __dirname.
}
const EPC_MAP_PATH = path.join(epcMapDir, 'epcMap.json')

/* ── Migración única: epcMap.json viejo (junto al script) → carpeta nueva ──
 * Este proyecto venía guardando epcMap.json junto a rfid-bridge.js. Como
 * acabamos de mover la ubicación a userData, sin esto los vínculos
 * sticker↔producto que ya existían (de antes de este cambio) se verían
 * "perdidos" la primera vez que se abra la app con esta versión nueva —
 * no es que se borren, es que el bridge ahora mira en otro lado. Si el
 * archivo nuevo todavía no existe pero el viejo sí, lo copiamos una sola
 * vez. Después de eso, el viejo se ignora por completo. */
const LEGACY_EPC_MAP_PATH = path.join(__dirname, 'epcMap.json')
try {
    if (EPC_MAP_PATH !== LEGACY_EPC_MAP_PATH &&
        !fs.existsSync(EPC_MAP_PATH) &&
        fs.existsSync(LEGACY_EPC_MAP_PATH)) {
        fs.copyFileSync(LEGACY_EPC_MAP_PATH, EPC_MAP_PATH)
        console.log('[Bridge] epcMap.json migrado a la carpeta de datos de usuario')
    }
} catch (e) {
    // Si la migración falla (ej. __dirname de solo lectura sin archivo viejo
    // real), no es grave: loadMap() de abajo simplemente arranca limpio.
}

// Tiempo mínimo entre lecturas del mismo tag (ms)
// Si el mismo EPC llega antes de este tiempo, se ignora
const DEDUP_MS = 3000  // 3 segundos

let epcMap = {}
let lastSeen = {} // epc → timestamp última vez procesado

const loadMap = () => {
    try {
        epcMap = JSON.parse(fs.readFileSync(EPC_MAP_PATH, 'utf8'))
        console.log(`[Bridge] epcMap cargado: ${Object.keys(epcMap).length} entradas`)
    } catch (e) {
        console.warn('[Bridge] epcMap.json vacío, iniciando limpio')
        epcMap = {}
    }
}
const saveMap = () => {
    try { fs.writeFileSync(EPC_MAP_PATH, JSON.stringify(epcMap, null, 2), 'utf8') } catch (e) { }
}
loadMap()
setInterval(loadMap, 30000)

let tagStats = {
    totalScans: 0,
    uniqueTags: new Set(),
    lastSignal: null,
    lastScanTime: null,
    scanHistory: []
}

/* ── Antenas: detección dinámica, sin límite ────────────────────────────
 * El protocolo UDP de las antenas no manda un "ID de antena" en el propio
 * paquete, pero sí llega acompañado de la dirección IP de origen (rinfo,
 * que el handler de dgram ignoraba hasta ahora). Usamos esa IP como
 * identificador natural de cada lector físico: no hace falta configurar
 * cuántas antenas hay ni sus nombres — cualquier IP que mande un paquete
 * válido queda registrada sola, así que conectar una 4ª, 5ª u 8ª antena al
 * switch simplemente hace que aparezca en la lista sin tocar código.
 *
 * Estas antenas SOLO mandan un paquete UDP cuando hay un tag físico en su
 * campo de lectura — no existe un "heartbeat" separado sin tag presente.
 * Eso significa que, si nadie está pasando stickers en este momento, es
 * NORMAL que no llegue ningún paquete durante varios segundos aunque la
 * antena esté perfectamente conectada. No hay forma de distinguir eso de
 * una desconexión real solo con este protocolo, así que UNA VEZ que una
 * antena mandó su primer paquete queda registrada de forma FIJA en la
 * lista — nunca vuelve a "Offline". Solo alterna entre:
 *   - ACTIVE_TIMEOUT_MS: dentro de este tiempo desde la última lectura →
 *     "Activa" (leyendo ahora mismo).
 *   - Fuera de ese tiempo → "En espera" (sin ningún tag en el campo ahora,
 *     pero la antena sigue ahí, solo esperando el próximo sticker). */
const ACTIVE_TIMEOUT_MS = 15000

let antennas = {} // ip → { id, ip, firstSeenAt, lastSeenAt, totalScans, uniqueTags:Set, lastSignal, scanHistory:[] }

function getOrCreateAntenna(ip) {
    if (!antennas[ip]) {
        antennas[ip] = {
            id: ip,
            ip,
            firstSeenAt: new Date().toISOString(),
            lastSeenAt: null,
            totalScans: 0,
            uniqueTags: new Set(),
            lastSignal: null,
            scanHistory: []
        }
    }
    return antennas[ip]
}

function serializeAntennas() {
    const now = Date.now()
    return Object.values(antennas)
        .map(a => {
            const msSinceLastRead = a.lastSeenAt ? now - new Date(a.lastSeenAt).getTime() : null
            // Una antena que ya mandó al menos un paquete queda fija en la
            // lista para siempre — solo alterna entre 'active' (leyendo
            // ahora) e 'idle' (en espera del próximo sticker). Nunca vuelve
            // a 'offline' una vez detectada.
            const status = msSinceLastRead !== null && msSinceLastRead < ACTIVE_TIMEOUT_MS
                ? 'active'
                : 'idle'
            return {
                id: a.id,
                ip: a.ip,
                active: status === 'active', // se mantiene por compatibilidad con el front-end existente
                status,
                firstSeenAt: a.firstSeenAt,
                lastSeenAt: a.lastSeenAt,
                totalScans: a.totalScans,
                uniqueTags: a.uniqueTags.size,
                lastSignal: a.lastSignal,
                recentScans: a.scanHistory.slice(0, 10)
            }
        })
        // Más antigua conectada primero, para que el orden en pantalla no
        // salte cada vez que una antena manda un paquete.
        .sort((a, b) => new Date(a.firstSeenAt) - new Date(b.firstSeenAt))
}

// ── WebSocket ─────────────────────────────────────────────────────────────────
const wss = new WebSocketServer({ port: WS_PORT })
const clients = new Set()
wss.on('connection', (ws) => {
    clients.add(ws)
    console.log(`[WS] Cliente conectado. Total: ${clients.size}`)
    ws.send(JSON.stringify({ type: 'connected', msg: 'iNOISE RFID Bridge v2.0' }))
    ws.on('close', () => { clients.delete(ws) })
})
const broadcast = (payload) => {
    const msg = JSON.stringify(payload)
    clients.forEach(ws => { if (ws.readyState === 1) ws.send(msg) })
}

// ── HTTP API ──────────────────────────────────────────────────────────────────
const httpServer = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }

    if (req.method === 'POST' && req.url === '/api/epcmap') {
        let body = ''
        req.on('data', chunk => body += chunk)
        req.on('end', () => {
            try {
                const { epc, unitId } = JSON.parse(body)
                if (!epc || !unitId) { res.writeHead(400); res.end('{"error":"epc y unitId requeridos"}'); return }
                epcMap[epc] = unitId
                saveMap()
                console.log(`[HTTP] Vinculado: ${epc} → ${unitId}`)
                broadcast({ type: 'epc_linked', epc, unitId })
                res.writeHead(200, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ ok: true, epc, unitId }))
            } catch (e) { res.writeHead(400); res.end('{"error":"JSON inválido"}') }
        })
        return
    }

    if (req.method === 'DELETE' && req.url.startsWith('/api/epcmap/')) {
        const epc = decodeURIComponent(req.url.replace('/api/epcmap/', ''))
        delete epcMap[epc]
        saveMap()
        broadcast({ type: 'epc_unlinked', epc })
        res.writeHead(200); res.end('{"ok":true}')
        return
    }

    if (req.method === 'GET' && req.url === '/api/epcmap') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(epcMap))
        return
    }

    if (req.method === 'GET' && req.url === '/api/stats') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
            totalScans: tagStats.totalScans,
            uniqueTags: tagStats.uniqueTags.size,
            lastSignal: tagStats.lastSignal,
            lastScanTime: tagStats.lastScanTime,
            recentScans: tagStats.scanHistory.slice(0, 10)
        }))
        return
    }

    // Lista dinámica de antenas detectadas (ver comentario junto a
    // getOrCreateAntenna más arriba) — sin límite fijo, tantas como IPs
    // distintas hayan mandado un paquete UDP válido.
    if (req.method === 'GET' && req.url === '/api/antennas') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ antennas: serializeAntennas() }))
        return
    }

    res.writeHead(404); res.end('Not found')
})
httpServer.listen(HTTP_PORT, () => console.log(`[HTTP] API en http://localhost:${HTTP_PORT}`))

// ── UDP ───────────────────────────────────────────────────────────────────────
const udpServer = dgram.createSocket('udp4')

udpServer.on('message', (buf, rinfo) => {
    try {
        const raw = buf.toString('utf8').trim().replace(/\0/g, '').replace(/\r?\n/g, '')
        const parts = raw.split(',')
        const epc = parts[parts.length - 1].trim()
        if (!epc || epc.length < 6) return

        // ── Deduplicación: ignorar mismo tag dentro de DEDUP_MS ──
        // (por EPC en general, no por antena — si dos antenas leen el mismo
        // tag casi al mismo tiempo, sigue contando como una sola lectura)
        const now = Date.now()
        if (lastSeen[epc] && (now - lastSeen[epc]) < DEDUP_MS) return
        lastSeen[epc] = now

        // Limpiar cache de lastSeen cada 60s para no crecer infinito
        if (Object.keys(lastSeen).length > 500) lastSeen = {}

        // Intentar extraer RSSI (viene como número negativo antes del EPC)
        let rssi = null
        if (parts.length >= 3) {
            const maybeRssi = parseFloat(parts[parts.length - 2])
            if (!isNaN(maybeRssi) && maybeRssi < 0) rssi = maybeRssi
        }

        const scanTime = new Date().toISOString()

        // Actualizar estadísticas globales (compat con /api/stats existente)
        tagStats.totalScans++
        tagStats.uniqueTags.add(epc)
        tagStats.lastSignal = rssi
        tagStats.lastScanTime = scanTime
        tagStats.scanHistory.unshift({ epc, rssi, at: scanTime })
        if (tagStats.scanHistory.length > 100) tagStats.scanHistory.pop()

        // Actualizar estadísticas de ESTA antena en particular, identificada
        // por su IP de origen (rinfo.address) — se crea sola la primera vez.
        const antennaIp = rinfo.address
        const ant = getOrCreateAntenna(antennaIp)
        ant.totalScans++
        ant.uniqueTags.add(epc)
        ant.lastSignal = rssi
        ant.lastSeenAt = scanTime
        ant.scanHistory.unshift({ epc, rssi, at: scanTime })
        if (ant.scanHistory.length > 100) ant.scanHistory.pop()

        const unitId = epcMap[epc]
        if (!unitId) {
            console.log(`[UDP] Desconocido: ${epc} (antena ${antennaIp})`)
            broadcast({ type: 'rfid_unknown', epc, rssi, antenna: antennaIp })
            broadcast({ type: 'antennas_status', antennas: serializeAntennas() })
            return
        }

        console.log(`[UDP] ${epc} → ${unitId}${rssi ? ' | RSSI: ' + rssi + ' dBm' : ''} | antena ${antennaIp}`)
        broadcast({
            type: 'rfid_scan', epc, sku: unitId, rssi, antenna: antennaIp,
            timestamp: scanTime,
            totalScans: tagStats.totalScans,
            uniqueCount: tagStats.uniqueTags.size
        })
        broadcast({ type: 'antennas_status', antennas: serializeAntennas() })

    } catch (err) {
        console.error('[UDP] Error:', err)
    }
})

// Empuje periódico del estado de las antenas — necesario para que una
// antena que se quedó callada pase a "offline" en pantalla sin esperar a
// que otra antena mande una lectura nueva (broadcast() de arriba solo se
// dispara cuando llega un paquete).
setInterval(() => {
    if (Object.keys(antennas).length > 0) {
        broadcast({ type: 'antennas_status', antennas: serializeAntennas() })
    }
}, 3000)

udpServer.on('listening', () => {
    console.log(`[UDP] Escuchando en puerto ${udpServer.address().port}`)
})
udpServer.bind(UDP_PORT)

console.log(`\n╔══════════════════════════════════════╗`)
console.log(`║   iNOISE RFID Bridge v2.0            ║`)
console.log(`║   UDP  → puerto ${UDP_PORT}               ║`)
console.log(`║   WS   → ws://localhost:${WS_PORT}      ║`)
console.log(`║   HTTP → http://localhost:${HTTP_PORT}    ║`)
console.log(`║   Dedup: ${DEDUP_MS}ms por tag          ║`)
console.log(`╚══════════════════════════════════════╝\n`)