/**
 * electron/server/index.js
 *
 * Servidor Express + Socket.io embebido en el proceso main de Electron.
 * Se inicia una sola vez al arrancar la app y:
 *  - Expone la API REST que reemplaza los handlers IPC (para clientes web)
 *  - Sirve el build de React como archivos estáticos (clientes en navegador)
 *  - Transmite cambios en tiempo real via Socket.io a todos los clientes
 *
 * Puerto: 3005 (el rfid-bridge usa 3001/3002 aparte, ver server/rfid-bridge.js)
 * Acceso local:   http://localhost:3005
 * Acceso en red:  http://<IP-local>:3005
 */

const express  = require('express')
const http     = require('http')
const { Server } = require('socket.io')
const jwt      = require('jsonwebtoken')
const path     = require('path')
const os       = require('os')
const fs       = require('fs')
const crypto   = require('crypto')
const nodemailer = require('nodemailer')
const rateLimit = require('express-rate-limit')

const {
  loadAll,
  saveProducts, saveEvents, saveRentals, saveOpStates,
  saveEpcMap, saveEventHistory, saveRentalHistory, savePurchaseHistory,
  saveAuditLog,
  loadUsers, createUser, updateUser, deleteUser, authLogin, countAdmins,
  setUserPin, removeUserPin, authLoginPin, setUserActive,
  createSession, closeSession, closeAllOpenSessions, loadUserSessions,
  getConversation, createMessage, markMessageRead, countUnread, countUnreadBySender, markConversationRead,
  loadStaff, createStaff, updateStaff, deleteStaff,
  getSetting, setSetting,
  createPasswordReset, verifyAndConsumePasswordReset, setUserPassword,
  setTrustedDeviceId, isTrustedDevice, createAdminLoginOtp, verifyAdminLoginOtp
} = require('../db')

// ── Constantes ───────────────────────────────────────────────────────────────
// Puerto 3001 lo usa el rfid-bridge para su WebSocket.
// Puerto 3002 lo usa el rfid-bridge para su HTTP API.
// Nuestro servidor Express + Socket.io usa el 3005.
const PORT       = 3005

/* ── Secreto de firma JWT ──────────────────────────────────────────────────
 * Antes había un valor hardcodeado ('inoise-bodega-2026') como fallback de
 * INOISE_SECRET. Como esta app no tiene un mecanismo de .env por instalación
 * (se distribuye como instalador de Windows), esa variable de entorno nunca
 * se configura en la práctica — TODAS las instalaciones firmaban y
 * verificaban tokens con el mismo secreto público (visible en el código
 * fuente), permitiéndole a cualquiera con el instalador forjar un token de
 * administrador offline.
 *
 * Ahora se genera un secreto aleatorio de 256 bits una sola vez por equipo y
 * se guarda junto a inoise-config.json en userData (mismo patrón que
 * getOrCreateDeviceId() en electron/main.js) — sobrevive reinicios y
 * actualizaciones, pero es distinto en cada instalación. Si INOISE_SECRET
 * está seteada explícitamente (ej. en el futuro backend en la nube) tiene
 * prioridad, para no romper ese caso. */
function _getOrCreateJwtSecret() {
    if (process.env.INOISE_SECRET) return process.env.INOISE_SECRET
    let secretDir = __dirname
    try {
        if (process.versions && process.versions.electron) {
            secretDir = require('electron').app.getPath('userData')
        }
    } catch { /* no estamos en un contexto de Electron utilizable */ }
    const secretPath = path.join(secretDir, 'inoise-jwt-secret.txt')
    try {
        const existing = fs.readFileSync(secretPath, 'utf8').trim()
        if (existing) return existing
    } catch { /* todavía no existe, se genera abajo */ }
    const generated = crypto.randomBytes(32).toString('hex')
    try { fs.writeFileSync(secretPath, generated, 'utf8') } catch (e) {
        console.error('[iNOISE] No se pudo persistir el secreto JWT, se usará solo en memoria:', e.message)
    }
    return generated
}

const JWT_SECRET = _getOrCreateJwtSecret()

// ── Usuarios online (en memoria) ──────────────────────────────────────────────
// Clave: socket.id  Valor: { userId, username, displayName, sessionId }
// La misma persona puede estar conectada desde varios dispositivos → varias
// entradas con distinto socket.id pero igual userId.
const onlineUsers = new Map()

function getOnlineList() {
  // Deduplica por userId: si el mismo usuario tiene varias pestañas o
  // dispositivos abiertos, aparece una sola vez en la lista.
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
// Con varios PCs conectados al mismo servidor (Tailscale), dos personas
// pueden abrir el mismo producto para editar casi al mismo tiempo. En vez de
// dejar que "gane el último que guarda" sin avisar a nadie, cualquier
// cliente puede "reservar" una entidad mientras la edita; el resto ve un
// aviso tipo "Juan está editando esto" y no puede guardar encima.
// Clave: `${entityType}:${entityId}` (ej. "product:42").  Valor: quién lo
// tiene, desde qué socket (para liberarlo solo si se desconecta ese mismo
// socket) y desde cuándo.
const editLocks = new Map()

function serializeLocks() {
  return [...editLocks.values()].map(({ entityType, entityId, userId, displayName, since }) =>
    ({ entityType, entityId, userId, displayName, since }))
}

// ── App Express ───────────────────────────────────────────────────────────────
const app    = express()
const server = http.createServer(app)
const io     = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] }
})

// CORS manual — más confiable que el paquete 'cors' en entorno Electron/Vite
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.status(204).end()
  next()
})
app.use(express.json({ limit: '20mb' }))

/* ── Rate limiting en rutas sensibles de auth ────────────────────────────
 * Antes login (contraseña y PIN), recuperación de contraseña y el OTP de
 * admin no tenían ningún freno de intentos. Un PIN de 4 dígitos (10.000
 * combinaciones) o un código de 6 dígitos (1.000.000, aunque vence en
 * 10-15 min) son adivinables por fuerza bruta sin esto. Los límites son
 * generosos para no molestar el uso normal (alguien que se equivoca de
 * contraseña un par de veces), pero cortan un ataque automatizado. */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Demasiados intentos. Probá de nuevo en unos minutos.' }
})
const pinLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Demasiados intentos. Probá de nuevo en unos minutos.' }
})

// Servir el build de React para clientes en navegador.
// En producción los archivos están en app.asar.unpacked (express.static usa
// fs.createReadStream que no funciona dentro del asar). En dev, path normal.
const distPath = __dirname.includes('app.asar')
  ? path.join(process.resourcesPath, 'app.asar.unpacked', 'frontend', 'dist')
  : path.join(__dirname, '../../frontend/dist')
app.use(express.static(distPath))

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Ejecuta una función de db.js y devuelve { ok, data } o { ok, error } */
const safe = (fn) => {
  try   { return { ok: true,  data: fn() } }
  catch (e) { return { ok: false, error: e.message } }
}

/** Igual que safe(), pero para funciones async (ej. las que hashean contraseña) */
const safeAsync = async (fn) => {
  try   { return { ok: true,  data: await fn() } }
  catch (e) { return { ok: false, error: e.message } }
}

/** Misma regla usada hoy solo en /api/auth/reset-password: 8+ caracteres,
 *  mayúscula, minúscula, número y símbolo. Se reusa acá para que también
 *  se exija al crear o editar un usuario desde /api/users — antes esa ruta
 *  no validaba nada del lado del servidor y confiaba en que la UI lo hiciera. */
function _isStrongPassword(pw) {
  return typeof pw === 'string' && pw.length >= 8 &&
    /[A-Z]/.test(pw) && /[a-z]/.test(pw) && /[0-9]/.test(pw) && /[^A-Za-z0-9]/.test(pw)
}
const WEAK_PASSWORD_MSG = 'La contraseña debe tener 8+ caracteres, mayúscula, minúscula, número y signo especial'

/**
 * Middleware JWT.
 * Rutas de auth (login) no lo necesitan; todo lo demás sí.
 */
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

/**
 * Tras guardar una entidad, emite 'data:sync' a los clientes YA
 * AUTENTICADOS (los que completaron 'user:authenticate', ver onlineUsers
 * más abajo) para que actualicen su estado local sin necesidad de hacer
 * re-fetch.
 *
 * Antes esto era io.emit(...) a TODOS los sockets conectados, autenticados
 * o no. La pantalla de login necesita el socket abierto sin login (para
 * enterarse en vivo de 'users:updated' si otro PC crea/edita un usuario),
 * pero eso no significa que deba recibir inventario/eventos/arriendos
 * reales — con CORS abierto y sin nada más gateando la conexión, cualquier
 * dispositivo en la red que abriera un socket sin loguearse recibía igual
 * todos los datos de negocio en tiempo real.
 */
const broadcast = (entity, data) => {
  const payload = { entity, data }
  for (const socketId of onlineUsers.keys()) {
    const s = io.sockets.sockets.get(socketId)
    if (s) s.emit('data:sync', payload)
  }
}

// ── Health check (público — usado por PCs cliente para verificar conexión) ────
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'iNOISE', port: PORT })
})

// ── Rutas de autenticación ────────────────────────────────────────────────────

app.post('/api/auth/login', authLimiter, async (req, res) => {
  const { username, password } = req.body || {}
  const result = await safeAsync(() => authLogin(username, password))
  if (!result.ok || !result.data) {
    return res.json({ ok: false, error: 'Usuario o contraseña incorrectos' })
  }
  if (result.data.disabled) {
    return res.json({ ok: false, error: 'Usuario deshabilitado. Contactá al administrador.' })
  }
  const u = result.data
  const token = jwt.sign(u, JWT_SECRET, { expiresIn: '12h' })
  const displayName = `${u.nombre} ${u.apellido}`.trim()
  const ip = req.ip || req.connection?.remoteAddress || null
  const sessionId = safe(() => createSession(u.id, u.username, displayName, ip)).data || null
  res.json({ ok: true, data: u, token, sessionId })
})

app.post('/api/auth/login-pin', pinLimiter, (req, res) => {
  const { userId, pin } = req.body || {}
  const result = safe(() => authLoginPin(userId, pin))
  if (!result.ok || !result.data) {
    return res.json({ ok: false, error: 'PIN incorrecto' })
  }
  if (result.data.disabled) {
    return res.json({ ok: false, error: 'Usuario deshabilitado. Contactá al administrador.' })
  }
  const u = result.data
  const token = jwt.sign(u, JWT_SECRET, { expiresIn: '12h' })
  const displayName = `${u.nombre} ${u.apellido}`.trim()
  const ip = req.ip || req.connection?.remoteAddress || null
  const sessionId = safe(() => createSession(u.id, u.username, displayName, ip)).data || null
  res.json({ ok: true, data: u, token, sessionId })
})

// Estado público: ¿existen usuarios? + lista mínima para pantalla de login.
// No requiere token. Expone id, nombre, apellido, cargo, displayName, role,
// hasPin, avatar — sin contraseñas, sin hashes. nombre/apellido/cargo van
// por separado (además de displayName) porque las tarjetas de selección de
// operador en Login.jsx los usan individualmente, no el nombre combinado.
app.get('/api/auth/status', (req, res) => {
  const usersResult = safe(() => loadUsers())
  const list = (usersResult.ok && Array.isArray(usersResult.data)) ? usersResult.data : []
  // Solo usuarios activos en la pantalla de login
  const activeList = list.filter(u => u.active !== false)
  const safeList = activeList.map(({ id, username, nombre, apellido, cargo, role, hasPin, avatar }) =>
    ({ id, username, nombre, apellido, cargo, displayName: `${nombre} ${apellido}`.trim(), role, hasPin: Boolean(hasPin), avatar })
  )
  // ¿Este dispositivo es el del administrador? El renderer manda su
  // deviceId persistente (ver electron/main.js) como query param. Si no es
  // el dispositivo de confianza, Login.jsx muestra la tarjeta Admin
  // restringida (solo entra con el PIN de un solo uso al correo).
  const adminDeviceTrusted = safe(() => isTrustedDevice(req.query.deviceId || null)).data ?? true
  res.json({ ok: true, hasUsers: list.length > 0, users: safeList, hasActiveUsers: activeList.length > 0, adminDeviceTrusted })
})

// Logout: cierra la sesión en BD y el cliente limpia su token
app.post('/api/auth/logout', requireAuth, (req, res) => {
  const { sessionId } = req.body || {}
  if (sessionId) safe(() => closeSession(sessionId))
  res.json({ ok: true })
})

// Sesiones de un usuario (admin ve cualquiera, operador solo las propias)
app.get('/api/sessions/user/:id', requireAuth, (req, res) => {
  const targetId = req.params.id
  if (req.user.role !== 'admin' && req.user.id !== targetId) {
    return res.status(403).json({ ok: false, error: 'Sin permiso' })
  }
  const limit = Math.min(Number(req.query.limit) || 30, 100)
  res.json(safe(() => loadUserSessions(targetId, limit)))
})

// Re-verifica contraseña sin cambiar sesión (para acciones sensibles)
app.post('/api/auth/verify', requireAuth, async (req, res) => {
  const { password } = req.body || {}
  const result = await safeAsync(() => authLogin(req.user.username, password))
  res.json({ ok: result.ok && !!result.data })
})

// ── Rutas de usuarios ─────────────────────────────────────────────────────────

app.get('/api/users', requireAuth, (req, res) => {
  res.json(safe(() => loadUsers()))
})

app.get('/api/users/count-admins', requireAuth, (req, res) => {
  res.json(safe(() => countAdmins()))
})

app.post('/api/users', async (req, res) => {
  // En first-run (sin ningún administrador todavía) se permite sin token,
  // y el primer usuario SIEMPRE se crea como admin sin importar lo que
  // mande el body — así nadie puede arrancar la app y autoasignarse un
  // rol distinto en ese único momento sin auth.
  // Fuera de first-run: crear usuarios (de cualquier rol) es una acción
  // exclusiva del administrador. Antes esta ruta solo pedía "estar
  // logueado" — cualquier operador podía crear otra cuenta, incluida una
  // admin, llamando a la API directamente aunque el botón no apareciera
  // en la interfaz. Ahora se valida también en el servidor.
  const count = safe(() => countAdmins())
  const isFirstRun = count.ok && count.data === 0
  const { data, password, deviceId } = req.body || {}
  if (!_isStrongPassword(password)) {
    return res.json({ ok: false, error: WEAK_PASSWORD_MSG })
  }
  if (isFirstRun) {
    const result = await safeAsync(() => createUser({ ...data, role: 'admin' }, password))
    // Este es el momento "usuario 0": el equipo desde el que se crea la
    // cuenta admin por primera vez queda registrado como su dispositivo de
    // confianza. Desde cualquier OTRO equipo, la tarjeta Administrador
    // quedará restringida (ver /api/auth/status y /api/auth/admin-otp/*).
    if (result.ok && deviceId) safe(() => setTrustedDeviceId(result.data.id, deviceId))
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
  const result = await safeAsync(() => createUser(data, password))
  if (result.ok) io.emit('users:updated')
  res.json(result)
})

app.put('/api/users/:id', requireAuth, async (req, res) => {
  // Editar cuentas (incluido cambiar contraseñas o el rol de alguien) es
  // exclusivo del administrador — antes solo exigía estar logueado.
  if (req.user.role !== 'admin') {
    return res.status(403).json({ ok: false, error: 'Solo el administrador puede hacer esto' })
  }
  const id = req.params.id
  const { fields, newPassword } = req.body || {}
  if (newPassword && !_isStrongPassword(newPassword)) {
    return res.json({ ok: false, error: WEAK_PASSWORD_MSG })
  }
  const result = await safeAsync(() => updateUser(id, fields, newPassword || null))
  if (result.ok) io.emit('users:updated')
  res.json(result)
})

app.delete('/api/users/:id', requireAuth, (req, res) => {
  // Igual que arriba: antes cualquier cuenta logueada podía borrar a
  // cualquier otra, incluido el único admin. Ahora exclusivo del admin,
  // y además no se puede borrar al único administrador activo (mismo
  // resguardo que ya existía para deshabilitar cuentas).
  if (req.user.role !== 'admin') {
    return res.status(403).json({ ok: false, error: 'Solo el administrador puede hacer esto' })
  }
  const targetId = req.params.id
  if (targetId === req.user.id) {
    return res.status(400).json({ ok: false, error: 'No podés eliminar tu propia cuenta' })
  }
  const usersResult = safe(() => loadUsers())
  if (usersResult.ok) {
    const targetUser = usersResult.data.find(u => u.id === targetId)
    const otherActiveAdmins = usersResult.data.filter(u => u.role === 'admin' && u.active && u.id !== targetId)
    if (targetUser?.role === 'admin' && otherActiveAdmins.length === 0) {
      return res.status(400).json({ ok: false, error: 'No podés eliminar al único administrador activo' })
    }
  }
  const result = safe(() => deleteUser(targetId))
  if (result.ok) io.emit('users:updated')
  res.json(result)
})

// Habilitar / deshabilitar usuario (solo admin)
app.patch('/api/users/:id/active', requireAuth, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ ok: false, error: 'Solo el administrador puede hacer esto' })
  }
  const targetId = req.params.id
  // No puede deshabilitarse a sí mismo
  if (targetId === req.user.id) {
    return res.status(400).json({ ok: false, error: 'No podés deshabilitarte a vos mismo' })
  }
  const { active } = req.body || {}
  // Si va a deshabilitar, verificar que no sea el único admin activo
  if (!active) {
    const usersResult = safe(() => loadUsers())
    if (usersResult.ok) {
      const activeAdmins = usersResult.data.filter(u => u.role === 'admin' && u.active && u.id !== targetId)
      const targetUser = usersResult.data.find(u => u.id === targetId)
      if (targetUser?.role === 'admin' && activeAdmins.length === 0) {
        return res.status(400).json({ ok: false, error: 'No podés deshabilitar al único administrador activo' })
      }
    }
  }
  const result = safe(() => setUserActive(targetId, active))
  if (result.ok) io.emit('users:updated')
  res.json(result)
})

// Fijar/borrar el PIN de un usuario: solo el propio dueño de la cuenta o un
// admin — antes cualquier operador autenticado podía cambiarle o borrarle
// el PIN a cualquier OTRO usuario con solo conocer su id.
app.post('/api/users/:id/pin', requireAuth, (req, res) => {
  if (req.user.role !== 'admin' && req.user.id !== req.params.id) {
    return res.status(403).json({ ok: false, error: 'Sin permiso' })
  }
  const { pin } = req.body || {}
  const result = safe(() => setUserPin(req.params.id, pin))
  // Avisar a otras pantallas conectadas (ej. Login de otro PC) para que
  // refresquen la lista y muestren el PIN recién configurado sin recargar.
  if (result.ok) io.emit('users:updated')
  res.json(result)
})

app.delete('/api/users/:id/pin', requireAuth, (req, res) => {
  if (req.user.role !== 'admin' && req.user.id !== req.params.id) {
    return res.status(403).json({ ok: false, error: 'Sin permiso' })
  }
  const result = safe(() => removeUserPin(req.params.id))
  if (result.ok) io.emit('users:updated')
  res.json(result)
})

// ── Configuración SMTP (envío automático de credenciales por correo) ────────
// Solo el admin puede ver/editar. La contraseña de aplicación nunca se
// devuelve al frontend una vez guardada — solo se informa si ya hay una
// configurada (hasPassword), para que el admin pueda dejarla como está al
// actualizar el resto de los datos.
app.get('/api/settings/smtp', requireAuth, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ ok: false, error: 'Solo el administrador puede ver esto' })
  }
  try {
    const raw = getSetting('smtp_config')
    if (!raw) return res.json({ ok: true, email: '', host: 'smtp.gmail.com', port: 465, hasPassword: false })
    const cfg = JSON.parse(raw)
    return res.json({ ok: true, email: cfg.email || '', host: cfg.host || 'smtp.gmail.com', port: cfg.port || 465, hasPassword: !!cfg.appPassword })
  } catch (e) {
    return res.json({ ok: false, error: e.message })
  }
})

app.post('/api/settings/smtp', requireAuth, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ ok: false, error: 'Solo el administrador puede hacer esto' })
  }
  const { email, appPassword, host, port } = req.body || {}
  try {
    const raw = getSetting('smtp_config')
    const prev = raw ? JSON.parse(raw) : {}
    const cfg = {
      email: email !== undefined ? email : prev.email,
      // Si no mandan una contraseña nueva (campo vacío), se conserva la que ya había guardada.
      appPassword: appPassword ? appPassword : prev.appPassword,
      host: host || prev.host || 'smtp.gmail.com',
      port: port || prev.port || 465
    }
    setSetting('smtp_config', JSON.stringify(cfg))
    return res.json({ ok: true, email: cfg.email, host: cfg.host, port: cfg.port, hasPassword: !!cfg.appPassword })
  } catch (e) {
    return res.json({ ok: false, error: e.message })
  }
})

// Helper compartido: arma el transporter desde la config guardada y manda
// un correo. Lanza un error con mensaje entendible si falta configuración.
async function _sendAppMail({ to, subject, text, html }) {
  const raw = getSetting('smtp_config')
  if (!raw) throw new Error('Todavía no se configuró el correo emisor en Ajustes')
  const cfg = JSON.parse(raw)
  if (!cfg.email || !cfg.appPassword) throw new Error('Falta completar la configuración SMTP en Ajustes')

  const transporter = nodemailer.createTransport({
    host: cfg.host || 'smtp.gmail.com',
    port: cfg.port || 465,
    secure: (cfg.port || 465) === 465,
    auth: { user: cfg.email, pass: cfg.appPassword }
  })
  await transporter.sendMail({ from: `"iNOISE Control Bodega" <${cfg.email}>`, to, subject, text, html })
}

// ── Envío de credenciales al operador (correo) ───────────────────────────
// El admin acaba de crear/cambiar la contraseña de un usuario y quiere
// avisarle sus datos de acceso. La contraseña en texto plano solo existe
// en este momento (recién se hasheó) — el cliente la manda una única vez,
// nunca se guarda en texto plano en la base de datos.
app.post('/api/users/:id/send-credentials', requireAuth, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ ok: false, error: 'Solo el administrador puede hacer esto' })
  }
  const { password, accessUrl } = req.body || {}
  if (!password) return res.json({ ok: false, error: 'Falta la contraseña a enviar' })

  const usersResult = safe(() => loadUsers())
  const target = usersResult.ok ? usersResult.data.find(u => u.id === req.params.id) : null
  if (!target) return res.json({ ok: false, error: 'Usuario no encontrado' })
  if (!target.email) return res.json({ ok: false, error: 'Este usuario no tiene correo cargado' })

  try {
    const nombreCompleto = `${target.nombre} ${target.apellido}`.trim()
    await _sendAppMail({
      to: target.email,
      subject: 'Tus credenciales de acceso a iNOISE',
      text: `Hola ${nombreCompleto},\n\nSe creó tu cuenta en iNOISE Control Bodega.\n\nUsuario: ${target.username}\nContraseña: ${password}\n${accessUrl ? `\nAccedé desde: ${accessUrl}\n` : ''}\nPor seguridad, te recomendamos cambiar la contraseña la primera vez que ingreses.\n\n— iNOISE`,
      html: `<p>Hola <strong>${nombreCompleto}</strong>,</p><p>Se creó tu cuenta en <strong>iNOISE Control Bodega</strong>.</p><p><strong>Usuario:</strong> ${target.username}<br/><strong>Contraseña:</strong> ${password}</p>${accessUrl ? `<p>Accedé desde: <a href="${accessUrl}">${accessUrl}</a></p>` : ''}<p>Por seguridad, te recomendamos cambiar la contraseña la primera vez que ingreses.</p><p>— iNOISE</p>`
    })
    res.json({ ok: true })
  } catch (e) {
    console.error('[SMTP] Error enviando credenciales:', e.message)
    res.json({ ok: false, error: 'No se pudo enviar el correo: ' + e.message })
  }
})

// ── Recuperar contraseña olvidada ─────────────────────────────────────────
// Flujo estándar de "olvidé mi contraseña": el usuario pide un código, se le
// manda por correo (si tiene uno cargado), y con ese código puede fijar una
// contraseña nueva sin necesitar la anterior. Público (sin token) porque
// justamente se usa cuando no se puede iniciar sesión.
//
// Por seguridad no se revela si el usuario existe o no ni si tiene correo
// cargado — la respuesta es siempre la misma frase genérica. La única
// excepción real es cuando el correo emisor todavía no está configurado en
// Ajustes, porque eso no depende de qué usuario pidió el código.
app.post('/api/auth/forgot-password', authLimiter, async (req, res) => {
  const { username } = req.body || {}
  const generic = { ok: true, message: 'Si el usuario existe y tiene un correo cargado, le enviamos un código de verificación.' }
  if (!username) return res.json(generic)

  const raw = getSetting('smtp_config')
  if (!raw) return res.json({ ok: false, error: 'El envío de correo todavía no está configurado. Pedile a un administrador que lo configure en Ajustes, o que te restablezca la contraseña manualmente.' })

  const usersResult = safe(() => loadUsers())
  const target = usersResult.ok ? usersResult.data.find(u => u.username === username) : null
  if (!target || !target.email || target.active === false) return res.json(generic)

  try {
    const code = createPasswordReset(target.id)
    const nombreCompleto = `${target.nombre} ${target.apellido}`.trim()
    await _sendAppMail({
      to: target.email,
      subject: 'Código para recuperar tu contraseña — iNOISE',
      text: `Hola ${nombreCompleto},\n\nTu código para restablecer la contraseña es: ${code}\n\nVence en 15 minutos. Si vos no pediste este código, podés ignorar este correo.\n\n— iNOISE`,
      html: `<p>Hola <strong>${nombreCompleto}</strong>,</p><p>Tu código para restablecer la contraseña es:</p><p style="font-size:28px;font-weight:bold;letter-spacing:4px;">${code}</p><p>Vence en 15 minutos. Si vos no pediste este código, podés ignorar este correo.</p><p>— iNOISE</p>`
    })
    return res.json(generic)
  } catch (e) {
    console.error('[SMTP] Error enviando código de recuperación:', e.message)
    // Acá sí conviene avisar del error real — si no, el admin nunca se
    // entera de que el correo emisor está mal configurado.
    return res.json({ ok: false, error: 'No se pudo enviar el correo: ' + e.message })
  }
})

app.post('/api/auth/reset-password', authLimiter, async (req, res) => {
  const { username, code, newPassword } = req.body || {}
  if (!username || !code || !newPassword) {
    return res.json({ ok: false, error: 'Faltan datos' })
  }
  // Mismas reglas que en la creación/edición de usuario desde Ajustes.
  if (!_isStrongPassword(newPassword)) {
    return res.json({ ok: false, error: WEAK_PASSWORD_MSG })
  }

  const usersResult = safe(() => loadUsers())
  const target = usersResult.ok ? usersResult.data.find(u => u.username === username) : null
  // Mensaje genérico también acá — no revela si el usuario existe.
  const invalidMsg = { ok: false, error: 'Código inválido o vencido' }
  if (!target) return res.json(invalidMsg)

  const valid = safe(() => verifyAndConsumePasswordReset(target.id, code))
  if (!valid.ok || !valid.data) return res.json(invalidMsg)

  const result = await safeAsync(() => setUserPassword(target.id, newPassword))
  if (!result.ok) return res.json({ ok: false, error: result.error })
  res.json({ ok: true })
})

// ── Login de administrador desde un dispositivo NO confiable ─────────────
// Mismo espíritu que "olvidé mi contraseña", pero para iniciar sesión
// directamente (no cambia ninguna contraseña): el admin pide un código, le
// llega al correo, y lo usa una sola vez para entrar desde ese equipo.
// Público (sin token) — es justamente el mecanismo para entrar cuando la
// tarjeta Admin normal está restringida en este dispositivo.
app.post('/api/auth/admin-otp/request', authLimiter, async (req, res) => {
  const { username } = req.body || {}
  const generic = { ok: true, message: 'Si el usuario existe y tiene un correo cargado, le enviamos un código de acceso.' }
  if (!username) return res.json(generic)

  const raw = getSetting('smtp_config')
  if (!raw) return res.json({ ok: false, error: 'El envío de correo todavía no está configurado. Pedile al administrador que lo configure en Ajustes desde su propio equipo.' })

  const result = safe(() => createAdminLoginOtp(username))
  const otp = result.ok ? result.data : null
  if (!otp || !otp.user?.email) return res.json(generic)

  try {
    const nombreCompleto = `${otp.user.nombre} ${otp.user.apellido}`.trim()
    await _sendAppMail({
      to: otp.user.email,
      subject: 'Código de acceso de un solo uso — iNOISE',
      text: `Hola ${nombreCompleto},\n\nSe pidió iniciar sesión como Administrador desde un dispositivo nuevo.\n\nTu código de acceso es: ${otp.code}\n\nVence en 10 minutos y sirve una sola vez. Si vos no pediste este código, ignorá este correo y avisale a tu equipo.\n\n— iNOISE`,
      html: `<p>Hola <strong>${nombreCompleto}</strong>,</p><p>Se pidió iniciar sesión como Administrador desde un dispositivo nuevo.</p><p>Tu código de acceso es:</p><p style="font-size:28px;font-weight:bold;letter-spacing:4px;">${otp.code}</p><p>Vence en 10 minutos y sirve una sola vez. Si vos no pediste este código, ignorá este correo y avisale a tu equipo.</p><p>— iNOISE</p>`
    })
    return res.json(generic)
  } catch (e) {
    console.error('[SMTP] Error enviando código de acceso admin:', e.message)
    return res.json({ ok: false, error: 'No se pudo enviar el correo: ' + e.message })
  }
})

app.post('/api/auth/admin-otp/verify', authLimiter, (req, res) => {
  const { username, code } = req.body || {}
  if (!username || !code) return res.json({ ok: false, error: 'Faltan datos' })

  const result = safe(() => verifyAdminLoginOtp(username, code))
  const u = result.ok ? result.data : null
  if (!u) return res.json({ ok: false, error: 'Código inválido o vencido' })

  const token = jwt.sign(u, JWT_SECRET, { expiresIn: '12h' })
  const displayName = `${u.nombre} ${u.apellido}`.trim()
  const ip = req.ip || req.connection?.remoteAddress || null
  const sessionId = safe(() => createSession(u.id, u.username, displayName, ip)).data || null
  res.json({ ok: true, data: u, token, sessionId })
})

// ── Rutas de datos (inventario, eventos, etc.) ────────────────────────────────

app.get('/api/data', requireAuth, (req, res) => {
  res.json(safe(() => loadAll()))
})

app.put('/api/data/products', requireAuth, (req, res) => {
  const result = safe(() => saveProducts(req.body))
  if (result.ok) broadcast('products', req.body)
  res.json(result)
})

app.put('/api/data/events', requireAuth, (req, res) => {
  const result = safe(() => saveEvents(req.body))
  if (result.ok) broadcast('events', req.body)
  res.json(result)
})

app.put('/api/data/rentals', requireAuth, (req, res) => {
  const result = safe(() => saveRentals(req.body))
  if (result.ok) broadcast('rentals', req.body)
  res.json(result)
})

app.put('/api/data/op-states', requireAuth, (req, res) => {
  const result = safe(() => saveOpStates(req.body))
  if (result.ok) broadcast('opStates', req.body)
  res.json(result)
})

app.put('/api/data/epc-map', requireAuth, (req, res) => {
  const result = safe(() => saveEpcMap(req.body))
  if (result.ok) broadcast('epcMap', req.body)
  res.json(result)
})

app.put('/api/data/event-history', requireAuth, (req, res) => {
  const result = safe(() => saveEventHistory(req.body))
  if (result.ok) broadcast('eventHistory', req.body)
  res.json(result)
})

app.put('/api/data/rental-history', requireAuth, (req, res) => {
  const result = safe(() => saveRentalHistory(req.body))
  if (result.ok) broadcast('rentalHistory', req.body)
  res.json(result)
})

app.put('/api/data/purchase-history', requireAuth, (req, res) => {
  const result = safe(() => savePurchaseHistory(req.body))
  if (result.ok) broadcast('purchaseHistory', req.body)
  res.json(result)
})

app.put('/api/data/audit-log', requireAuth, (req, res) => {
  const result = safe(() => saveAuditLog(req.body))
  if (result.ok) broadcast('auditLog', req.body)
  res.json(result)
})

// ── Chat interno ──────────────────────────────────────────────────────────────

/** GET /api/chat/conversation?with=<userId> — mensajes con otro usuario */
app.get('/api/chat/conversation', requireAuth, (req, res) => {
  const { with: withUser } = req.query
  if (!withUser) return res.json({ ok: false, error: 'Falta parámetro "with"' })
  const result = safe(() => getConversation(req.user.id, withUser))
  res.json(result)
})

/** GET /api/chat/unread — cantidad total de mensajes sin leer, y desglosada por remitente */
app.get('/api/chat/unread', requireAuth, (req, res) => {
  const result = safe(() => countUnread(req.user.id))
  const bySenderResult = safe(() => countUnreadBySender(req.user.id))
  res.json({
    ok: true,
    count: result.ok ? result.data : 0,
    bySender: bySenderResult.ok ? bySenderResult.data : {}
  })
})

// Busca el socket activo de un usuario por su id (o null si no está conectado).
// Usado para entregar mensajes, avisos de "leído" y de "escribiendo..." en
// tiempo real, sin esperar a que el destinatario recargue o vuelva a pedir datos.
function findSocketByUserId(userId) {
  for (const [, data] of onlineUsers) {
    if (data.userId === userId) {
      return [...io.sockets.sockets.values()]
        .find(s => onlineUsers.get(s.id)?.userId === userId) || null
    }
  }
  return null
}

/** POST /api/chat/messages — enviar un mensaje */
app.post('/api/chat/messages', requireAuth, (req, res) => {
  const { toUser, content, type, metadata } = req.body || {}
  if (!toUser || !content) return res.json({ ok: false, error: 'toUser y content son obligatorios' })

  const result = safe(() => createMessage(req.user.id, toUser, content, type || 'text', metadata))
  if (!result.ok) return res.json(result)

  const msg = result.data
  // Parsear metadata para que llegue como objeto al frontend
  const outMsg = { ...msg, metadata: msg.metadata ? JSON.parse(msg.metadata) : null }

  // Entregar el mensaje en tiempo real al destinatario (si está conectado)
  const targetSocket = findSocketByUserId(toUser)
  if (targetSocket) targetSocket.emit('chat:message', outMsg)

  res.json({ ok: true, data: outMsg })
})

/** PATCH /api/chat/conversation/read?with=<userId> — marcar conversación como leída */
app.patch('/api/chat/conversation/read', requireAuth, (req, res) => {
  const { with: withUser } = req.query
  if (!withUser) return res.json({ ok: false, error: 'Falta parámetro "with"' })
  const result = safe(() => markConversationRead(req.user.id, withUser))
  if (result.ok) {
    // Avisar en tiempo real a quien mandó los mensajes que ya se leyeron —
    // así le puede mostrar el doble check en su lado sin tener que recargar.
    const senderSocket = findSocketByUserId(withUser)
    if (senderSocket) senderSocket.emit('chat:read', { by: req.user.id })
  }
  res.json(result)
})

// ── Info de red (sin auth — para que el frontend la lea antes de login) ───────

app.get('/api/info', (req, res) => {
  res.json({ ok: true, ip: getLocalIP(), port: PORT, version: '2.0.0' })
})

// ── Rutas de personal (staff) ─────────────────────────────────────────────────
// IMPORTANTE: deben registrarse ANTES del fallback SPA de abajo (app.get('*', ...)).
// Express hace match de rutas en el orden en que se registran, así que cualquier
// ruta GET definida después del comodín '*' nunca se alcanza (el comodín la
// intercepta primero). Esto causaba que GET /api/staff devolviera el JSON
// genérico { server: 'iNOISE', status: 'running' } del fallback en vez de la
// lista real de personal.
app.get('/api/staff', requireAuth, (_req, res) => {
  res.json(safe(() => loadStaff()))
})

// Crear/editar/borrar personal es acción exclusiva del admin — la UI ya
// oculta la sección Personal a los operadores (Sidebar.jsx adminOnly), pero
// estas rutas no lo verificaban del lado del servidor, así que cualquier
// operador podía escribir en /api/staff llamándolo directo. Igual que ya
// se corrigió antes para /api/users/*.
app.post('/api/staff', requireAuth, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ ok: false, error: 'Solo el administrador puede hacer esto' })
  }
  const { nombre, apellido, rut, telefono, cargo } = req.body
  if (!nombre || !apellido) return res.status(400).json({ ok: false, error: 'Nombre y apellido requeridos' })
  res.json(safe(() => createStaff({ nombre, apellido, rut, telefono, cargo })))
})

app.put('/api/staff/:id', requireAuth, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ ok: false, error: 'Solo el administrador puede hacer esto' })
  }
  const { nombre, apellido, rut, telefono, cargo, activo } = req.body
  res.json(safe(() => { updateStaff(req.params.id, { nombre, apellido, rut, telefono, cargo, activo }); return true }))
})

app.delete('/api/staff/:id', requireAuth, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ ok: false, error: 'Solo el administrador puede hacer esto' })
  }
  res.json(safe(() => { deleteStaff(req.params.id); return true }))
})

// ── SPA fallback — todas las rutas no-API sirven el index.html de React ───────

app.get('*', (req, res) => {
  const indexPath = path.join(distPath, 'index.html')
  res.sendFile(indexPath, (err) => {
    if (err) res.status(200).json({ server: 'iNOISE', status: 'running' })
  })
})

// ── Socket.io ─────────────────────────────────────────────────────────────────

io.on('connection', (socket) => {
  console.log('[iNOISE] Cliente conectado:', socket.id)

  // Snapshot inicial de qué está siendo editado ahora mismo por cualquiera,
  // para que un cliente que recién abre la app (o entra a Productos más
  // tarde) vea de entrada los avisos "Fulano está editando esto" sin tener
  // que esperar a que alguien más toque algo.
  socket.emit('locks:sync', serializeLocks())

  // El cliente envía su token después de conectar (o al reconectar).
  // Se valida y se registra como "online". El sessionId se asocia al
  // socket para poder cerrarlo si el cliente se desconecta abruptamente.
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
      console.log(`[iNOISE] Online: ${displayName} (${socket.id})`)
    } catch {
      // Token inválido — ignorar silenciosamente
    }
  })

  // El cliente cierra sesión limpiamente → quitar de online
  socket.on('user:deauthenticate', () => {
    onlineUsers.delete(socket.id)
    io.emit('online:users', getOnlineList())
  })

  // ── Chat: "escribiendo..." ──
  // No se guarda en la base de datos — es un estado de un instante, se
  // reenvía en vivo solo a la persona con la que se está chateando.
  socket.on('chat:typing', ({ to, isTyping } = {}) => {
    const sender = onlineUsers.get(socket.id)
    if (!sender || !to) return
    const targetSocket = findSocketByUserId(to)
    if (targetSocket) targetSocket.emit('chat:typing', { from: sender.userId, isTyping: !!isTyping })
  })

  // ── Locks de edición ──
  // Un cliente pide "reservar" una entidad (ej. { entityType:'product',
  // entityId: 42 }) justo al abrir el modal de edición. Si ya está tomada
  // por OTRO usuario, se le avisa solo a quien pidió (lock:denied) y no se
  // otorga. Si está libre, o ya era suya (otra pestaña del mismo usuario),
  // se otorga y se avisa a TODOS (lock:acquired) para que el resto vea el
  // aviso en pantalla.
  socket.on('lock:acquire', ({ entityType, entityId } = {}) => {
    if (!entityType || entityId === undefined || entityId === null) return
    const requester = onlineUsers.get(socket.id)
    if (!requester) return // no autenticado todavía — no se otorgan locks
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

  // El cliente libera al guardar, cancelar o cerrar el modal de edición.
  socket.on('lock:release', ({ entityType, entityId } = {}) => {
    if (!entityType || entityId === undefined || entityId === null) return
    const key = `${entityType}:${entityId}`
    const existing = editLocks.get(key)
    // Solo el socket que la tomó puede liberarla (evita que un cliente
    // libere por error una reserva de otro).
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
      console.log(`[iNOISE] Offline: ${data.displayName || data.username} (${reason})`)
    } else {
      console.log('[iNOISE] Cliente desconectado:', socket.id)
    }
    // Si el cliente se desconecta (cerró la app, se cayó la red) sin
    // liberar prolijamente sus locks, se liberan igual acá — si no,
    // un producto quedaría "bloqueado" para siempre.
    for (const [key, lock] of editLocks.entries()) {
      if (lock.socketId === socket.id) {
        editLocks.delete(key)
        io.emit('lock:released', { entityType: lock.entityType, entityId: lock.entityId })
      }
    }
  })
})

// ── Utilidades de red ─────────────────────────────────────────────────────────

function getLocalIP() {
  const ifaces = os.networkInterfaces()
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address
    }
  }
  return 'localhost'
}

// ── Arranque ──────────────────────────────────────────────────────────────────

// Limpiar sesiones sin cerrar de ejecuciones previas (el servidor reinició
// y esas sesiones nunca recibirán un logout explícito).
try { closeAllOpenSessions() } catch {}

function startServer() {
  return new Promise((resolve, reject) => {
    // '::' acepta conexiones IPv4 e IPv6 en Windows (dual-stack).
    // Necesario porque en Windows 'localhost' puede resolverse a ::1 (IPv6).
    server.listen(PORT, '::', () => {
      const ip = getLocalIP()
      console.log(`[iNOISE] Servidor en http://localhost:${PORT}`)
      console.log(`[iNOISE] Red local:  http://${ip}:${PORT}`)
      resolve({ port: PORT, ip, localUrl: `http://localhost:${PORT}`, networkUrl: `http://${ip}:${PORT}` })
    })
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        // Fallback a IPv4 puro si IPv6 dual-stack no está disponible
        const s2 = http.createServer(app)
        s2.listen(PORT, '0.0.0.0', () => {
          const ip = getLocalIP()
          resolve({ port: PORT, ip, localUrl: `http://localhost:${PORT}`, networkUrl: `http://${ip}:${PORT}` })
        })
        s2.on('error', reject)
      } else {
        reject(err)
      }
    })
  })
}

module.exports = { startServer, getLocalIP, PORT }
