# Instalar el Gateway RFID como servicio de Windows

Esto deja el gateway corriendo siempre, desde que se prende la PC, aunque
nadie abra Orbitag ni inicie sesión en Windows. Se instala **una sola vez**
en la PC que tiene las antenas conectadas.

## 1. Requisitos

- Node.js instalado en esa PC (si `node -v` en una terminal no muestra una
  versión, instalarlo primero desde https://nodejs.org, versión LTS).
- Permisos de Administrador en Windows (se necesitan para instalar el
  servicio, no para usarlo día a día).

## 2. Instalar las dependencias del gateway

Abrir una terminal (PowerShell o CMD) en esta carpeta (`rfid-gateway`) y
ejecutar:

```
npm install
```

## 3. Configurar la conexión a la nube

Copiar `.env.example` como `.env` en esta misma carpeta, y completar:

- `CLOUD_URL`: la URL del backend en Railway (ya viene con el valor
  correcto por defecto).
- `GATEWAY_TOKEN`: un secreto largo y aleatorio. Generarlo con:
  ```
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
  Ese MISMO valor hay que pegarlo también en Railway → proyecto
  `cloud-backend` → pestaña **Variables** → agregar `GATEWAY_TOKEN` con el
  mismo secreto. Si no coinciden exactamente, el gateway sigue funcionando
  local pero no reenvía nada a la nube (y lo avisa en la consola).

Si no se completa este paso, el gateway sigue funcionando igual para la
PC de las antenas — simplemente no reenvía las lecturas a otras PCs.

## 4. Instalar NSSM (el "envoltorio" que lo vuelve un servicio de Windows)

1. Descargar NSSM desde https://nssm.cc/download (elegir la versión
   estable, descomprimir el .zip).
2. Copiar `nssm.exe` (de la carpeta `win64`) a una ubicación fija, por
   ejemplo `C:\nssm\nssm.exe`.

## 5. Crear el servicio

Abrir una terminal **como Administrador** (clic derecho → "Ejecutar como
administrador") y ejecutar, reemplazando las rutas si corresponde:

```
C:\nssm\nssm.exe install OrbitagRfidGateway
```

Se abre una ventana. Completar:

- **Path**: la ruta a `node.exe` (normalmente `C:\Program Files\nodejs\node.exe`)
- **Startup directory**: la ruta completa a esta carpeta `rfid-gateway`
  (ej. `C:\Proyecto\proyecto-bodega-antenas\proyecto-inoise\rfid-gateway`)
- **Arguments**: `index.js`

En la pestaña **Details**, se puede poner un nombre descriptivo como
"Orbitag — Gateway RFID".

Guardar. Luego iniciar el servicio:

```
C:\nssm\nssm.exe start OrbitagRfidGateway
```

## 6. Verificar que quedó funcionando

- Windows → "Servicios" (services.msc) → buscar "OrbitagRfidGateway" →
  debe decir "En ejecución".
- Reiniciar la PC y confirmar que el servicio arranca solo, sin que nadie
  tenga que abrir nada.
- Abrir Orbitag normalmente: Antenas y Registrar RFID deben seguir
  funcionando igual que antes.

## Comandos útiles

```
C:\nssm\nssm.exe stop OrbitagRfidGateway     # Detener
C:\nssm\nssm.exe restart OrbitagRfidGateway  # Reiniciar (ej. tras cambiar .env)
C:\nssm\nssm.exe remove OrbitagRfidGateway   # Desinstalar el servicio
```

Los logs se ven con `services.msc` → propiedades del servicio, o
corriendo `node index.js` manualmente en una terminal para ver la consola
en vivo mientras se prueba.
