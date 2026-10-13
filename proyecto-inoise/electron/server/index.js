/**
 * electron/server/index.js
 *
 * Antes: servidor Express + Socket.io completo (API de datos, auth, chat,
 * etc.), embebido en el proceso main de Electron, con SQLite como base de
 * datos local. Ahora ese rol lo cumple cloud-backend/ (Railway + Postgres)
 * — ver frontend/src/lib/api.js / lib/socket.js, que le hablan directo.
 *
 * Lo único que queda acá es servir el build del frontend (frontend/dist)
 * como archivos estáticos en localhost, para que la ventana de Electron
 * tenga un origen http:// real donde cargar la SPA (en vez de file://,
 * que trae sus propias limitaciones con fetch/CORS/Service Workers).
 * Las llamadas a la API y el socket de la página siguen yendo, cruzadas de
 * origen, al backend real en la nube — eso no cambia acá, es cosa del
 * frontend ya compilado.
 *
 * Por eso este servidor liga SOLO a localhost (127.0.0.1): ya no tiene
 * ningún motivo para ser alcanzable desde otros equipos de la red — cada
 * PC corre su propia copia de esto, sirviendo su propio frontend local,
 * todas hablando al mismo backend en la nube.
 */

const express = require('express')
const http    = require('http')
const path    = require('path')

const PORT = 3005

const app = express()
const server = http.createServer(app)

const distPath = __dirname.includes('app.asar')
  ? path.join(process.resourcesPath, 'app.asar.unpacked', 'frontend', 'dist')
  : path.join(__dirname, '../../frontend/dist')
app.use(express.static(distPath))

// SPA fallback — cualquier ruta no estática sirve el index.html de React
// (el ruteo real lo hace react-router del lado del cliente).
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'))
})

function startServer() {
  return new Promise((resolve, reject) => {
    server.listen(PORT, '127.0.0.1', () => {
      console.log(`[Orbitag] Frontend local servido en http://localhost:${PORT}`)
      resolve({ port: PORT, localUrl: `http://localhost:${PORT}` })
    })
    server.on('error', reject)
  })
}

module.exports = { startServer, PORT }
