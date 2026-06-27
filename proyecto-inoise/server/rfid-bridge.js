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

    res.writeHead(404); res.end('Not found')
})
httpServer.listen(HTTP_PORT, () => console.log(`[HTTP] API en http://localhost:${HTTP_PORT}`))

// ── UDP ───────────────────────────────────────────────────────────────────────
const udpServer = dgram.createSocket('udp4')

udpServer.on('message', (buf) => {
    try {
        const raw = buf.toString('utf8').trim().replace(/\0/g, '').replace(/\r?\n/g, '')
        const parts = raw.split(',')
        const epc = parts[parts.length - 1].trim()
        if (!epc || epc.length < 6) return

        // ── Deduplicación: ignorar mismo tag dentro de DEDUP_MS ──
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

        // Actualizar estadísticas
        tagStats.totalScans++
        tagStats.uniqueTags.add(epc)
        tagStats.lastSignal = rssi
        tagStats.lastScanTime = new Date().toISOString()
        tagStats.scanHistory.unshift({ epc, rssi, at: tagStats.lastScanTime })
        if (tagStats.scanHistory.length > 100) tagStats.scanHistory.pop()

        const unitId = epcMap[epc]
        if (!unitId) {
            console.log(`[UDP] Desconocido: ${epc}`)
            broadcast({ type: 'rfid_unknown', epc, rssi })
            return
        }

        console.log(`[UDP] ${epc} → ${unitId}${rssi ? ' | RSSI: ' + rssi + ' dBm' : ''}`)
        broadcast({
            type: 'rfid_scan', epc, sku: unitId, rssi,
            timestamp: tagStats.lastScanTime,
            totalScans: tagStats.totalScans,
            uniqueCount: tagStats.uniqueTags.size
        })

    } catch (err) {
        console.error('[UDP] Error:', err)
    }
})

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