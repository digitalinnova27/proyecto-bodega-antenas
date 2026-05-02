# iNoise - Sistema de Inventario RFID

## ¿Qué cambió?

Se reemplazó el mockData con los **88 productos reales** del archivo `backend/1.Gestion de Inventario.xlsx`.

### Categorías mapeadas (Excel → App)
| Excel | App |
|-------|-----|
| AUDIO | Audio (17 productos) |
| ILUMINACION | Iluminacion (21 productos) |
| EFECTOS | Efectos (11 productos) |
| ESTRUCTURA | Estructuras (24 productos) |
| ENERGÍA | Energía (10 productos) |
| TECNOLOGIA | Tecnologia (3 productos) |
| OTROS | Otros (2 productos) |

---

## Opción A: Solo Frontend (sin backend real)
Los datos del Excel se cargan directamente en el frontend via `src/excelData.js`.

```bash
cd frontend
npm install
npm run dev
```

Abre http://localhost:5173 — verás los 88 productos reales.

---

## Opción B: Con servidor Express (sin base de datos)
El servidor `server/index.js` tiene los 88 productos cargados en memoria.

```bash
# Terminal 1 - Backend
npm install   # en raíz del proyecto
node server/index.js

# Terminal 2 - Frontend
cd frontend
npm install
npm run dev
```

---

## Opción C: Con base de datos Prisma (requiere PostgreSQL)
```bash
cd backend
npm install
# Crea un archivo .env con: DATABASE_URL="postgresql://user:pass@localhost:5432/inoise"
npx prisma migrate dev
node prisma/seed.js   # Importa los 88 productos desde el Excel a la BD
node index.js
```

---

## Flujo de eventos (sin cambios)
- Crear evento → asignar productos → se reservan automáticamente en inventario ✅
- El Excel se sincroniza con la sección inventario
