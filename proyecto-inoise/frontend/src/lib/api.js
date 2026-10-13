/**
 * frontend/src/lib/api.js
 *
 * Cliente HTTP centralizado para comunicarse con el backend — cloud-backend/
 * (Express + Prisma + Postgres en Railway), ya no el servidor embebido en
 * Electron. Adjunta automáticamente el JWT en cada request.
 *
 * Toda instalación (Electron de escritorio o navegador) habla siempre con
 * el MISMO backend en la nube — ya no existe el "modo servidor/cliente" que
 * elegía a qué PC de la red local conectarse.
 *
 * En desarrollo (Vite en 5173): URLs relativas, el proxy de vite.config.js
 * redirige /api y /socket.io a un cloud-backend corriendo en localhost:3005
 * (correr `npm run dev` dentro de cloud-backend/ en paralelo).
 * En producción (build empaquetado): URL absoluta al backend real en
 * Railway, salvo que VITE_API_URL la sobreescriba (ej. para apuntar a un
 * backend de prueba sin tocar este archivo).
 *
 * (3001/3002 son puertos aparte, del rfid-bridge local — ver
 * server/rfid-bridge.js — ese sigue siendo siempre localhost, antenas
 * físicas conectadas a ESTE PC, nada que ver con el backend en la nube).
 */

const PROD_API_URL = 'https://proyecto-bodega-antenas-production.up.railway.app'
const API_BASE = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || PROD_API_URL)

// Token almacenado en memoria + sessionStorage para sobrevivir recargas
let _token = typeof sessionStorage !== 'undefined' ? (sessionStorage.getItem('inoise_token') || null) : null

export function setToken(token) {
  _token = token
  try { sessionStorage.setItem('inoise_token', token) } catch {}
}

export function getToken() {
  return _token
}

export function clearToken() {
  _token = null
  try { sessionStorage.removeItem('inoise_token') } catch {}
}

// ── Request base ──────────────────────────────────────────────────────────────

async function request(method, path, body) {
  const headers = { 'Content-Type': 'application/json' }
  if (_token) headers['Authorization'] = `Bearer ${_token}`

  const res = await fetch(API_BASE + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined
  })

  // Token vencido o inválido
  if (res.status === 401) {
    const hadToken = Boolean(_token)
    clearToken()
    // Solo recargar si había una sesión activa (token vencido en mid-session).
    // En first-run nunca hubo token, así que no recargar para evitar loop.
    if (hadToken && typeof window !== 'undefined') window.location.reload()
    throw new Error('Sesión expirada')
  }

  return res.json()
}

// ── API pública ───────────────────────────────────────────────────────────────

export const api = {
  get:    (path)        => request('GET',    path),
  post:   (path, body)  => request('POST',   path, body),
  put:    (path, body)  => request('PUT',    path, body),
  delete: (path)        => request('DELETE', path),
  patch:  (path, body)  => request('PATCH',  path, body),
}
