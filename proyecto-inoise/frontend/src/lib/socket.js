/**
 * frontend/src/lib/socket.js
 *
 * Singleton de Socket.io-client.
 * Conecta al servidor embebido en Electron (puerto 3001) para recibir
 * actualizaciones en tiempo real cuando otro operador/cliente modifica datos.
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

/**
 * Devuelve (o crea) la instancia única de Socket.io.
 * En dev, el proxy de Vite redirige /socket.io → 3001.
 * En prod y browsers de red, misma origin.
 */
export function getSocket() {
  if (!socket) {
    socket = io('/', {
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
