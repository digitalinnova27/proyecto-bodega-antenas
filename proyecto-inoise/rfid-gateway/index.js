/**
 * rfid-gateway/index.js
 *
 * Antes este código vivía dentro de Electron (server/rfid-bridge.js),
 * cargado con require() en electron/main.js — lo que significaba que las
 * antenas dejaban de leerse apenas alguien cerraba la ventana de la app.
 * Ahora es un servicio Node independiente, pensado para instalarse como
 * servicio de Windows (ver INSTALL.md) en la PC donde están físicamente
 * conectadas las antenas: arranca solo con el equipo y sigue leyendo RFID
 * aunque nadie tenga Orbitag abierto.
 *
 * Mantiene exactamente el mismo contrato local que ya conoce el frontend
 * (frontend/src/hooks/useRfidSocket.js, RfidRegistrar.jsx, Antennas.jsx):
 *   - UDP :6001  → paquetes crudos de las antenas
 *   - WS  :3001  → stream en vivo (rfid_scan, rfid_unknown, antennas_status, ...)
 *   - HTTP:3002  → vincular/desvincular EPC↔unidad, estadísticas, antenas
 * Todo eso sigue siendo 100% local — por diseño, ya que las antenas están
 * cableadas a esta PC y nada de esto necesita salir a Internet para que la
 * app de ESTA PC funcione.
 *
 * Lo nuevo es la conexión saliente hacia el backend en la nube (ver
 * cloud-backend/src/index.js, evento 'gateway:event'): reenvía los mismos
 * eventos en vivo para que otras PCs conectadas a Orbitag también los vean
 * en tiempo real. Si no hay CLOUD_URL/GATEWAY_TOKEN configurados, o se
 * corta Internet, el gateway sigue funcionando igual en modo local — el
 * reenvío es un extra, nunca un requisito para leer RFID en esta PC.
 */

require('dotenv').config()

const dgram = require('dgram')
const { WebSocketServer } = require('ws')
const http = require('http')
const fs = require('fs')
const path = require('path')
const { io: ioClient } = require('socket.io-client')

const UDP_PORT = 6001
const WS_PORT = 3001
const HTTP_PORT = 3002

const EPC_MAP_PATH = path.join(__dirname, 'epcMap.json')

// Tiempo mínimo entre lecturas del mismo tag (ms)
const DEDUP_MS = 3000

let epcMap = {}
let lastSeen = {} // epc → timestamp última vez procesado

const loadMap = () => {
    try {
        epcMap = JSON.parse(fs.readFileSync(EPC_MAP_PATH, 'utf8'))
        console.log(`[Gateway] epcMap cargado: ${Object.keys(epcMap).length} entradas`)
    } catch (e) {
        console.warn('[Gateway] epcMap.json vacío, iniciando limpio')
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
 * Ver explicación completa en el rfid-bridge.js original — se conserva
 * igual: cada IP que manda un paquete UDP válido queda registrada sola, y
 * una vez detectada nunca vuelve a "Offline", solo alterna entre
 * "Activa" (leyendo ahora) y "En espera" (sin tag en el campo). */
const ACTIVE_TIMEOUT_MS = 15000

let antennas = {} // ip → { id, ip, firstSeenAt, lastSeenAt, totalScans, uniqueTags:Set, lastSignal, scanHistory:[] }

function getOrCreateAntenna(ip) {
    if (!antennas[ip]) {
        antennas[ip] = {
            id: ip, ip,
            firstSeenAt: new Date().toISOString(),
            lastSeenAt: null, totalScans: 0,
            uniqueTags: new Set(), lastSignal: null, scanHistory: []
        }
    }
    return antennas[ip]
}

function serializeAntennas() {
    const now = Date.now()
    return Object.values(antennas)
        .map(a => {
            const msSinceLastRead = a.lastSeenAt ? now - new Date(a.lastSeenAt).getTime() : null
            const status = msSinceLastRead !== null && msSinceLastRead < ACTIVE_TIMEOUT_MS ? 'active' : 'idle'
            return {
                id: a.id, ip: a.ip,
                active: status === 'active',
                status,
                firstSeenAt: a.firstSeenAt, lastSeenAt: a.lastSeenAt,
                totalScans: a.totalScans, uniqueTags: a.uniqueTags.size,
                lastSignal: a.lastSignal, recentScans: a.scanHistory.slice(0, 10)
            }
        })
        .sort((a, b) => new Date(a.firstSeenAt) - new Date(b.firstSeenAt))
}

// ── Reenvío al backend en la nube ──────────────────────────────────────────
const CLOUD_URL = process.env.CLOUD_URL || null
const GATEWAY_TOKEN = process.env.GATEWAY_TOKEN || null
const QUEUE_PATH = path.join(__dirname, 'queue.ndjson')

// Buffer acotado para no perder eventos si se corta Internet en el sitio.
// Son notificaciones de actividad EN VIVO (la fuente de verdad del
// inventario/EPC se guarda aparte, vía la API normal del frontend) — por
// eso no tiene sentido reintentar para siempre: se descartan los eventos
// más viejos que MAX_QUEUE_AGE_MS, o los que sobren de MAX_QUEUE_SIZE.
const MAX_QUEUE_SIZE = 2000
const MAX_QUEUE_AGE_MS = 30 * 60 * 1000 // 30 minutos

let pendingQueue = []
let cloudSocket = null
let cloudAuthenticated = false

function loadQueue() {
    try {
        pendingQueue = fs.readFileSync(QUEUE_PATH, 'utf8')
            .split('\n').filter(Boolean).map(l => JSON.parse(l))
        if (pendingQueue.length) console.log(`[Gateway] Cola recuperada: ${pendingQueue.length} evento(s) pendientes de reenvío`)
    } catch { pendingQueue = [] }
}
function persistQueue() {
    try {
        const body = pendingQueue.map(e => JSON.stringify(e)).join('\n')
        fs.writeFileSync(QUEUE_PATH, body ? body + '\n' : '', 'utf8')
    } catch { }
}

function enqueue(type, payload) {
    pendingQueue.push({ type, payload, at: Date.now() })
    if (pendingQueue.length > MAX_QUEUE_SIZE) pendingQueue.splice(0, pendingQueue.length - MAX_QUEUE_SIZE)
    persistQueue()
}

function flushQueue() {
    if (!pendingQueue.length || !cloudAuthenticated) return
    const now = Date.now()
    const fresh = pendingQueue.filter(e => (now - e.at) <= MAX_QUEUE_AGE_MS)
    const dropped = pendingQueue.length - fresh.length
    pendingQueue = []
    persistQueue()
    if (dropped) console.log(`[Gateway] ${dropped} evento(s) en cola descartados por antigüedad (>30 min desconectado)`)
    for (const e of fresh) cloudSocket.emit('gateway:event', { type: e.type, payload: e.payload })
    if (fresh.length) console.log(`[Gateway] Cola reenviada a la nube: ${fresh.length} evento(s)`)
}

function forwardToCloud(type, payload) {
    if (!CLOUD_URL || !GATEWAY_TOKEN) return
    if (cloudAuthenticated) cloudSocket.emit('gateway:event', { type, payload })
    else enqueue(type, payload)
}

if (CLOUD_URL && GATEWAY_TOKEN) {
    loadQueue()
    cloudSocket = ioClient(CLOUD_URL, { transports: ['websocket', 'polling'], reconnectionDelay: 2000 })

    cloudSocket.on('connect', () => {
        cloudSocket.emit('gateway:authenticate', { token: GATEWAY_TOKEN })
    })
    cloudSocket.on('gateway:authenticated', (ok) => {
        cloudAuthenticated = Boolean(ok)
        if (ok) {
            console.log('[Gateway] Conectado y autenticado contra el backend en la nube')
            flushQueue()
        } else {
            console.error('[Gateway] GATEWAY_TOKEN rechazado por el backend — revisar que coincida con la variable configurada en Railway')
        }
    })
    cloudSocket.on('disconnect', () => {
        cloudAuthenticated = false
        console.log('[Gateway] Desconectado del backend en la nube — encolando eventos localmente hasta reconectar')
    })
    cloudSocket.on('connect_error', (err) => {
        console.warn('[Gateway] Error de conexión a la nube:', err.message)
    })
} else {
    console.warn('[Gateway] CLOUD_URL/GATEWAY_TOKEN no configurados (ver .env.example) — el gateway funciona solo en modo local, sin reenviar nada a otras PCs')
}

// ── WebSocket local ──────────────────────────────────────────────────────────
const wss = new WebSocketServer({ port: WS_PORT })
const clients = new Set()
wss.on('connection', (ws) => {
    clients.add(ws)
    console.log(`[WS] Cliente conectado. Total: ${clients.size}`)
    ws.send(JSON.stringify({ type: 'connected', msg: 'Orbitag RFID Gateway v1.0' }))
    ws.on('close', () => { clients.delete(ws) })
})
const broadcast = (payload) => {
    const msg = JSON.stringify(payload)
    clients.forEach(ws => { if (ws.readyState === 1) ws.send(msg) })
    forwardToCloud(payload.type, payload)
}

// ── HTTP API local ────────────────────────────────────────────────────────────
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

        const now = Date.now()
        if (lastSeen[epc] && (now - lastSeen[epc]) < DEDUP_MS) return
        lastSeen[epc] = now

        if (Object.keys(lastSeen).length > 500) {
            for (const key of Object.keys(lastSeen)) {
                if ((now - lastSeen[key]) >= DEDUP_MS) delete lastSeen[key]
            }
        }

        let rssi = null
        if (parts.length >= 3) {
            const maybeRssi = parseFloat(parts[parts.length - 2])
            if (!isNaN(maybeRssi) && maybeRssi < 0) rssi = maybeRssi
        }

        const scanTime = new Date().toISOString()

        tagStats.totalScans++
        tagStats.uniqueTags.add(epc)
        tagStats.lastSignal = rssi
        tagStats.lastScanTime = scanTime
        tagStats.scanHistory.unshift({ epc, rssi, at: scanTime })
        if (tagStats.scanHistory.length > 100) tagStats.scanHistory.pop()

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
console.log(`║   Orbitag RFID Gateway v1.0           ║`)
console.log(`║   UDP  → puerto ${UDP_PORT}               ║`)
console.log(`║   WS   → ws://localhost:${WS_PORT}      ║`)
console.log(`║   HTTP → http://localhost:${HTTP_PORT}    ║`)
console.log(`║   Nube → ${CLOUD_URL ? 'configurada' : 'desactivada'}${' '.repeat(Math.max(0, 15 - (CLOUD_URL ? 'configurada' : 'desactivada').length))}║`)
console.log(`╚══════════════════════════════════════╝\n`)
