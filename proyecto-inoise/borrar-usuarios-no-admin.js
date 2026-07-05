/**
 * borrar-usuarios-no-admin.js
 *
 * Elimina todos los usuarios que NO son administrador (role != 'admin'),
 * junto con sus sesiones y mensajes de chat. El admin queda intacto.
 *
 * Uso (la app debe estar CERRADA):
 *   node --experimental-sqlite borrar-usuarios-no-admin.js
 *
 * Requiere Node.js 22.5+ (que es el caso si tienes Node 23.x)
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
  console.error('❌  Base de datos no encontrada en:\n   ', DB_PATH)
  process.exit(1)
}

const db = new DatabaseSync(DB_PATH)

// Ver usuarios actuales
const antes = db.prepare("SELECT id, role, username, nombre FROM users").all()
console.log('\n📋  Usuarios actuales:')
antes.forEach(u => {
  const tag = u.role === 'admin' ? '👑 ADMIN (se conserva)' : '🗑  será eliminado'
  console.log(`   [${u.role}]  ${u.username}  —  ${u.nombre}   ${tag}`)
})

const toDelete = antes.filter(u => u.role !== 'admin').map(u => u.id)

if (toDelete.length === 0) {
  console.log('\n✅  No hay usuarios no-admin. Nada que borrar.')
  db.close()
  process.exit(0)
}

// Borrar en cascada (sessions, messages, luego users)
db.exec('PRAGMA foreign_keys = OFF')

let sesiones = 0, mensajes = 0, usuarios = 0
for (const id of toDelete) {
  sesiones += db.prepare("DELETE FROM sessions WHERE user_id = ?").run(id).changes
  mensajes += db.prepare("DELETE FROM messages WHERE sender_id = ?").run(id).changes
  usuarios += db.prepare("DELETE FROM users WHERE id = ? AND role != 'admin'").run(id).changes
}

db.exec('PRAGMA foreign_keys = ON')
db.close()

console.log('\n✅  Borrado completado:')
console.log(`   • Usuarios eliminados : ${usuarios}`)
console.log(`   • Sesiones eliminadas : ${sesiones}`)
console.log(`   • Mensajes eliminados : ${mensajes}`)

// Verificar resultado
const db2    = new DatabaseSync(DB_PATH)
const despues = db2.prepare("SELECT role, username, nombre FROM users").all()
db2.close()

console.log('\n📋  Usuarios restantes:')
despues.forEach(u => console.log(`   [${u.role}]  ${u.username}  —  ${u.nombre}`))
console.log('\n🚀  Listo. Abre la app y crea el usuario de prueba desde cero.\n')
