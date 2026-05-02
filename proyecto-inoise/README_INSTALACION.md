# 🚀 Instalación y Ejecución — iNoise RFID

## Requisitos
- Node.js v18 o superior
- npm v9 o superior

---

## 📦 Instalación de dependencias

### 1. Instalar dependencias raíz (Electron + Vite)
```bash
cd proyecto-inoise
npm install
```

### 2. Instalar dependencias del frontend
```bash
cd frontend
npm install
cd ..
```

### 3. Instalar dependencias del backend (opcional, para API real)
```bash
cd backend
npm install
cd ..
```

---

## ▶️ Ejecutar la aplicación

### Opción A — App de Escritorio (Electron) — RECOMENDADO
Inicia Vite + Electron juntos con un solo comando:
```bash
npm run electron:dev
```
Esto levanta el servidor de desarrollo Vite y luego abre la ventana Electron automáticamente.

### Opción B — Solo el frontend en el navegador
```bash
npm run dev
```
Abre http://localhost:5173 en tu navegador.

### Opción C — Build de producción + Electron
```bash
npm run electron:build
```

---

## 🔑 Credenciales de acceso (demo)

| Rol           | Usuario   | Contraseña |
|---------------|-----------|------------|
| Administrador | admin     | ad123      |
| Operador      | operador  | ope123     |

> **Tip:** También puedes presionar **Enter** después de ingresar tu contraseña para iniciar sesión.

---

## ✨ Novedades de esta versión

### 1. Búsqueda de evento por número
- En la sección Eventos, ingresa el N° de orden (ej: `EVT-101`) en el campo de búsqueda y presiona **Buscar**.
- Se abre un modal con todos los detalles del evento y dos acciones:
  - **Descargar PDF** — genera el documento del evento.
  - **WhatsApp / Correo** — comparte los detalles del evento.

### 2. Login con Enter
- En la pantalla de inicio de sesión, escribe usuario y contraseña y presiona **Enter** para ingresar.

### 3. Electron mejorado
- La app detecta automáticamente si está en modo desarrollo o producción.
- Un solo comando `npm run electron:dev` lanza todo.

### 4. Deshacer Evento
- Cada evento tiene un botón **Deshacer** (ícono de papelera roja).
- Al confirmar, el evento se elimina y todos los equipos reservados vuelven a estar **Disponibles** en el inventario.
