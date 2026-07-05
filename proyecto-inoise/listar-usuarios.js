/**
 * listar-usuarios.js
 * Muestra todos los usuarios de la DB con su username, rol y hash de contraseña.
 *
 * Uso (cierra la app primero):
 *   node --experimental-sqlite listar-usuarios.js
 */

const { DatabaseSync } = require('node:sqlite')
const path = require('path')
const os   = require('os')
const fs   = require('fs')

const DB_PATH = path.join(
  os.homedir(),
  'AppData', 'Roaming', 'rfid-dashboard-final', 'inoise.db'
)

if (!fs.existsSync(DB_PATH)) {
  console.error('❌  DB no encontrada en:\n   ', DB_PATH)
  process.exit(1)
}

const db = new DatabaseSync(DB_PATH)

const users = db.prepare(
  "SELECT id, role, username, nombre, apellido, password_hash FROM users ORDER BY role, username"
).all()

db.close()

console.log(`\n📋  Usuarios en la DB (${users.length} total):\n`)
for (const u of users) {
  console.log(`  [${u.role.padEnd(8)}]  username: "${u.username}"  →  ${u.nombre} ${u.apellido}`)
  console.log(`             hash: ${u.password_hash?.slice(0, 30)}…\n`)
}
