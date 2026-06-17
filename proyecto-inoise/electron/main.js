const { app, BrowserWindow, shell } = require('electron')
const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')
const http = require('http')

let mainWindow
let splashWindow
let viteProcess = null
let bridgeProcess = null

// Detecta si estamos en producción (con build) o desarrollo
const isDev = !app.isPackaged

function createSplash() {
  splashWindow = new BrowserWindow({
    width: 420,
    height: 300,
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
    // Modo desarrollo: carga desde el servidor de Vite
    mainWindow.loadURL('http://localhost:5173')
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

  // Iniciar rfid-bridge en background
  const isWindows = process.platform === 'win32'
  const bridgePath = path.join(__dirname, '../server/rfid-bridge.js')
  if (fs.existsSync(bridgePath)) {
    bridgeProcess = spawn(isWindows ? 'node.exe' : 'node', [bridgePath], {
      shell: false,
      stdio: 'ignore',
      detached: false
    })
    console.log('[Electron] rfid-bridge iniciado en background')
  }

  if (isDev) {
    // Inicia Vite en segundo plano si no está corriendo
    viteProcess = spawn(isWindows ? 'npm.cmd' : 'npm', ['run', 'dev', '--prefix', path.join(__dirname, '../frontend')], {
      shell: true,
      stdio: 'inherit',
      detached: false
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
  if (bridgeProcess) bridgeProcess.kill()
  if (viteProcess) viteProcess.kill()
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
})
