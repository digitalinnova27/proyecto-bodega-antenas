const { app, BrowserWindow, shell, ipcMain, dialog } = require('electron')
const { autoUpdater } = require('electron-updater')
const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')
const http = require('http')
const dgram = require('dgram')

// Puerto UDP para auto-descubrimiento en red local
const DISCOVERY_PORT = 3006

// ── Configuración persistente (inoise-config.json en userData) ────────────────
// Se escribe una sola vez en la pantalla de setup y se lee en cada arranque.
// userData sobrevive actualizaciones de la app y reinstalaciones.
function getConfigPath() {
  return path.join(app.getPath('userData'), 'inoise-config.json')
}

function readConfig() {
  try {
    const p = getConfigPath()
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'))
  } catch {}
  return {}
}

function writeConfig(cfg) {
  fs.writeFileSync(getConfigPath(), JSON.stringify(cfg, null, 2), 'utf8')
}
const {
  getDb, closeDb, loadAll,
  saveProducts, saveEvents, saveRentals, saveOpStates,
  saveEpcMap, saveEventHistory, saveRentalHistory, savePurchaseHistory,
  saveAuditLog,
  loadUsers, createUser, updateUser, deleteUser, authLogin, countAdmins,
  setUserPin, removeUserPin, authLoginPin,
  loadStaff, createStaff, updateStaff, deleteStaff
} = require('./db')
const { startServer, getLocalIP, PORT: SERVER_PORT } = require('./server/index')

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

  // ── Personal (Staff) ──────────────────────────────────────────────
  ipcMain.handle('db:load-staff', wrap(() => loadStaff()))
  ipcMain.handle('db:create-staff', wrap((data) => createStaff(data)))
  ipcMain.handle('db:update-staff', wrap((id, data) => updateStaff(id, data)))
  ipcMain.handle('db:delete-staff', wrap((id) => deleteStaff(id)))
}

// ── IPC de configuración de modo (sync para que el renderer pueda leerlo en
//    tiempo de módulo, antes del primer render) ─────────────────────────────
ipcMain.handle('app:version', () => app.getVersion())
ipcMain.on('get-config', (e) => { e.returnValue = readConfig() })

ipcMain.handle('save-config', (_e, cfg) => {
  try { writeConfig(cfg); return { ok: true } }
  catch (e) { return { ok: false, error: e.message } }
})

ipcMain.handle('verify-server', (_e, url) => {
  return new Promise((resolve) => {
    const req = http.get(`${url}/api/health`, { timeout: 5000 }, (res) => {
      let body = ''
      res.on('data', d => { body += d })
      res.on('end', () => {
        try {
          const json = JSON.parse(body)
          resolve({ ok: json.ok === true })
        } catch { resolve({ ok: false, error: 'Respuesta inválida del servidor' }) }
      })
    })
    req.on('error', (err) => resolve({ ok: false, error: err.message }))
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, error: 'Tiempo agotado (5s)' }) })
  })
})

// ── Auto-descubrimiento UDP ───────────────────────────────────────────────────
// El cliente escucha en el puerto UDP 3006 durante 8 segundos esperando que
// el servidor anuncie su URL. Si lo recibe resuelve { ok:true, url }, si no
// resuelve { ok:false, error }. Usado desde SetupScreen antes de que el usuario
// tenga que escribir la IP manualmente.
ipcMain.handle('discover-server', () => {
  return new Promise((resolve) => {
    // reuseAddr permite rebindear el puerto aunque un socket anterior esté
    // en estado de cierre — necesario cuando el usuario intenta varias veces
    const listener = dgram.createSocket({ type: 'udp4', reuseAddr: true })

    const timeout = setTimeout(() => {
      try { listener.close() } catch {}
      resolve({ ok: false, error: 'No se encontró servidor en la red (8s)' })
    }, 8000)

    listener.on('message', (msg) => {
      try {
        const data = JSON.parse(msg.toString())
        if (data.service === 'iNOISE' && data.url) {
          clearTimeout(timeout)
          try { listener.close() } catch {}
          resolve({ ok: true, url: data.url })
        }
      } catch {}
    })

    listener.on('error', (err) => {
      clearTimeout(timeout)
      try { listener.close() } catch {}
      resolve({ ok: false, error: err.message })
    })

    listener.bind(DISCOVERY_PORT, () => {
      // setBroadcast permite recibir paquetes de broadcast en este socket
      try { listener.setBroadcast(true) } catch {}
    })
  })
})

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
  splashWindow.loadFile(path.join(__dirname, 'splash.html'), {
    query: { version: app.getVersion() }
  })
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
    // Modo producción: carga desde el servidor Express embebido (mismo origen
    // que las llamadas API y socket.io — evita problemas de CORS con file://).
    loadProdUrlWithRetry()
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
const PROD_URL = `http://localhost:${SERVER_PORT}`

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

// Carga el servidor Express en producción con reintentos.
function loadProdUrlWithRetry(attemptsLeft = 20) {
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.loadURL(PROD_URL).catch(() => {
    if (attemptsLeft <= 0) {
      console.error('[Electron] No se pudo cargar el servidor Express tras varios intentos.')
      dialog.showErrorBox(
        'Error al iniciar iNOISE',
        'No se pudo conectar al servidor local (puerto 3005).\n\n' +
        'Posibles causas:\n' +
        '• Otro programa está usando el puerto 3005\n' +
        '• Error interno al iniciar la app\n\n' +
        'Solución: cierra la app, reinicia el computador y vuelve a abrirla.\n' +
        'Si el problema persiste, contacta a soporte técnico.'
      )
      return
    }
    setTimeout(() => loadProdUrlWithRetry(attemptsLeft - 1), 500)
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

// Almacena info del servidor para que el preload la pueda exponer al renderer
let serverInfo = null

app.whenReady().then(async () => {
  createSplash()

  // Leer configuración persistida para saber si este equipo es servidor o cliente
  const appConfig = readConfig()
  const isClientMode = appConfig.mode === 'client'

  if (isClientMode) {
    // ── Modo cliente ──────────────────────────────────────────────────────
    // Este equipo se conecta al servidor de otro PC. No inicializa SQLite
    // pero SÍ levanta Express en local para servir los archivos estáticos
    // de React (sin Express en localhost:3005 la ventana queda en blanco).
    console.log(`[iNOISE] Modo cliente → ${appConfig.serverUrl}`)
  } else {
    // ── Modo servidor (por defecto) ───────────────────────────────────────
    // 1. Inicializar SQLite y registrar handlers IPC
    try {
      getDb()
      registerIpcHandlers()
    } catch (e) {
      console.error('[DB] Error al iniciar SQLite:', e.message)
    }
  }

  // Express siempre arranca (modo servidor Y cliente) para servir los
  // archivos estáticos de React en localhost:3005. En modo cliente las
  // rutas /api/* no tienen datos locales — el frontend apunta al servidor
  // remoto directamente usando la URL guardada en la configuración.
  try {
    if (process.platform === 'win32') {
      const { execSync } = require('child_process')
      try {
        const out = execSync('netstat -ano 2>nul | findstr "3005"', { encoding: 'utf8', timeout: 3000 })
        const lines = out.split('\n').filter(l => l.includes('LISTENING'))
        for (const line of lines) {
          const pid = line.trim().split(/\s+/).pop()
          if (pid && !isNaN(pid) && Number(pid) !== process.pid) {
            try { execSync(`taskkill /F /PID ${pid}`, { timeout: 2000 }) } catch {}
            console.log(`[iNOISE] Proceso antiguo en 3005 (PID ${pid}) liberado`)
          }
        }
        await new Promise(r => setTimeout(r, 500))
      } catch {}
    }
  } catch {}

  try {
    serverInfo = await startServer()
    console.log(`[iNOISE] Servidor HTTP iniciado: ${serverInfo.networkUrl}`)

    // UDP broadcaster — solo si el modo es explícitamente 'server'.
    // En primer arranque (mode=undefined) NO se hace broadcast para evitar
    // que los PCs cliente en setup se auto-descubran a sí mismos.
    if (appConfig.mode === 'server') {
      const broadcaster = dgram.createSocket({ type: 'udp4', reuseAddr: true })
      broadcaster.on('error', (err) => {
        console.error('[UDP] Error en broadcaster:', err.message)
        try { broadcaster.close() } catch {}
      })
      broadcaster.bind(() => {
        broadcaster.setBroadcast(true)
        const msg = Buffer.from(JSON.stringify({ service: 'iNOISE', url: serverInfo.networkUrl }))
        setInterval(() => {
          broadcaster.send(msg, 0, msg.length, DISCOVERY_PORT, '255.255.255.255')
        }, 2000)
        console.log(`[iNOISE] UDP auto-descubrimiento activo → puerto ${DISCOVERY_PORT}`)
      })
    }
  } catch (e) {
    console.error('[iNOISE] Error al iniciar servidor HTTP:', e.message)
    dialog.showErrorBox(
      'Error crítico al iniciar iNOISE',
      `No se pudo iniciar el servidor interno.\n\nDetalle: ${e.message}\n\n` +
      'Solución: reinicia el computador y vuelve a abrir la app.\n' +
      'Si el problema persiste, contacta a soporte técnico.'
    )
  }

  // Abrir puerto 3005 (y 5173 en dev) en Windows Firewall para que otros
  // equipos en la red puedan conectarse. Si la regla ya existe o no hay
  // permisos, el error se ignora silenciosamente.
  if (process.platform === 'win32') {
    const { execSync } = require('child_process')
    const fwPorts = isDev ? ['3005', '5173'] : ['3005']
    for (const port of fwPorts) {
      try {
        execSync(
          `netsh advfirewall firewall add rule name="iNOISE-${port}" ` +
          `dir=in action=allow protocol=TCP localport=${port}`,
          { timeout: 4000, stdio: 'pipe' }
        )
        console.log(`[Firewall] Puerto ${port} abierto en Windows Firewall`)
      } catch {
        // Ya existe o sin permisos de administrador — no es crítico
      }
    }
  }

  // Abrir puerto UDP para auto-descubrimiento (necesario en servidor Y cliente)
  if (process.platform === 'win32') {
    const { execSync } = require('child_process')
    try {
      execSync(
        `netsh advfirewall firewall add rule name="iNOISE-UDP-${DISCOVERY_PORT}" ` +
        `dir=in action=allow protocol=UDP localport=${DISCOVERY_PORT}`,
        { timeout: 4000, stdio: 'pipe' }
      )
    } catch {}
  }

  // Exponer info del servidor al renderer via IPC.
  // webUrl  = URL para abrir en navegador (Vite en dev, Express en prod)
  // networkUrl = URL para conexión Electron cliente (siempre puerto 3005)
  ipcMain.handle('server:info', () => {
    const ip = getLocalIP()
    const base = serverInfo || { port: SERVER_PORT, ip, networkUrl: `http://${ip}:${SERVER_PORT}` }
    return {
      ...base,
      webUrl: isDev ? `http://${ip}:5173` : `http://${ip}:${SERVER_PORT}`
    }
  })

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
  setTimeout(() => {
    createMainWindow()

    // Auto-update: revisar en GitHub Releases al abrir (solo producción)
    if (!isDev) {
      // Desactivar descarga automática — el usuario elige cuándo actualizar
      autoUpdater.autoDownload = false
      autoUpdater.autoInstallOnAppQuit = false

      // ── Listeners ANTES de checkForUpdates (evita race condition) ──────
      autoUpdater.on('update-available', (info) => {
        dialog.showMessageBox(mainWindow, {
          type: 'info',
          title: 'Nueva versión disponible',
          message: `iNOISE Control Bodega v${info.version}`,
          detail: `Hay una nueva versión disponible.\n\n¿Deseas descargar e instalar la actualización ahora?\n\nPuedes seguir usando la aplicación mientras se descarga en segundo plano.`,
          buttons: ['Actualizar ahora', 'Más tarde'],
          defaultId: 0,
          cancelId: 1
        }).then(({ response }) => {
          if (response === 0) autoUpdater.downloadUpdate()
        })
      })

      autoUpdater.on('download-progress', (progress) => {
        const pct = Math.round(progress.percent)
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.setProgressBar(pct / 100)
          mainWindow.webContents.send('update-progress', pct)
        }
      })

      autoUpdater.on('update-downloaded', (info) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.setProgressBar(-1)
          mainWindow.webContents.send('update-progress', -1)
        }
        // Leer novedades desde changelog.json
        let novedades = ''
        try {
          const clPath = path.join(__dirname, 'changelog.json')
          if (fs.existsSync(clPath)) {
            const cl = JSON.parse(fs.readFileSync(clPath, 'utf8'))
            const items = cl[info.version]
            if (items?.length) {
              novedades = '\n\nNovedades en esta versión:\n' + items.map(i => `• ${i}`).join('\n')
            }
          }
        } catch {}

        dialog.showMessageBox(mainWindow, {
          type: 'info',
          title: '¡Actualización lista!',
          message: `Versión ${info.version} descargada`,
          detail: `La actualización está lista para instalar.\n\nLa aplicación se reiniciará para aplicar los cambios.${novedades}`,
          buttons: ['Reiniciar y actualizar', 'Más tarde'],
          defaultId: 0,
          cancelId: 1
        }).then(({ response }) => {
          if (response === 0) autoUpdater.quitAndInstall(false, true)
        })
      })

      autoUpdater.on('error', (err) => {
        console.error('[AutoUpdater] Error:', err.message)
      })

      // Verificar DESPUÉS de registrar todos los listeners
      autoUpdater.checkForUpdates().catch(err => {
        console.error('[AutoUpdater] Error al verificar actualizaciones:', err.message)
      })
    }
  }, Math.max(remaining, 0))
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