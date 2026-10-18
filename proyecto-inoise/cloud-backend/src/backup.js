// cloud-backend/src/backup.js
//
// Respaldo automático diario de los datos de negocio — RNF-010 (ver SRS):
// a la fecha no hay ningún backup configurado de la base en Supabase (el
// plan gratuito/trial no incluye point-in-time recovery). Esto no reemplaza
// un backup real a nivel de base de datos (eso depende del plan de
// Supabase contratado), pero da una copia independiente y recuperable sin
// depender de Supabase/Railway en absoluto: se manda por correo como un
// archivo adjunto, usando el mismo SMTP que ya está configurado en Ajustes.
//
// Deliberadamente NO incluye: password_hash, pin_hash (recuperar cuentas ya
// tiene un flujo propio por correo — no hace falta que el hash viaje en un
// backup) ni la contraseña de aplicación SMTP guardada en app_settings.

const zlib = require('zlib')
const nodemailer = require('nodemailer')
const {
  prisma,
  loadProducts, loadEvents, loadRentals, loadOpStates, loadEpcMap,
  loadEventHistory, loadRentalHistory, loadPurchaseHistory, loadAuditLog,
  loadUsers, loadStaff, getSetting
} = require('./db')

async function _loadSessionsRedacted() {
  const rows = await prisma.session.findMany()
  return rows.map(s => ({ id: s.id, userId: s.userId, username: s.username, displayName: s.displayName, loginAt: s.loginAt, logoutAt: s.logoutAt, ip: s.ip }))
}

async function _loadMessagesRedacted() {
  const rows = await prisma.message.findMany()
  return rows.map(m => ({ id: m.id, fromUser: m.fromUser, toUser: m.toUser, content: m.content, type: m.type, createdAt: m.createdAt, readAt: m.readAt }))
}

async function buildBackupPayload() {
  const [
    products, events, rentals, opStates, epcMap,
    eventHistory, rentalHistory, purchaseHistory, auditLog,
    users, staff, sessions, messages, smtpRaw
  ] = await Promise.all([
    loadProducts(), loadEvents(), loadRentals(), loadOpStates(), loadEpcMap(),
    loadEventHistory(), loadRentalHistory(), loadPurchaseHistory(), loadAuditLog(),
    loadUsers(), loadStaff(), _loadSessionsRedacted(), _loadMessagesRedacted(),
    getSetting('smtp_config')
  ])

  // smtp_config se incluye solo para saber QUÉ correo está configurado como
  // emisor (útil al restaurar), nunca la contraseña de aplicación.
  let smtpEmail = null
  try { smtpEmail = smtpRaw ? JSON.parse(smtpRaw).email || null : null } catch {}

  return {
    generatedAt: new Date().toISOString(),
    schemaVersion: 1,
    products, events, rentals, opStates, epcMap,
    eventHistory, rentalHistory, purchaseHistory, auditLog,
    users, staff, sessions, messages,
    settings: { smtpEmail }
  }
}

async function _sendBackupMail({ to, filename, gz }) {
  const raw = await getSetting('smtp_config')
  if (!raw) throw new Error('No hay SMTP configurado en Ajustes — no se puede enviar el respaldo')
  const cfg = JSON.parse(raw)
  if (!cfg.email || !cfg.appPassword) throw new Error('Falta completar la configuración SMTP en Ajustes')

  const transporter = nodemailer.createTransport({
    host: cfg.host || 'smtp.gmail.com',
    port: cfg.port || 465,
    secure: (cfg.port || 465) === 465,
    auth: { user: cfg.email, pass: cfg.appPassword }
  })
  await transporter.sendMail({
    from: `"Orbitag — Respaldo" <${cfg.email}>`,
    to: to || cfg.email,
    subject: `Respaldo Orbitag — ${new Date().toISOString().slice(0, 10)}`,
    text: 'Respaldo diario automático de inventario, operaciones y usuarios (sin contraseñas). Adjunto en formato JSON comprimido (.json.gz).',
    attachments: [{ filename, content: gz }]
  })
}

/** Corre el respaldo una vez: arma el JSON, lo comprime y lo manda por correo. */
async function runBackup({ to } = {}) {
  const payload = await buildBackupPayload()
  const json = JSON.stringify(payload)
  const gz = zlib.gzipSync(Buffer.from(json, 'utf8'))
  const filename = `orbitag-backup-${payload.generatedAt.slice(0, 10)}.json.gz`
  await _sendBackupMail({ to, filename, gz })
  return { filename, sizeBytes: gz.length, rows: {
    products: payload.products.length, events: payload.events.length, rentals: payload.rentals.length,
    users: payload.users.length, auditLog: payload.auditLog.length
  } }
}

const DAY_MS = 24 * 60 * 60 * 1000

/** Arranca el respaldo automático diario. Se llama una vez al iniciar el servidor. */
function startDailyBackup() {
  setInterval(() => {
    runBackup().then(r => console.log('[Backup] Enviado:', r.filename, r.sizeBytes, 'bytes'))
      .catch(e => console.error('[Backup] Error en el respaldo automático:', e.message))
  }, DAY_MS)
  console.log('[Backup] Respaldo diario programado (cada 24h, por correo)')
}

module.exports = { runBackup, startDailyBackup }
