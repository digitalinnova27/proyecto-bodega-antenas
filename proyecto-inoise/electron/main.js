const { app, BrowserWindow, shell, ipcMain } = require('electron')
const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')
const http = require('http')
const {
  getDb, closeDb, loadAll,
  saveProducts, saveEvents, saveRentals, saveOpStates,
  saveEpcMap, saveEventHistory, saveRentalHistory, savePurchaseHistory,
  saveAuditLog,
  loadUsers, createUser, updateUser, deleteUser, authLogin, countAdmins,
  setUserPin, removeUserPin, authLoginPin
} = require('./db')

/* ── Puente IPC para persistencia (paso 3) ──
 * El renderer (React, contextIsolation: true) no puede tocar better-sqlite3
 * directamente — solo el proceso main puede. Por eso cada operación de
 * lectura/escritura pasa por ipcMain.handle(...) acá, y el renderer las
 * invoca a través de window.api.* (expuesto en preload.js con
 * contextBridge). Todos los handlers de guardado usan el patrón
 * "reemplazar todo en una transacción" (ver electron/db.js) — son baratos
 * porque la app maneja cientos de filas, no millones.
 *
 * Si algo falla (ej. fila con dato inesperado), el catch evita que un IPC
 * roto tire abajo todo el proceso main; el renderer recibe { ok:false,
 * error } y puede decidir qué mostrarle al usuario, en vez de que la app
 * completa se cuelgue silenciosamente. */
function registerIpcHandlers() {
  const wrap = (fn) => async (_evt, ...args) => {
    try {
      const result = fn(...args)
      return { ok: true, data: result }
    } catch (e) {
      console.error('[IPC] Error:', e.message)
      return { ok: false, error: e.message }
    }
  }

  ipcMain.handle('db:load-all', wrap(() => loadAll()))
  ipcMain.handle('db:save-products', wrap((products) => saveProducts(products)))
  ipcMain.handle('db:save-events', wrap((events) => saveEvents(events)))
  ipcMain.handle('db:save-rentals', wrap((rentals) => saveRentals(rentals)))
  ipcMain.handle('db:save-op-states', wrap((opStates) => saveOpStates(opStates)))
  ipcMain.handle('db:save-epc-map', wrap((epcMap) => saveEpcMap(epcMap)))
  ipcMain.handle('db:save-event-history', wrap((list) => saveEventHistory(list)))
  ipcMain.handle('db:save-rental-history', wrap((list) => saveRentalHistory(list)))
  ipcMain.handle('db:save-purchase-history', wrap((list) => savePurchaseHistory(list)))
  ipcMain.handle('db:save-audit-log', wrap((list) => saveAuditLog(list)))

  // ── Usuarios (autenticación real) ──────────────────────────────────────
  ipcMain.handle('db:load-users', wrap(() => loadUsers()))
  ipcMain.handle('db:create-user', wrap((data, pass) => createUser(data, pass)))
  ipcMain.handle('db:update-user', wrap((id, fields, pass) => updateUser(id, fields, pass || null)))
  ipcMain.handle('db:delete-user', wrap((id) => deleteUser(id)))
  ipcMain.handle('db:auth-login', wrap((username, pass) => authLogin(username, pass)))
  ipcMain.handle('db:count-admins', wrap(() => countAdmins()))
  // ── PIN de acceso rápido ───────────────────────────────────────────────
  ipcMain.handle('db:set-user-pin', wrap((userId, pin) => setUserPin(userId, pin)))
  ipcMain.handle('db:remove-user-pin', wrap((userId) => removeUserPin(userId)))
  ipcMain.handle('db:auth-login-pin', wrap((userId, pin) => authLoginPin(userId, pin)))
}

let mainWindow
let splashWindow
let viteProcess = null

// Detecta si estamos en producción (con build) o desarrollo
const isDev = !app.isPackaged

function createSplash() {
  splashWindow = new BrowserWindow({
    width: 440,
    height: 380,
    frame: false,
    transparent: false,
    resizable: false,
    movable: false,
    alwaysOnTop: true,
    center: true,
    backgroundColor: '#000000',
    icon: path.join(__dirname, 'assets/icono.png')
  })
  splashWindow.loadFile(path.join(__dirname, 'splash.html'))
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    show: false,
    icon: path.join(__dirname, 'assets/icono.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.removeMenu()

  if (isDev) {
    // Modo desarrollo: carga desde el servidor de Vite, con reintentos
    // por si Vite todavía no terminó de levantar (evita pantalla en blanco).
    loadDevUrlWithRetry()
    // Si algo sigue sin cargar, las DevTools ayudan a ver el error real.
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    // Modo producción: carga el build estático
    mainWindow.loadFile(path.join(__dirname, '../frontend/dist/index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    if (splashWindow && !splashWindow.isDestroyed()) splashWindow.destroy()
    mainWindow.show()
    mainWindow.focus()
  })

  mainWindow.on('closed', () => { mainWindow = null })

  // Abrir links externos en el navegador del sistema
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
}

const DEV_URL = 'http://localhost:5173'

// Carga la URL de Vite y, si falla (porque el servidor aún no respondía),
// reintenta cada 1.5s en vez de dejar la ventana en blanco para siempre.
function loadDevUrlWithRetry(attemptsLeft = 20) {
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.loadURL(DEV_URL).catch(() => {
    if (attemptsLeft <= 0) {
      console.error('[Electron] No se pudo cargar Vite tras varios intentos.')
      return
    }
    setTimeout(() => loadDevUrlWithRetry(attemptsLeft - 1), 1500)
  })
}

// Espera a que Vite esté disponible antes de abrir la ventana
function waitForVite(url, retries = 40, delay = 1000) {
  return new Promise((resolve, reject) => {
    function tryConnect() {
      http.get(url, (res) => {
        resolve()
      }).on('error', () => {
        if (retries-- <= 0) return reject(new Error('Vite no inició a tiempo'))
        setTimeout(tryConnect, delay)
      })
    }
    tryConnect()
  })
}

app.whenReady().then(async () => {
  createSplash()

  // Abre/crea la base SQLite y corre las migraciones (CREATE TABLE IF NOT
  // EXISTS). Esto es solo el paso 1: deja la BD lista en disco. La lectura
  // y escritura real de datos (productos, eventos, etc.) se conecta en un
  // paso siguiente, vía IPC, desde InventoryContext.
  try {
    getDb()
    registerIpcHandlers()
  } catch (e) {
    console.error('[DB] Error al iniciar SQLite:', e.message)
  }

  // Iniciar rfid-bridge DENTRO del proceso de Electron (no como proceso
  // 'node.exe' aparte). Electron ya trae su propio Node embebido en el
  // proceso main, así que un require() normal corre el mismo código
  // (servidor UDP/WS/HTTP) sin depender de que la PC del usuario tenga
  // Node.js instalado por separado. Esto también evita el problema de que
  // spawn() no puede apuntar a un archivo empaquetado dentro de app.asar —
  // require() sí puede leer adentro del asar sin problema.
  const isWindows = process.platform === 'win32'
  const bridgePath = path.join(__dirname, '../server/rfid-bridge.js')
  if (fs.existsSync(bridgePath)) {
    try {
      require(bridgePath)
      console.log('[Electron] rfid-bridge iniciado dentro del proceso de Electron')
    } catch (e) {
      console.error('[Electron] Error al iniciar rfid-bridge:', e.message)
    }
  }

  if (isDev) {
    // Inicia Vite en segundo plano si no está corriendo.
    // IMPORTANTE: se usa "cwd" en vez de "--prefix <ruta>" como argumento.
    // Pasar una ruta con espacios (ej. "Central Gamer") dentro de args[]
    // junto con shell:true es justo lo que rompía el arranque de Vite en
    // silencio (Node ni siquiera lograba ejecutar el comando) — por eso
    // la ventana de Electron quedaba en blanco sin ningún error visible.
    const frontendPath = path.join(__dirname, '../frontend')
    viteProcess = spawn(isWindows ? 'npm.cmd' : 'npm', ['run', 'dev'], {
      cwd: frontendPath,
      shell: true,
      stdio: 'inherit',
      detached: false
    })
    viteProcess.on('error', (err) => {
      console.error('[Electron] Error al iniciar Vite:', err.message)
    })
    try {
      await waitForVite('http://localhost:5173')
    } catch (e) {
      console.error('No se pudo conectar a Vite:', e.message)
    }
  }

  // Mínimo 2s de splash para mostrar la pantalla de carga
  const elapsed = Date.now()
  const minSplash = 2000
  const remaining = minSplash - (Date.now() - elapsed)
  setTimeout(createMainWindow, Math.max(remaining, 0))
})

app.on('window-all-closed', () => {
  // El rfid-bridge ya no es un proceso aparte (ver arriba, ahora corre con
  // require() dentro de este mismo proceso) — al cerrar Electron, sus
  // servidores UDP/WS/HTTP mueren junto con el proceso main automáticamente,
  // no hace falta matarlo a mano.
  if (viteProcess) viteProcess.kill()
  closeDb()
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
})