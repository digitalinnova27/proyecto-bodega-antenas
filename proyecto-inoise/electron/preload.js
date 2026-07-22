const { contextBridge, ipcRenderer } = require('electron')

window.addEventListener('DOMContentLoaded', () => {
  console.log('Electron preload cargado')
})

/* ── Puente IPC de persistencia (paso 3) ──
 * contextIsolation está en true (ver main.js: createMainWindow), así que el
 * renderer (React) NO tiene acceso directo a Node ni a ipcRenderer — solo
 * puede usar lo que se expone explícitamente acá vía contextBridge. Esto es
 * intencional por seguridad: si una página remota o un bug en el renderer
 * intentara ejecutar código arbitrario, no podría tocar el sistema de
 * archivos del usuario, solo estas funciones puntuales de guardar/leer.
 *
 * window.api.loadAll()              → trae TODO el estado guardado en SQLite
 *                                      de una vez (se usa al montar la app).
 * window.api.save*(data)            → reemplaza esa entidad completa en la
 *                                      BD (ver electron/db.js, patrón
 *                                      "delete + reinsert en transacción").
 *
 * Todas devuelven una Promise que resuelve a { ok, data? , error? } —
 * nunca lanzan excepción hacia el renderer, así un fallo de IPC no rompe
 * la UI; el código que llama decide qué hacer si ok === false. */
contextBridge.exposeInMainWorld('api', {
  loadAll: () => ipcRenderer.invoke('db:load-all'),
  saveProducts: (products) => ipcRenderer.invoke('db:save-products', products),
  saveEvents: (events) => ipcRenderer.invoke('db:save-events', events),
  saveRentals: (rentals) => ipcRenderer.invoke('db:save-rentals', rentals),
  saveOpStates: (opStates) => ipcRenderer.invoke('db:save-op-states', opStates),
  saveEpcMap: (epcMap) => ipcRenderer.invoke('db:save-epc-map', epcMap),
  saveEventHistory: (list) => ipcRenderer.invoke('db:save-event-history', list),
  saveRentalHistory: (list) => ipcRenderer.invoke('db:save-rental-history', list),
  savePurchaseHistory: (list) => ipcRenderer.invoke('db:save-purchase-history', list),
  saveAuditLog: (list) => ipcRenderer.invoke('db:save-audit-log', list),
  // ── Usuarios ──────────────────────────────────────────────────────────
  loadUsers: () => ipcRenderer.invoke('db:load-users'),
  createUser: (data, pass) => ipcRenderer.invoke('db:create-user', data, pass),
  updateUser: (id, fields, pass) => ipcRenderer.invoke('db:update-user', id, fields, pass),
  deleteUser: (id) => ipcRenderer.invoke('db:delete-user', id),
  authLogin: (username, pass) => ipcRenderer.invoke('db:auth-login', username, pass),
  countAdmins: () => ipcRenderer.invoke('db:count-admins'),
  // ── PIN de acceso rápido ──────────────────────────────────────────────
  setUserPin: (userId, pin) => ipcRenderer.invoke('db:set-user-pin', userId, pin),
  removeUserPin: (userId) => ipcRenderer.invoke('db:remove-user-pin', userId),
  authLoginPin: (userId, pin) => ipcRenderer.invoke('db:auth-login-pin', userId, pin),
  // ── Personal (Staff) ─────────────────────────────────────────────────
  loadStaff:   () => ipcRenderer.invoke('db:load-staff'),
  createStaff: (data) => ipcRenderer.invoke('db:create-staff', data),
  updateStaff: (id, data) => ipcRenderer.invoke('db:update-staff', id, data),
  deleteStaff: (id) => ipcRenderer.invoke('db:delete-staff', id),
  // ── Info del servidor embebido (IP + puerto para conexión en red) ─────
  getServerInfo: () => ipcRenderer.invoke('server:info'),
  // ── Configuración de modo (servidor / cliente) ─────────────────────────
  // getConfig es síncrono para que api.js y socket.js puedan leerlo en tiempo
  // de módulo (antes del primer render), antes de que cualquier fetch ocurra.
  getConfig:      () => ipcRenderer.sendSync('get-config'),
  saveConfig:     (cfg) => ipcRenderer.invoke('save-config', cfg),
  verifyServer:   (url) => ipcRenderer.invoke('verify-server', url),
  // Auto-descubrimiento UDP: escucha broadcasts del servidor en la red local.
  // Resuelve { ok:true, url } si encuentra uno en 8s, { ok:false, error } si no.
  discoverServer: () => ipcRenderer.invoke('discover-server'),
  // Versión de la app
  getVersion: () => ipcRenderer.invoke('app:version'),
  // Progreso de descarga de actualización (pct: 0-100, o -1 cuando termina)
  onUpdateProgress: (cb) => ipcRenderer.on('update-progress', (_e, pct) => cb(pct))
})
