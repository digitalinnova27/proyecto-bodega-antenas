const { contextBridge, ipcRenderer } = require('electron')

window.addEventListener('DOMContentLoaded', () => {
  console.log('Electron preload cargado')
})

/* contextIsolation está en true (ver main.js: createMainWindow), así que el
 * renderer (React) NO tiene acceso directo a Node ni a ipcRenderer — solo
 * puede usar lo que se expone explícitamente acá vía contextBridge.
 *
 * Ya no hay puente db:* ni config de modo servidor/cliente — los datos y el
 * tiempo real van directo al backend en la nube por HTTP/WebSocket desde el
 * frontend (ver lib/api.js, lib/socket.js), sin pasar por IPC de Electron.
 * Lo que queda acá es solo lo que necesita Node/el proceso main: identidad
 * del equipo y el ciclo de auto-actualización. */
contextBridge.exposeInMainWorld('api', {
  // Identificador único y persistente de este equipo — usado para saber si
  // es el dispositivo de confianza del administrador (ver Login.jsx).
  getDeviceId:    () => ipcRenderer.sendSync('get-device-id'),
  // Versión de la app
  getVersion: () => ipcRenderer.invoke('app:version'),
  // Progreso de descarga de actualización (pct: 0-100, o -1 cuando termina)
  onUpdateProgress: (cb) => ipcRenderer.on('update-progress', (_e, pct) => cb(pct)),
  // Update disponible: consulta al montar + escucha eventos futuros
  getPendingUpdate:     () => ipcRenderer.invoke('app:get-pending-update'),
  getFirstRunChangelog: () => ipcRenderer.invoke('app:get-pending-changelog'),
  onUpdateAvailable: (cb) => ipcRenderer.on('app:update-available', (_e, info) => cb(info))
})
