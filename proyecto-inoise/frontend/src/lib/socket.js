/**
 * frontend/src/lib/socket.js
 *
 * Singleton de Socket.io-client.
 * Conecta al backend en la nube (cloud-backend/, Railway) para recibir
 * actualizaciones en tiempo real cuando otro operador modifica datos —
 * mismo backend que usa lib/api.js, ya no el servidor embebido en Electron.
 * (3001/3002 son puertos aparte, del rfid-bridge LOCAL — ver
 * server/rfid-bridge.js — eso sigue siendo siempre localhost)
 *
 * Uso:
 *   import { getSocket } from '../lib/socket'
 *   const sock = getSocket()
 *   sock.on('data:sync', ({ entity, data }) => { ... })
 *
 * Eventos emitidos por el servidor:
 *   data:sync   → { entity: string, data: any }  — una entidad cambió
 *   users:updated → (sin payload) — lista de usuarios cambió
 */

import { io } from 'socket.io-client'

let socket = null

const PROD_API_URL = 'https://proyecto-bodega-antenas-production.up.railway.app'
// En dev, el proxy de Vite redirige /socket.io → un cloud-backend local
// (localhost:3005). En producción, al backend real en Railway.
const _socketUrl = import.meta.env.DEV ? '/' : (import.meta.env.VITE_API_URL || PROD_API_URL)

/**
 * Devuelve (o crea) la instancia única de Socket.io.
 */
export function getSocket() {
  if (!socket) {
    socket = io(_socketUrl, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000
    })

    socket.on('connect', () => {
      console.log('[Socket.io] Conectado al servidor iNOISE')
    })

    socket.on('disconnect', (reason) => {
      console.log('[Socket.io] Desconectado:', reason)
    })

    socket.on('connect_error', (err) => {
      console.warn('[Socket.io] Error de conexión:', err.message)
    })
  }
  return socket
}

/**
 * Registra al usuario como "online" en el servidor.
 * Llamar justo después de un login exitoso o al reconectar si ya hay sesión.
 * @param {string} token  JWT activo
 * @param {string|null} sessionId  ID de la sesión creada en el login (puede ser null en recargas)
 */
export function authenticateSocket(token, sessionId = null) {
  const sock = getSocket()
  sock.emit('user:authenticate', { token, sessionId })
}

/**
 * Avisa al servidor que el usuario cerró sesión → quitar del mapa de online.
 */
export function deauthenticateSocket() {
  if (socket) {
    socket.emit('user:deauthenticate')
  }
}

/**
 * Desconecta y destruye el socket (usar solo al cerrar la app).
 */
export function disconnectSocket() {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}
