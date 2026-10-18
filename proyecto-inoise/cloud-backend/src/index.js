/**
 * cloud-backend/src/index.js
 *
 * Servidor Express + Socket.io — equivalente en la nube de
 * electron/server/index.js, pero hablándole a Postgres (Supabase) vía
 * Prisma en vez de a SQLite local. Mismo contrato de rutas/eventos que ya
 * conoce el frontend (frontend/src/lib/api.js, lib/socket.js), para que
 * apuntarlo acá sea cambiar una URL, no reescribir el cliente.
 *
 * Diferencias deliberadas respecto a la versión de Electron:
 *  - JWT_SECRET es OBLIGATORIO por variable de entorno — no hay disco
 *    local propio de "esta instalación" para generar uno y persistirlo
 *    (acá puede haber varias instancias/redeploys del mismo servicio, y
 *    todas necesitan firmar/verificar con el mismo secreto). Si falta, el
 *    proceso no arranca — mejor eso que arrancar con un secreto adivinable.
 *  - Sin descubrimiento UDP, sin IP de LAN, sin reglas de firewall — nada
 *    de eso tiene sentido en un contenedor en la nube.
 *  - CORS: lista de orígenes permitidos por variable de entorno en vez de
 *    "*" — ver ALLOWED_ORIGINS más abajo.
 *  - Todas las funciones de db.js son async (Prisma), así que safe()/
 *    safeAsync() del original se unifican acá en un solo helper async.
 */

require('dotenv').config()

const express  = require('express')
const http     = require('http')
const { Server } = require('socket.io')
const jwt      = require('jsonwebtoken')
const path     = require('path')
const fs       = require('fs')
const nodemailer = require('nodemailer')
const rateLimit = require('express-rate-limit')

const {
  loadAll,
  loadProducts, loadEvents, loadRentals, loadOpStates,
  saveProducts, saveEvents, saveRentals, saveOpStates,
  saveEpcMap, saveEventHistory, saveRentalHistory, savePurchaseHistory,
  saveAuditLog,
  loadUsers, createUser, updateUser, deleteUser, authLogin, countAdmins,
  setUserPin, removeUserPin, authLoginPin, setUserActive,
  createSession, closeSession, closeAllOpenSessions, loadUserSessions,
  getConversation, createMessage, countUnread, countUnreadBySender, markConversationRead,
  loadStaff, createStaff, updateStaff, deleteStaff,
  getSetting, setSetting,
  createPasswordReset, verifyAndConsumePasswordReset, setUserPassword,
  setTrustedDeviceId, isTrustedDevice, createAdminLoginOtp, verifyAdminLoginOtp
} = require('./db')

// ── Constantes ───────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3005

// Secreto de firma JWT — obligatorio. Generar uno con:
//   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) {
  console.error('[FATAL] Falta JWT_SECRET en las variables de entorno. El servidor no puede arrancar sin un secreto para firmar sesiones.')
  process.exit(1)
}

// Orígenes permitidos para CORS — lista separada por comas en
// ALLOWED_ORIGINS (ej. "https://app.orbitag.com,http://localhost:5173").
// Si no está seteada, se permite cualquier origen — cómodo mientras se
// prueba, pero hay que fijarla antes de ir a producción con el cliente real.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean)
const isOriginAllowed = (origin) => {
  if (!ALLOWED_ORIGINS.length) return true // sin lista configurada → permisivo (modo pruebas)
  if (!origin) return true // requests sin header Origin (ej. apps nativas, curl, health checks)
  return ALLOWED_ORIGINS.includes(origin)
}
if (!ALLOWED_ORIGINS.length) {
  console.warn('[iNOISE] ALLOWED_ORIGINS no está configurada — CORS permisivo (cualquier origen). Fijarla antes de producción.')
}

// Secreto compartido con el gateway RFID local (ver rfid-gateway/) — permite
// que la PC con las antenas conectadas reenvíe lecturas en vivo para que
// cualquier otra PC conectada a Orbitag también las vea en tiempo real. Si
// no está configurada, ese reenvío queda desactivado (el gateway sigue
// funcionando igual en modo local, solo no llega a otras PCs).
const GATEWAY_TOKEN = process.env.GATEWAY_TOKEN || null
if (!GATEWAY_TOKEN) {
  console.warn('[Orbitag] GATEWAY_TOKEN no está configurada — el reenvío en vivo del gateway RFID queda desactivado.')
}

// ── Usuarios online (en memoria) ──────────────────────────────────────────────
// Clave: socket.id  Valor: { userId, username, displayName, sessionId }
const onlineUsers = new Map()

function getOnlineList() {
  const seen = new Set()
  const list = []
  for (const data of onlineUsers.values()) {
    if (!seen.has(data.userId)) {
      seen.add(data.userId)
      list.push({ userId: data.userId, username: data.username, displayName: data.displayName })
    }
  }
  return list
}

// ── Locks de edición (en memoria) ────────────────────────────────────────────
const editLocks = new Map()

function serializeLocks() {
  return [...editLocks.values()].map(({ entityType, entityId, userId, displayName, since }) =>
    ({ entityType, entityId, userId, displayName, since }))
}

// ── App Express ───────────────────────────────────────────────────────────────
const app    = express()
const server = http.createServer(app)
const io     = new Server(server, {
  cors: {
    origin: (origin, cb) => cb(null, isOriginAllowed(origin)),
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
  }
})

app.use((req, res, next) => {
  const origin = req.headers.origin
  if (isOriginAllowed(origin) && origin) res.setHeader('Access-Control-Allow-Origin', origin)
  else if (!ALLOWED_ORIGINS.length) res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.status(204).end()
  next()
})
app.use(express.json({ limit: '20mb' }))

/* ── Rate limiting en rutas sensibles de auth (ver electron/server/index.js
 * para el porqué — mismo criterio acá). */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false,
  message: { ok: false, error: 'Demasiados intentos. Probá de nuevo en unos minutos.' }
})
const pinLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false,
  message: { ok: false, error: 'Demasiados intentos. Probá de nuevo en unos minutos.' }
})

// Build del frontend (frontend/dist) — si está presente se sirve desde el
// mismo origen (igual que hacía Electron en producción). Si el frontend se
// despliega aparte (ej. un sitio estático en otro dominio), esta carpeta
// simplemente no existe y Express sigue funcionando solo como API.
const distPath = path.join(__dirname, '../../frontend/dist')
const hasFrontendBuild = fs.existsSync(path.join(distPath, 'index.html'))
if (hasFrontendBuild) app.use(express.static(distPath))

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Ejecuta una función de db.js (todas async con Prisma) y devuelve { ok, data } o { ok, error } */
const safe = async (fn) => {
  try { return { ok: true, data: await fn() } }
  catch (e) { console.error('[DB]', e.message); return { ok: false, error: e.message } }
}

/* ── Guardas de rol para las rutas de reemplazo masivo (/api/data/*) ──────
 * Estas rutas aceptan el array/mapa completo que ya mantiene el frontend en
 * memoria (mismo contrato desde antes de la migración a la nube) — por eso
 * solo exigían estar autenticado, sin mirar el rol: no había forma de saber
 * "qué cambió" dentro de un PUT masivo. Eso dejaba sin aplicar del lado del
 * servidor reglas que la UI sí respeta (operador solicita, admin aprueba;
 * solo admin fuerza una fase) — alguien con un token válido de operador
 * podía mandar un PUT armado a mano saltándose la aprobación.
 *
 * La corrección definitiva es exponer endpoints por acción (POST
 * /api/events/:id/cancel, etc.) en vez de reemplazo masivo — queda como
 * mejora de arquitectura pendiente (ver SRS, apéndice de verificación).
 * Mientras tanto, estas funciones comparan el estado ANTES/DESPUÉS de cada
 * PUT y rechazan específicamente las transiciones que de verdad importan:
 * cancelar un evento/arriendo, eliminar un producto, y forzar el cierre de
 * una fase — sin bloquear el resto de los guardados normales. */

function _blockUnauthorizedCancellations(existingList, incomingList, isAdmin) {
  if (isAdmin) return null
  const byId = new Map((existingList || []).map(e => [String(e.id), e]))
  for (const item of incomingList || []) {
    const prev = byId.get(String(item.id))
    if (prev && prev.status !== 'Cancelado' && item.status === 'Cancelado') {
      return `Solo un administrador puede cancelar (id ${item.id})`
    }
  }
  return null
}

function _blockUnauthorizedProductDeletes(existingList, incomingList, isAdmin) {
  if (isAdmin) return null
  const incomingIds = new Set((incomingList || []).map(p => String(p.id)))
  for (const p of existingList || []) {
    if (!incomingIds.has(String(p.id))) {
      return `Solo un administrador puede eliminar productos (id ${p.id})`
    }
  }
  return null
}

function _blockUnauthorizedForcedClose(existingMap, incomingMap, isAdmin) {
  if (isAdmin) return null
  for (const [id, op] of Object.entries(incomingMap || {})) {
    const prevOp = (existingMap || {})[id]
    const phases = op?.phases || {}
    for (const key of Object.keys(phases)) {
      const wasForced = !!prevOp?.phases?.[key]?.forcedClose
      const isForced = !!phases[key]?.forcedClose
      if (isForced && !wasForced) {
        return `Solo un administrador puede forzar el cierre de una fase (id ${id}, fase ${key})`
      }
    }
  }
  return null
}

function _isStrongPassword(pw) {
  return typeof pw === 'string' && pw.length >= 8 &&
    /[A-Z]/.test(pw) && /[a-z]/.test(pw) && /[0-9]/.test(pw) && /[^A-Za-z0-9]/.test(pw)
}
const WEAK_PASSWORD_MSG = 'La contraseña debe tener 8+ caracteres, mayúscula, minúscula, número y signo especial'

const requireAuth = (req, res, next) => {
  const auth = req.headers.authorization
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ ok: false, error: 'No autorizado' })
  }
  try {
    req.user = jwt.verify(auth.slice(7), JWT_SECRET)
    next()
  } catch {
    res.status(401).json({ ok: false, error: 'Token inválido o expirado' })
  }
}

/** Emite 'data:sync' solo a los sockets YA AUTENTICADOS — ver comentario
 *  equivalente en electron/server/index.js. */
const broadcast = (entity, data) => {
  const payload = { entity, data }
  for (const socketId of onlineUsers.keys()) {
    const s = io.sockets.sockets.get(socketId)
    if (s) s.emit('data:sync', payload)
  }
}

// ── Health check ────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'Orbitag', port: PORT })
})

// ── Rutas de autenticación ────────────────────────────────────────────────────

app.post('/api/auth/login', authLimiter, async (req, res) => {
  const { username, password } = req.body || {}
  const result = await safe(() => authLogin(username, password))
  if (!result.ok || !result.data) {
    return res.json({ ok: false, error: 'Usuario o contraseña incorrectos' })
  }
  if (result.data.disabled) {
    return res.json({ ok: false, error: 'Usuario deshabilitado. Contactá al administrador.' })
  }
  const u = result.data
  const token = jwt.sign(u, JWT_SECRET, { expiresIn: '12h' })
  const displayName = `${u.nombre} ${u.apellido}`.trim()
  const ip = req.ip || req.socket?.remoteAddress || null
  const sessionId = (await safe(() => createSession(u.id, u.username, displayName, ip))).data || null
  res.json({ ok: true, data: u, token, sessionId })
})

app.post('/api/auth/login-pin', pinLimiter, async (req, res) => {
  const { userId, pin } = req.body || {}
  const result = await safe(() => authLoginPin(userId, pin))
  if (!result.ok || !result.data) {
    return res.json({ ok: false, error: 'PIN incorrecto' })
  }
  if (result.data.disabled) {
    return res.json({ ok: false, error: 'Usuario deshabilitado. Contactá al administrador.' })
  }
  const u = result.data
  const token = jwt.sign(u, JWT_SECRET, { expiresIn: '12h' })
  const displayName = `${u.nombre} ${u.apellido}`.trim()
  const ip = req.ip || req.socket?.remoteAddress || null
  const sessionId = (await safe(() => createSession(u.id, u.username, displayName, ip))).data || null
  res.json({ ok: true, data: u, token, sessionId })
})

app.get('/api/auth/status', async (req, res) => {
  const usersResult = await safe(() => loadUsers())
  const list = (usersResult.ok && Array.isArray(usersResult.data)) ? usersResult.data : []
  const activeList = list.filter(u => u.active !== false)
  const safeList = activeList.map(({ id, username, nombre, apellido, cargo, role, hasPin, avatar }) =>
    ({ id, username, nombre, apellido, cargo, displayName: `${nombre} ${apellido}`.trim(), role, hasPin: Boolean(hasPin), avatar })
  )
  const adminDeviceTrusted = (await safe(() => isTrustedDevice(req.query.deviceId || null))).data ?? true
  res.json({ ok: true, hasUsers: list.length > 0, users: safeList, hasActiveUsers: activeList.length > 0, adminDeviceTrusted })
})

app.post('/api/auth/logout', requireAuth, async (req, res) => {
  const { sessionId } = req.body || {}
  if (sessionId) await safe(() => closeSession(sessionId))
  res.json({ ok: true })
})

app.get('/api/sessions/user/:id', requireAuth, async (req, res) => {
  const targetId = req.params.id
  if (req.user.role !== 'admin' && req.user.id !== targetId) {
    return res.status(403).json({ ok: false, error: 'Sin permiso' })
  }
  const limit = Math.min(Number(req.query.limit) || 30, 100)
  res.json(await safe(() => loadUserSessions(targetId, limit)))
})

app.post('/api/auth/verify', requireAuth, async (req, res) => {
  const { password } = req.body || {}
  const result = await safe(() => authLogin(req.user.username, password))
  res.json({ ok: result.ok && !!result.data })
})

// ── Rutas de usuarios ─────────────────────────────────────────────────────────

app.get('/api/users', requireAuth, async (req, res) => {
  res.json(await safe(() => loadUsers()))
})

app.get('/api/users/count-admins', requireAuth, async (req, res) => {
  res.json(await safe(() => countAdmins()))
})

app.post('/api/users', async (req, res) => {
  const count = await safe(() => countAdmins())
  if (!count.ok) {
    // Un hipo transitorio de conexión a la base (ya visto antes con
    // Supabase) NO debe interpretarse como "ya hay administradores" — eso
    // hacía que el primer arranque cayera por error en la rama que exige
    // Bearer token, devolviendo 401 "No autorizado" en vez de un mensaje
    // claro de que hubo un problema temporal de conexión.
    return res.status(503).json({ ok: false, error: 'No se pudo conectar con la base de datos. Probá de nuevo en unos segundos.' })
  }
  const isFirstRun = count.data === 0
  const { data, password, deviceId } = req.body || {}
  if (!_isStrongPassword(password)) {
    return res.json({ ok: false, error: WEAK_PASSWORD_MSG })
  }
  if (isFirstRun) {
    const result = await safe(() => createUser({ ...data, role: 'admin' }, password))
    if (result.ok && deviceId) await safe(() => setTrustedDeviceId(result.data.id, deviceId))
    if (result.ok) io.emit('users:updated')
    return res.json(result)
  }
  const auth = req.headers.authorization
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ ok: false, error: 'No autorizado' })
  }
  try { req.user = jwt.verify(auth.slice(7), JWT_SECRET) }
  catch { return res.status(401).json({ ok: false, error: 'Token inválido o expirado' }) }
  if (req.user.role !== 'admin') {
    return res.status(403).json({ ok: false, error: 'Solo el administrador puede crear usuarios' })
  }
  const result = await safe(() => createUser(data, password))
  if (result.ok) io.emit('users:updated')
  res.json(result)
})

app.put('/api/users/:id', requireAuth, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ ok: false, error: 'Solo el administrador puede hacer esto' })
  }
  const id = req.params.id
  const { fields, newPassword } = req.body || {}
  if (newPassword && !_isStrongPassword(newPassword)) {
    return res.json({ ok: false, error: WEAK_PASSWORD_MSG })
  }
  const result = await safe(() => updateUser(id, fields, newPassword || null))
  if (result.ok) io.emit('users:updated')
  res.json(result)
})

app.delete('/api/users/:id', requireAuth, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ ok: false, error: 'Solo el administrador puede hacer esto' })
  }
  const targetId = req.params.id
  if (targetId === req.user.id) {
    return res.status(400).json({ ok: false, error: 'No podés eliminar tu propia cuenta' })
  }
  const usersResult = await safe(() => loadUsers())
  if (usersResult.ok) {
    const targetUser = usersResult.data.find(u => u.id === targetId)
    const otherActiveAdmins = usersResult.data.filter(u => u.role === 'admin' && u.active && u.id !== targetId)
    if (targetUser?.role === 'admin' && otherActiveAdmins.length === 0) {
      return res.status(400).json({ ok: false, error: 'No podés eliminar al único administrador activo' })
    }
  }
  const result = await safe(() => deleteUser(targetId))
  if (result.ok) io.emit('users:updated')
  res.json(result)
})

app.patch('/api/users/:id/active', requireAuth, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ ok: false, error: 'Solo el administrador puede hacer esto' })
  }
  const targetId = req.params.id
  if (targetId === req.user.id) {
    return res.status(400).json({ ok: false, error: 'No podés deshabilitarte a vos mismo' })
  }
  const { active } = req.body || {}
  if (!active) {
    const usersResult = await safe(() => loadUsers())
    if (usersResult.ok) {
      const activeAdmins = usersResult.data.filter(u => u.role === 'admin' && u.active && u.id !== targetId)
      const targetUser = usersResult.data.find(u => u.id === targetId)
      if (targetUser?.role === 'admin' && activeAdmins.length === 0) {
        return res.status(400).json({ ok: false, error: 'No podés deshabilitar al único administrador activo' })
      }
    }
  }
  const result = await safe(() => setUserActive(targetId, active))
  if (result.ok) {
    io.emit('users:updated')
    // Deshabilitar a alguien debe sacarlo YA de la sesión en vivo — antes
    // quedaba conectado por Socket.io (y su JWT seguía sirviendo para la
    // API hasta las 12h de vencimiento natural) hasta que cerrara sesión
    // por su cuenta. Esto corta el socket y cierra su sesión registrada de
    // inmediato; el token HTTP ya emitido sigue siendo técnicamente válido
    // hasta expirar (ventana de 12h, documentada como riesgo aceptado en
    // el SRS — requeriría tokens de corta duración + refresh para cerrarla
    // del todo).
    if (!active) {
      const targetSocket = findSocketByUserId(targetId)
      if (targetSocket) {
        const data = onlineUsers.get(targetSocket.id)
        if (data?.sessionId) await safe(() => closeSession(data.sessionId))
        onlineUsers.delete(targetSocket.id)
        targetSocket.emit('account:disabled')
        targetSocket.disconnect(true)
        io.emit('online:users', getOnlineList())
      }
    }
  }
  res.json(result)
})

app.post('/api/users/:id/pin', requireAuth, async (req, res) => {
  if (req.user.role !== 'admin' && req.user.id !== req.params.id) {
    return res.status(403).json({ ok: false, error: 'Sin permiso' })
  }
  const { pin } = req.body || {}
  const result = await safe(() => setUserPin(req.params.id, pin))
  if (result.ok) io.emit('users:updated')
  res.json(result)
})

app.delete('/api/users/:id/pin', requireAuth, async (req, res) => {
  if (req.user.role !== 'admin' && req.user.id !== req.params.id) {
    return res.status(403).json({ ok: false, error: 'Sin permiso' })
  }
  const result = await safe(() => removeUserPin(req.params.id))
  if (result.ok) io.emit('users:updated')
  res.json(result)
})

// ── Configuración SMTP ────────────────────────────────────────────────────
app.get('/api/settings/smtp', requireAuth, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ ok: false, error: 'Solo el administrador puede ver esto' })
  }
  try {
    const raw = await getSetting('smtp_config')
    if (!raw) return res.json({ ok: true, email: '', host: 'smtp.gmail.com', port: 465, hasPassword: false })
    const cfg = JSON.parse(raw)
    return res.json({ ok: true, email: cfg.email || '', host: cfg.host || 'smtp.gmail.com', port: cfg.port || 465, hasPassword: !!cfg.appPassword })
  } catch (e) {
    return res.json({ ok: false, error: e.message })
  }
})

app.post('/api/settings/smtp', requireAuth, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ ok: false, error: 'Solo el administrador puede hacer esto' })
  }
  const { email, appPassword, host, port } = req.body || {}
  try {
    const raw = await getSetting('smtp_config')
    const prev = raw ? JSON.parse(raw) : {}
    const cfg = {
      email: email !== undefined ? email : prev.email,
      appPassword: appPassword ? appPassword : prev.appPassword,
      host: host || prev.host || 'smtp.gmail.com',
      port: port || prev.port || 465
    }
    await setSetting('smtp_config', JSON.stringify(cfg))
    return res.json({ ok: true, email: cfg.email, host: cfg.host, port: cfg.port, hasPassword: !!cfg.appPassword })
  } catch (e) {
    return res.json({ ok: false, error: e.message })
  }
})

async function _sendAppMail({ to, subject, text, html }) {
  const raw = await getSetting('smtp_config')
  if (!raw) throw new Error('Todavía no se configuró el correo emisor en Ajustes')
  const cfg = JSON.parse(raw)
  if (!cfg.email || !cfg.appPassword) throw new Error('Falta completar la configuración SMTP en Ajustes')

  const transporter = nodemailer.createTransport({
    host: cfg.host || 'smtp.gmail.com',
    port: cfg.port || 465,
    secure: (cfg.port || 465) === 465,
    auth: { user: cfg.email, pass: cfg.appPassword }
  })
  await transporter.sendMail({ from: `"Orbitag" <${cfg.email}>`, to, subject, text, html })
}

/* ── Compartir evento/arriendo por correo — envío real, no mailto: ───────
 * Antes "Compartir por correo" en Events.jsx solo abría el cliente de
 * correo del sistema operativo (mailto:) con el texto prellenado — Orbitag
 * nunca sabía si el mensaje se mandó de verdad. Esta ruta lo manda desde el
 * propio backend (mismo SMTP configurado en Ajustes que ya usa el envío de
 * credenciales), y responde ok:true solo si nodemailer confirma el envío —
 * así la app puede mostrarle al usuario un resultado real, no un "se abrió
 * el programa de correo" que no prueba nada. ────────────────────────────── */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
app.post('/api/share/email', requireAuth, async (req, res) => {
  const { to, subject, text } = req.body || {}
  if (!to || !EMAIL_RE.test(String(to).trim())) {
    return res.json({ ok: false, error: 'Correo de destino inválido' })
  }
  if (!subject || !text) {
    return res.json({ ok: false, error: 'Faltan datos para enviar' })
  }
  try {
    await _sendAppMail({ to: String(to).trim(), subject: String(subject).slice(0, 200), text: String(text).slice(0, 5000) })
    res.json({ ok: true })
  } catch (e) {
    console.error('[Share] Error enviando por correo:', e.message)
    res.json({ ok: false, error: e.message })
  }
})

app.post('/api/users/:id/send-credentials', requireAuth, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ ok: false, error: 'Solo el administrador puede hacer esto' })
  }
  const { password, accessUrl } = req.body || {}
  if (!password) return res.json({ ok: false, error: 'Falta la contraseña a enviar' })

  const usersResult = await safe(() => loadUsers())
  const target = usersResult.ok ? usersResult.data.find(u => u.id === req.params.id) : null
  if (!target) return res.json({ ok: false, error: 'Usuario no encontrado' })
  if (!target.email) return res.json({ ok: false, error: 'Este usuario no tiene correo cargado' })

  try {
    const nombreCompleto = `${target.nombre} ${target.apellido}`.trim()
    await _sendAppMail({
      to: target.email,
      subject: 'Tus credenciales de acceso a Orbitag',
      text: `Hola ${nombreCompleto},\n\nSe creó tu cuenta en Orbitag.\n\nUsuario: ${target.username}\nContraseña: ${password}\n${accessUrl ? `\nAccedé desde: ${accessUrl}\n` : ''}\nPor seguridad, te recomendamos cambiar la contraseña la primera vez que ingreses.\n\n— Orbitag`,
      html: `<p>Hola <strong>${nombreCompleto}</strong>,</p><p>Se creó tu cuenta en <strong>Orbitag</strong>.</p><p><strong>Usuario:</strong> ${target.username}<br/><strong>Contraseña:</strong> ${password}</p>${accessUrl ? `<p>Accedé desde: <a href="${accessUrl}">${accessUrl}</a></p>` : ''}<p>Por seguridad, te recomendamos cambiar la contraseña la primera vez que ingreses.</p><p>— Orbitag</p>`
    })
    res.json({ ok: true })
  } catch (e) {
    console.error('[SMTP] Error enviando credenciales:', e.message)
    res.json({ ok: false, error: 'No se pudo enviar el correo: ' + e.message })
  }
})

app.post('/api/auth/forgot-password', authLimiter, async (req, res) => {
  const { username } = req.body || {}
  const generic = { ok: true, message: 'Si el usuario existe y tiene un correo cargado, le enviamos un código de verificación.' }
  if (!username) return res.json(generic)

  const raw = await getSetting('smtp_config')
  if (!raw) return res.json({ ok: false, error: 'El envío de correo todavía no está configurado. Pedile a un administrador que lo configure en Ajustes, o que te restablezca la contraseña manualmente.' })

  const usersResult = await safe(() => loadUsers())
  const target = usersResult.ok ? usersResult.data.find(u => u.username === username) : null
  if (!target || !target.email || target.active === false) return res.json(generic)

  try {
    const code = await createPasswordReset(target.id)
    const nombreCompleto = `${target.nombre} ${target.apellido}`.trim()
    await _sendAppMail({
      to: target.email,
      subject: 'Código para recuperar tu contraseña — Orbitag',
      text: `Hola ${nombreCompleto},\n\nTu código para restablecer la contraseña es: ${code}\n\nVence en 15 minutos. Si vos no pediste este código, podés ignorar este correo.\n\n— Orbitag`,
      html: `<p>Hola <strong>${nombreCompleto}</strong>,</p><p>Tu código para restablecer la contraseña es:</p><p style="font-size:28px;font-weight:bold;letter-spacing:4px;">${code}</p><p>Vence en 15 minutos. Si vos no pediste este código, podés ignorar este correo.</p><p>— Orbitag</p>`
    })
    return res.json(generic)
  } catch (e) {
    console.error('[SMTP] Error enviando código de recuperación:', e.message)
    return res.json({ ok: false, error: 'No se pudo enviar el correo: ' + e.message })
  }
})

app.post('/api/auth/reset-password', authLimiter, async (req, res) => {
  const { username, code, newPassword } = req.body || {}
  if (!username || !code || !newPassword) {
    return res.json({ ok: false, error: 'Faltan datos' })
  }
  if (!_isStrongPassword(newPassword)) {
    return res.json({ ok: false, error: WEAK_PASSWORD_MSG })
  }

  const usersResult = await safe(() => loadUsers())
  const target = usersResult.ok ? usersResult.data.find(u => u.username === username) : null
  const invalidMsg = { ok: false, error: 'Código inválido o vencido' }
  if (!target) return res.json(invalidMsg)

  const valid = await safe(() => verifyAndConsumePasswordReset(target.id, code))
  if (!valid.ok || !valid.data) return res.json(invalidMsg)

  const result = await safe(() => setUserPassword(target.id, newPassword))
  if (!result.ok) return res.json({ ok: false, error: result.error })
  res.json({ ok: true })
})

app.post('/api/auth/admin-otp/request', authLimiter, async (req, res) => {
  const { username } = req.body || {}
  const generic = { ok: true, message: 'Si el usuario existe y tiene un correo cargado, le enviamos un código de acceso.' }
  if (!username) return res.json(generic)

  const raw = await getSetting('smtp_config')
  if (!raw) return res.json({ ok: false, error: 'El envío de correo todavía no está configurado. Pedile al administrador que lo configure en Ajustes desde su propio equipo.' })

  const result = await safe(() => createAdminLoginOtp(username))
  const otp = result.ok ? result.data : null
  if (!otp || !otp.user?.email) return res.json(generic)

  try {
    const nombreCompleto = `${otp.user.nombre} ${otp.user.apellido}`.trim()
    await _sendAppMail({
      to: otp.user.email,
      subject: 'Código de acceso de un solo uso — Orbitag',
      text: `Hola ${nombreCompleto},\n\nSe pidió iniciar sesión como Administrador desde un dispositivo nuevo.\n\nTu código de acceso es: ${otp.code}\n\nVence en 10 minutos y sirve una sola vez. Si vos no pediste este código, ignorá este correo y avisale a tu equipo.\n\n— Orbitag`,
      html: `<p>Hola <strong>${nombreCompleto}</strong>,</p><p>Se pidió iniciar sesión como Administrador desde un dispositivo nuevo.</p><p>Tu código de acceso es:</p><p style="font-size:28px;font-weight:bold;letter-spacing:4px;">${otp.code}</p><p>Vence en 10 minutos y sirve una sola vez. Si vos no pediste este código, ignorá este correo y avisale a tu equipo.</p><p>— Orbitag</p>`
    })
    return res.json(generic)
  } catch (e) {
    console.error('[SMTP] Error enviando código de acceso admin:', e.message)
    return res.json({ ok: false, error: 'No se pudo enviar el correo: ' + e.message })
  }
})

app.post('/api/auth/admin-otp/verify', authLimiter, async (req, res) => {
  const { username, code } = req.body || {}
  if (!username || !code) return res.json({ ok: false, error: 'Faltan datos' })

  const result = await safe(() => verifyAdminLoginOtp(username, code))
  const u = result.ok ? result.data : null
  if (!u) return res.json({ ok: false, error: 'Código inválido o vencido' })

  const token = jwt.sign(u, JWT_SECRET, { expiresIn: '12h' })
  const displayName = `${u.nombre} ${u.apellido}`.trim()
  const ip = req.ip || req.socket?.remoteAddress || null
  const sessionId = (await safe(() => createSession(u.id, u.username, displayName, ip))).data || null
  res.json({ ok: true, data: u, token, sessionId })
})

// ── Rutas de datos (inventario, eventos, etc.) ────────────────────────────────

app.get('/api/data', requireAuth, async (req, res) => {
  res.json(await safe(() => loadAll()))
})

app.put('/api/data/products', requireAuth, async (req, res) => {
  const isAdmin = req.user.role === 'admin'
  if (!isAdmin) {
    const existing = await safe(() => loadProducts())
    const err = existing.ok && _blockUnauthorizedProductDeletes(existing.data, req.body, isAdmin)
    if (err) return res.status(403).json({ ok: false, error: err })
  }
  const result = await safe(() => saveProducts(req.body))
  if (result.ok) broadcast('products', req.body)
  res.json(result)
})

app.put('/api/data/events', requireAuth, async (req, res) => {
  const isAdmin = req.user.role === 'admin'
  if (!isAdmin) {
    const existing = await safe(() => loadEvents())
    const err = existing.ok && _blockUnauthorizedCancellations(existing.data, req.body, isAdmin)
    if (err) return res.status(403).json({ ok: false, error: err })
  }
  const result = await safe(() => saveEvents(req.body))
  if (result.ok) broadcast('events', req.body)
  res.json(result)
})

app.put('/api/data/rentals', requireAuth, async (req, res) => {
  const isAdmin = req.user.role === 'admin'
  if (!isAdmin) {
    const existing = await safe(() => loadRentals())
    const err = existing.ok && _blockUnauthorizedCancellations(existing.data, req.body, isAdmin)
    if (err) return res.status(403).json({ ok: false, error: err })
  }
  const result = await safe(() => saveRentals(req.body))
  if (result.ok) broadcast('rentals', req.body)
  res.json(result)
})

app.put('/api/data/op-states', requireAuth, async (req, res) => {
  const isAdmin = req.user.role === 'admin'
  if (!isAdmin) {
    const existing = await safe(() => loadOpStates())
    const err = existing.ok && _blockUnauthorizedForcedClose(existing.data, req.body, isAdmin)
    if (err) return res.status(403).json({ ok: false, error: err })
  }
  const result = await safe(() => saveOpStates(req.body))
  if (result.ok) broadcast('opStates', req.body)
  res.json(result)
})

app.put('/api/data/epc-map', requireAuth, async (req, res) => {
  const result = await safe(() => saveEpcMap(req.body))
  if (result.ok) broadcast('epcMap', req.body)
  res.json(result)
})

app.put('/api/data/event-history', requireAuth, async (req, res) => {
  const result = await safe(() => saveEventHistory(req.body))
  if (result.ok) broadcast('eventHistory', req.body)
  res.json(result)
})

app.put('/api/data/rental-history', requireAuth, async (req, res) => {
  const result = await safe(() => saveRentalHistory(req.body))
  if (result.ok) broadcast('rentalHistory', req.body)
  res.json(result)
})

app.put('/api/data/purchase-history', requireAuth, async (req, res) => {
  const result = await safe(() => savePurchaseHistory(req.body))
  if (result.ok) broadcast('purchaseHistory', req.body)
  res.json(result)
})

app.put('/api/data/audit-log', requireAuth, async (req, res) => {
  const result = await safe(() => saveAuditLog(req.body))
  if (result.ok) broadcast('auditLog', req.body)
  res.json(result)
})

// ── Chat interno ──────────────────────────────────────────────────────────────

app.get('/api/chat/conversation', requireAuth, async (req, res) => {
  const { with: withUser } = req.query
  if (!withUser) return res.json({ ok: false, error: 'Falta parámetro "with"' })
  res.json(await safe(() => getConversation(req.user.id, withUser)))
})

app.get('/api/chat/unread', requireAuth, async (req, res) => {
  const result = await safe(() => countUnread(req.user.id))
  const bySenderResult = await safe(() => countUnreadBySender(req.user.id))
  res.json({
    ok: true,
    count: result.ok ? result.data : 0,
    bySender: bySenderResult.ok ? bySenderResult.data : {}
  })
})

function findSocketByUserId(userId) {
  for (const [, data] of onlineUsers) {
    if (data.userId === userId) {
      return [...io.sockets.sockets.values()]
        .find(s => onlineUsers.get(s.id)?.userId === userId) || null
    }
  }
  return null
}

app.post('/api/chat/messages', requireAuth, async (req, res) => {
  const { toUser, content, type, metadata } = req.body || {}
  if (!toUser || !content) return res.json({ ok: false, error: 'toUser y content son obligatorios' })

  const result = await safe(() => createMessage(req.user.id, toUser, content, type || 'text', metadata))
  if (!result.ok) return res.json(result)

  const msg = result.data
  const outMsg = { ...msg, metadata: msg.metadata ? JSON.parse(msg.metadata) : null }

  const targetSocket = findSocketByUserId(toUser)
  if (targetSocket) targetSocket.emit('chat:message', outMsg)

  res.json({ ok: true, data: outMsg })
})

app.patch('/api/chat/conversation/read', requireAuth, async (req, res) => {
  const { with: withUser } = req.query
  if (!withUser) return res.json({ ok: false, error: 'Falta parámetro "with"' })
  const result = await safe(() => markConversationRead(req.user.id, withUser))
  if (result.ok) {
    const senderSocket = findSocketByUserId(withUser)
    if (senderSocket) senderSocket.emit('chat:read', { by: req.user.id })
  }
  res.json(result)
})

// ── Info (sin auth) ───────────────────────────────────────────────────────────
app.get('/api/info', (req, res) => {
  res.json({ ok: true, port: PORT, version: '1.0.0-cloud' })
})

// ── Rutas de personal (staff) ─────────────────────────────────────────────────
// IMPORTANTE: deben registrarse ANTES del fallback SPA de abajo.
app.get('/api/staff', requireAuth, async (_req, res) => {
  res.json(await safe(() => loadStaff()))
})

app.post('/api/staff', requireAuth, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ ok: false, error: 'Solo el administrador puede hacer esto' })
  }
  const { nombre, apellido, rut, telefono, cargo } = req.body
  if (!nombre || !apellido) return res.status(400).json({ ok: false, error: 'Nombre y apellido requeridos' })
  res.json(await safe(() => createStaff({ nombre, apellido, rut, telefono, cargo })))
})

app.put('/api/staff/:id', requireAuth, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ ok: false, error: 'Solo el administrador puede hacer esto' })
  }
  const { nombre, apellido, rut, telefono, cargo, activo } = req.body
  res.json(await safe(async () => { await updateStaff(req.params.id, { nombre, apellido, rut, telefono, cargo, activo }); return true }))
})

app.delete('/api/staff/:id', requireAuth, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ ok: false, error: 'Solo el administrador puede hacer esto' })
  }
  res.json(await safe(async () => { await deleteStaff(req.params.id); return true }))
})

// ── SPA fallback (solo si hay un build del frontend presente) ─────────────────
if (hasFrontendBuild) {
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'))
  })
} else {
  app.get('*', (req, res) => {
    res.status(404).json({ ok: false, error: 'Not found (API-only, sin build de frontend)' })
  })
}

// ── Socket.io ─────────────────────────────────────────────────────────────────

io.on('connection', (socket) => {
  console.log('[Orbitag] Cliente conectado:', socket.id)

  socket.emit('locks:sync', serializeLocks())

  socket.on('user:authenticate', ({ token, sessionId } = {}) => {
    try {
      const user = jwt.verify(token, JWT_SECRET)
      const displayName = `${user.nombre} ${user.apellido}`.trim()
      onlineUsers.set(socket.id, {
        userId: user.id, username: user.username,
        displayName, sessionId: sessionId || null
      })
      socket.data = { userId: user.id, sessionId: sessionId || null }
      io.emit('online:users', getOnlineList())
      console.log(`[Orbitag] Online: ${displayName} (${socket.id})`)
    } catch {
      // Token inválido — ignorar silenciosamente
    }
  })

  socket.on('user:deauthenticate', () => {
    onlineUsers.delete(socket.id)
    io.emit('online:users', getOnlineList())
  })

  // ── Gateway RFID local (ver rfid-gateway/) ──────────────────────────────
  // Autenticación separada de la de usuarios: un secreto largo compartido,
  // no un JWT de persona. Solo un socket ya marcado como gateway puede
  // emitir 'gateway:event' — evita que cualquier cliente conectado pueda
  // falsificar lecturas RFID.
  socket.on('gateway:authenticate', ({ token } = {}) => {
    const ok = Boolean(GATEWAY_TOKEN) && token === GATEWAY_TOKEN
    socket.data = { ...(socket.data || {}), isGateway: ok }
    socket.emit('gateway:authenticated', ok)
    if (ok) console.log(`[Orbitag] Gateway RFID conectado (${socket.id})`)
  })

  socket.on('gateway:event', (msg) => {
    if (!socket.data?.isGateway) return
    const { type, payload } = msg || {}
    if (!type) return
    for (const socketId of onlineUsers.keys()) {
      const s = io.sockets.sockets.get(socketId)
      if (s) s.emit('rfid:event', { type, payload })
    }
  })

  socket.on('chat:typing', ({ to, isTyping } = {}) => {
    const sender = onlineUsers.get(socket.id)
    if (!sender || !to) return
    const targetSocket = findSocketByUserId(to)
    if (targetSocket) targetSocket.emit('chat:typing', { from: sender.userId, isTyping: !!isTyping })
  })

  socket.on('lock:acquire', ({ entityType, entityId } = {}) => {
    if (!entityType || entityId === undefined || entityId === null) return
    const requester = onlineUsers.get(socket.id)
    if (!requester) return
    const key = `${entityType}:${entityId}`
    const existing = editLocks.get(key)
    if (existing && existing.userId !== requester.userId) {
      socket.emit('lock:denied', { entityType, entityId, byDisplayName: existing.displayName })
      return
    }
    const lock = {
      entityType, entityId,
      userId: requester.userId, displayName: requester.displayName,
      socketId: socket.id, since: new Date().toISOString()
    }
    editLocks.set(key, lock)
    io.emit('lock:acquired', { entityType, entityId, userId: lock.userId, displayName: lock.displayName, since: lock.since })
  })

  socket.on('lock:release', ({ entityType, entityId } = {}) => {
    if (!entityType || entityId === undefined || entityId === null) return
    const key = `${entityType}:${entityId}`
    const existing = editLocks.get(key)
    if (existing && existing.socketId === socket.id) {
      editLocks.delete(key)
      io.emit('lock:released', { entityType, entityId })
    }
  })

  socket.on('disconnect', (reason) => {
    if (onlineUsers.has(socket.id)) {
      const data = onlineUsers.get(socket.id)
      onlineUsers.delete(socket.id)
      io.emit('online:users', getOnlineList())
      console.log(`[Orbitag] Offline: ${data.displayName || data.username} (${reason})`)
    } else {
      console.log('[Orbitag] Cliente desconectado:', socket.id)
    }
    for (const [key, lock] of editLocks.entries()) {
      if (lock.socketId === socket.id) {
        editLocks.delete(key)
        io.emit('lock:released', { entityType: lock.entityType, entityId: lock.entityId })
      }
    }
  })
})

// ── Arranque ──────────────────────────────────────────────────────────────────

async function start() {
  try { await closeAllOpenSessions() } catch (e) { console.error('[Orbitag] Error cerrando sesiones previas:', e.message) }

  server.listen(PORT, () => {
    console.log(`[Orbitag] Servidor escuchando en puerto ${PORT}`)
    console.log(`[Orbitag] CORS: ${ALLOWED_ORIGINS.length ? ALLOWED_ORIGINS.join(', ') : '(permisivo — sin ALLOWED_ORIGINS configurada)'}`)
    console.log(`[Orbitag] Frontend estático: ${hasFrontendBuild ? 'servido desde ' + distPath : 'no encontrado — corriendo solo como API'}`)
  })
}

start()

module.exports = { app, server, io }
