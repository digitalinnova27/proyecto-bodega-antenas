/**
 * frontend/src/lib/api.js
 *
 * Cliente HTTP centralizado para comunicarse con el servidor Express (puerto 3001).
 * Adjunta automáticamente el JWT en cada request.
 *
 * En desarrollo (Vite en 5173): el proxy de vite.config.js redirige /api → 3001.
 * En producción (build servido desde Express en 3001): misma origin, sin proxy.
 * En navegadores externos (http://192.168.x.x:3001): misma origin, sin proxy.
 */

// En modo servidor (o dev): URLs relativas → el proxy de Vite o Express mismo.
// En modo cliente: URL absoluta al servidor del admin (leída de inoise-config.json).
function _readConfig() {
  try { return (typeof window !== 'undefined' && window.api?.getConfig?.()) || {} } catch { return {} }
}
const _cfg = _readConfig()
const API_BASE = _cfg.mode === 'client' ? (_cfg.serverUrl || '') : ''

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
