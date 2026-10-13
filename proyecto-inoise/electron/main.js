const { app, BrowserWindow, shell, ipcMain, dialog } = require('electron')
const { autoUpdater } = require('electron-updater')
const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')
const http = require('http')

// ── Identificador único de este equipo (para el dispositivo de confianza
//    del administrador) ─────────────────────────────────────────────────
// Persiste en userData (sobrevive reinstalaciones y actualizaciones). Se
// sigue usando igual que antes: isTrustedDevice/setTrustedDeviceId ahora
// viven del lado del backend en la nube (cloud-backend/src/db.js), pero el
// concepto es el mismo — el frontend solo necesita poder leer un id estable
// de este equipo para mandarlo al hacer login.
function getDeviceIdPath() {
  return path.join(app.getPath('userData'), 'inoise-device-id.txt')
}

function getOrCreateDeviceId() {
  try {
    const p = getDeviceIdPath()
    if (fs.existsSync(p)) {
      const id = fs.readFileSync(p, 'utf8').trim()
      if (id) return id
    }
  } catch {}
  const id = require('crypto').randomUUID()
  try { fs.writeFileSync(getDeviceIdPath(), id, 'utf8') } catch {}
  return id
}

const { startServer, PORT: SERVER_PORT } = require('./server/index')

ipcMain.handle('app:version', () => app.getVersion())
ipcMain.handle('app:get-pending-update', () => pendingUpdate)
ipcMain.handle('app:get-pending-changelog', () => pendingChangelog)
ipcMain.on('get-device-id', (e) => { e.returnValue = getOrCreateDeviceId() })

let mainWindow
let splashWindow
let viteProcess = null
let pendingUpdate = null     // Guarda info del update disponible para que el renderer la consulte al montar
let pendingChangelog = null  // Novedades de la versión actual (primer arranque tras actualizar)

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
    // Modo producción: carga el build de React desde el servidor estático
    // local (ver electron/server/index.js) — las llamadas a datos/tiempo
    // real las hace el frontend ya compilado directo contra el backend en
    // la nube (ver frontend/src/lib/api.js), cruzando de origen.
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

// Carga el servidor estático local en producción con reintentos.
function loadProdUrlWithRetry(attemptsLeft = 20) {
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.loadURL(PROD_URL).catch(() => {
    if (attemptsLeft <= 0) {
      console.error('[Electron] No se pudo cargar el frontend local tras varios intentos.')
      dialog.showErrorBox(
        'Error al iniciar Orbitag',
        'No se pudo cargar la aplicación (puerto 3005, local).\n\n' +
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

app.whenReady().then(async () => {
  // ── Detectar primer arranque con nueva versión ────────────────────────────
  // Compara la versión actual con la última vista (version-seen.json en userData).
  // Si difieren, carga el changelog de esta versión y lo deja disponible para
  // que el renderer lo muestre en la campanita al montar. Luego actualiza el archivo.
  try {
    const versionSeenPath = path.join(app.getPath('userData'), 'version-seen.json')
    const currentVersion = app.getVersion()
    let lastSeen = null
    if (fs.existsSync(versionSeenPath)) {
      lastSeen = JSON.parse(fs.readFileSync(versionSeenPath, 'utf8')).version
    }
    if (lastSeen !== currentVersion) {
      const clPath = path.join(__dirname, 'changelog.json')
      if (fs.existsSync(clPath)) {
        const cl = JSON.parse(fs.readFileSync(clPath, 'utf8'))
        const changes = cl[currentVersion] || []
        if (changes.length) pendingChangelog = { version: currentVersion, changes, type: 'changelog' }
      }
      fs.writeFileSync(versionSeenPath, JSON.stringify({ version: currentVersion }))
    }
  } catch (e) {
    console.error('[FirstRun] Error al detectar versión:', e.message)
  }

  createSplash()

  // Servidor estático local, solo para servir el build de React en esta PC
  // (ver electron/server/index.js) — ya no hay datos ni Socket.io acá, eso
  // vive en el backend en la nube y el frontend le habla directo.
  try {
    const serverInfo = await startServer()
    console.log(`[Orbitag] Frontend local: ${serverInfo.localUrl}`)
  } catch (e) {
    console.error('[Orbitag] Error al iniciar el servidor local:', e.message)
    dialog.showErrorBox(
      'Error crítico al iniciar Orbitag',
      `No se pudo iniciar el servidor local.\n\nDetalle: ${e.message}\n\n` +
      'Solución: reinicia el computador y vuelve a abrir la app.\n' +
      'Si el problema persiste, contacta a soporte técnico.'
    )
  }

  // Iniciar rfid-bridge DENTRO del proceso de Electron (no como proceso
  // 'node.exe' aparte). Electron ya trae su propio Node embebido en el
  // proceso main, así que un require() normal corre el mismo código
  // (servidor UDP/WS/HTTP) sin depender de que la PC del usuario tenga
  // Node.js instalado por separado. Esto también evita el problema de que
  // spawn() no puede apuntar a un archivo empaquetado dentro de app.asar —
  // require() sí puede leer adentro del asar sin problema.
  //
  // Sigue siendo 100% local: lee las antenas físicas conectadas a ESTA PC
  // y expone WS/HTTP en localhost (3001/3002) para que el frontend las
  // consuma — eso no depende del backend en la nube ni cambia con esta
  // migración (ver Parte C del plan: el día que este bridge además reenvíe
  // las lecturas al backend en la nube, es un cambio aparte).
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
    const isWindows = process.platform === 'win32'
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
        // Leer changelog y guardar para que el renderer lo consulte
        let changes = []
        try {
          const clPath = path.join(__dirname, 'changelog.json')
          if (fs.existsSync(clPath)) {
            const cl = JSON.parse(fs.readFileSync(clPath, 'utf8'))
            changes = cl[info.version] || []
          }
        } catch {}

        pendingUpdate = { version: info.version, changes, type: 'update' }

        // Enviar al renderer (para la campanita de notificaciones)
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('app:update-available', pendingUpdate)
        }

        dialog.showMessageBox(mainWindow, {
          type: 'info',
          title: 'Nueva versión disponible',
          message: `Nueva versión ${info.version} disponible`,
          detail: `Orbitag tiene una actualización lista para descargar.\n\n¿Deseas descargar e instalar ahora?\n\nPuedes seguir usando la aplicación mientras se descarga en segundo plano.`,
          buttons: ['Descargar ahora', 'Más tarde'],
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
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
})
