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
  savePurchaseHistory: (list) => ipcRenderer.invoke('db:save-purchase-history', list)
})
