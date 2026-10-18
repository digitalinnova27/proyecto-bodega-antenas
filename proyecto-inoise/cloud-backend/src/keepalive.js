// cloud-backend/src/keepalive.js
//
// Supabase pausa un proyecto del plan gratuito tras ~1 semana sin
// actividad real contra la base. cloud-backend corre 24/7 en Railway, así
// que basta con mandarle una consulta liviana cada cierto tiempo para que
// nunca llegue a esa semana de silencio — independiente de que el cliente
// use la app o no.
//
// Separado a propósito del respaldo diario (backup.js): aunque el
// respaldo falle o se desactive en el futuro, este heartbeat sigue
// funcionando solo, porque cumple un propósito distinto.

const { prisma } = require('./db')

const INTERVAL_MS = 12 * 60 * 60 * 1000 // cada 12 horas — muy por debajo de la ventana de 1 semana

async function pingOnce() {
  try {
    await prisma.$queryRaw`SELECT 1`
    console.log('[Keepalive] Ping a Supabase OK —', new Date().toISOString())
  } catch (e) {
    console.error('[Keepalive] Error al hacer ping a Supabase:', e.message)
  }
}

function startKeepalive() {
  pingOnce() // uno al arrancar, no hace falta esperar 12h para el primero
  setInterval(pingOnce, INTERVAL_MS)
  console.log('[Keepalive] Programado cada 12h para evitar el auto-pausado de Supabase')
}

module.exports = { startKeepalive }
