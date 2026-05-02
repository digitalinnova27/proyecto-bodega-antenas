# Guión — Video Tutorial iNOISE RFID
**Propósito:** Demo de venta a cliente potencial  
**Duración estimada:** 12–15 minutos  
**Herramienta sugerida:** Loom, OBS, o grabación de pantalla de Windows (Win+G)  
**Consejo:** Graba con el sistema en modo Administrador. Usa datos ficticios llamativos.

---

## INTRO (0:00 – 0:45)
**[Pantalla: logo o portada]**

> "Hola, bienvenido a iNOISE RFID — el sistema de gestión de inventario diseñado específicamente para empresas de producción de eventos en vivo. En este video te voy a mostrar cómo funciona el sistema de principio a fin: desde que creas un evento, hasta que el equipo regresa a bodega. Todo en tiempo real, sin papeles y sin errores."

---

## ESCENA 1 — Login (0:45 – 1:30)
**[Pantalla: Login]**

> "Al abrir el sistema, lo primero que ves es la pantalla de acceso. Tenemos dos perfiles: el Administrador, que tiene control total, y el Operador, que ejecuta las operaciones en terreno."

→ Haz clic en la card **Administrador**  
→ Escribe usuario: `admin` / contraseña: `ad123`  
→ Presiona **Enter**

> "El acceso es rápido. Nota que también puedes presionar Enter directamente, sin necesidad de hacer clic en el botón. Esto agiliza el trabajo en bodega donde el tiempo importa."

---

## ESCENA 2 — Dashboard (1:30 – 2:30)
**[Pantalla: Dashboard]**

> "El Dashboard es el centro de mando. De un vistazo puedes ver cuántos artículos están disponibles, cuántos están reservados para próximos eventos, y cuántos están en mantenimiento o se han reportado como perdidos."

→ Señala las tarjetas de resumen  
→ Muestra el sidebar izquierdo

> "En el menú lateral tienes acceso a todas las secciones del sistema: Inventario, Productos, Eventos, Operaciones, Historial y más. Todo organizado para que cualquier persona del equipo encuentre lo que necesita en segundos."

---

## ESCENA 3 — Inventario (2:30 – 4:00)
**[Pantalla: Inventario]**

> "En la sección de Inventario puedes ver todo tu equipamiento de un solo vistazo. Micrófonos, consolas, pantallas, estructuras, iluminación — cada artículo con su estado actual."

→ Muestra la tabla con los productos  
→ Señala las columnas: Disponible, Reservado, Ocupado, En Mantenimiento, Perdido

> "Aquí está una de las funciones más potentes: el selector de fecha. Si quiero saber qué tengo disponible para el 20 de mayo, lo selecciono y el sistema me muestra exactamente cuántas unidades están libres ese día, descontando automáticamente lo que ya está comprometido para otros eventos."

→ Cambia la fecha en el selector **"Disponibilidad al día"**  
→ Muestra cómo cambian los números en la columna Disponible

> "Ya no más planillas de Excel, no más llamadas para preguntar si el subwoofer está disponible. El sistema lo sabe en tiempo real."

→ Haz clic en **Detalle** de un producto  
→ Muestra la lista de unidades con sus códigos RFID individuales

> "Cada unidad tiene su propio código RFID único. Puedo ver el estado de cada una por separado, e incluso cambiar el estado manualmente si es necesario."

---

## ESCENA 4 — Crear un Evento (4:00 – 6:00)
**[Pantalla: Eventos]**

> "Ahora creemos un evento. Supongamos que tenemos un festival de música el próximo sábado."

→ Haz clic en **Nuevo Evento**  
→ Llena el formulario:
  - Nombre: `Festival Verano 2025`
  - Fecha: (elige una fecha futura)
  - Lugar: `Parque Bicentenario`
  - Notas: `Montar escenario principal y secundario`

> "Selecciono la fecha del evento y el sistema ya sabe para qué día está reservando el equipo. Ahora asigno los artículos que necesito."

→ En la sección Asignar equipos, selecciona cantidades de varios productos  
→ Muestra que la disponibilidad ya refleja los otros eventos

> "Observa que el sistema me muestra en tiempo real cuántas unidades tengo disponibles para esa fecha exacta. Si otro evento ya tiene comprometido el mismo equipo, me lo descuenta automáticamente."

→ Haz clic en **Guardar evento**

> "El evento queda creado con su número de orden único — en este caso EVT-101 — y los artículos pasan a estado Reservado en el inventario."

---

## ESCENA 5 — Búsqueda por N° de Orden (6:00 – 6:45)
**[Pantalla: Eventos]**

> "En cualquier momento puedo buscar un evento específico por su número de orden. Ideal para cuando un cliente llama preguntando por su evento."

→ Escribe el número `EVT-101` en el campo de búsqueda  
→ Haz clic en **Buscar**

> "El modal me muestra todos los detalles del evento: fecha, lugar, estado, equipos asignados. Y desde aquí puedo descargarlo como PDF o compartirlo directamente por WhatsApp o correo electrónico con un solo clic."

→ Muestra los botones **Descargar PDF**, **WhatsApp**, **Correo**

---

## ESCENA 6 — Operaciones: el ciclo logístico (6:45 – 10:30)
**[Pantalla: Operaciones]**

> "Esta es la sección estrella del sistema: Operaciones. Aquí es donde sucede todo el movimiento físico del equipo."

→ Muestra la card del evento recién creado

> "Cada evento tiene una barra de progreso que va del 0% al 100%, dividida en cuatro fases. El sistema no permite saltarse ninguna — cada fase debe completarse antes de iniciar la siguiente."

→ Señala las 4 fases en la leyenda de colores

> "**Fase 1 — Despacho desde bodega.** El equipo pasa por las antenas RFID al salir de la bodega. Veamos cómo funciona."

→ Haz clic en **Iniciar · F1**  
→ En el modal, haz clic en **Simular lectura RFID**

> "Las antenas van leyendo los tags RFID de cada artículo conforme pasan por el portal. Observa cómo la barra va avanzando artículo por artículo. En una operación real, esto sucede automáticamente mientras el equipo pasa por la puerta — sin que nadie tenga que escanear nada manualmente."

→ Deja que avance varios artículos, luego haz clic en **Detener**

> "Si la antena falla, el sistema tiene modo manual — el operador puede marcar los artículos uno a uno desde la lista."

→ Haz clic en **Modo manual**  
→ Marca 2–3 artículos manualmente con el botón **Marcar**

> "Una vez completada la fase, la barra llega al 25%."

→ Haz clic en **Simular lectura RFID** para completar el resto  
→ Haz clic en **Completar fase**

> "Perfecto. F1 completa. El equipo salió de bodega, los artículos están en estado Ocupado. Ahora el sistema habilita la Fase 2."

→ Haz clic en **Iniciar · F2** — Recepción en el evento

> "En el lugar del evento, el equipo de terreno usa una pistola lectora portátil para confirmar que todo llegó en buen estado. Si un artículo tiene daño, se registra la incidencia."

→ Simula algunos artículos, luego haz clic en **Incidencia** de un artículo

> "Seleccionamos el estado — Perdido o En Mantenimiento — describimos qué pasó, y el sistema envía automáticamente una notificación por WhatsApp y correo al responsable del evento. Todo queda registrado con fecha, hora y razón."

→ Selecciona **En Mantenimiento**, escribe `"Golpe en transporte, pantalla con fisura visible"`  
→ Haz clic en **Registrar y notificar**

> "La barra llega al 100% de la fase, pero con indicador de advertencia en naranja porque hay un artículo con incidencia. La operación continúa."

→ Completa F2, luego muestra brevemente F3 y F4

> "Las fases 3 y 4 siguen la misma lógica para el retorno: despacho desde el evento y recepción en bodega. Al completar la F4, el evento se cierra automáticamente como Realizado y todos los artículos vuelven a estar Disponibles."

---

## ESCENA 7 — Cierre forzado (Admin) (10:30 – 11:15)
**[Pantalla: Operaciones]**

> "Solo el Administrador tiene un control adicional: puede forzar el cierre de una fase o del ciclo completo en situaciones de emergencia — por ejemplo, si hay una falla técnica y el equipo necesita salir de inmediato."

→ Haz clic en el ícono de administrador (rojo)  
→ Escribe un motivo: `"Falla en antena de salida, operación manual verificada"`  
→ Haz clic en **Confirmar forzado**

> "El sistema registra la fecha, hora, nombre del responsable y el motivo. Haciendo clic en el chip 'Cierre forzado' puedes ver el historial completo de esta acción."

→ Haz clic en el chip **Cierre forzado — ver detalle**  
→ Muestra el modal con el log

---

## ESCENA 8 — Inventario post-evento (11:15 – 12:00)
**[Pantalla: Inventario]**

> "Una vez cerrado el evento, volvemos al inventario. Todo el equipo que regresó en buen estado aparece nuevamente como Disponible. El artículo que reportamos con daño queda en Mantenimiento hasta que alguien lo repare y cambie su estado."

→ Muestra la tabla actualizada  
→ Muestra el artículo en estado En Mantenimiento

> "El sistema siempre refleja la realidad de tu bodega. Nada se pierde de vista."

---

## CIERRE (12:00 – 12:45)
**[Pantalla: Dashboard o logo]**

> "Eso es iNOISE RFID. Un sistema diseñado para empresas de eventos que necesitan control total sobre su equipo: saber dónde está cada artículo, en qué estado, para qué evento está comprometido y quién lo movió. Sin papel, sin planillas, sin llamadas. Solo datos en tiempo real."

> "Si te interesa implementar este sistema en tu empresa, conversemos. Lo adaptamos a tu operación, tu inventario y tu equipo de trabajo."

---

## NOTAS DE PRODUCCIÓN
- Graba en resolución 1920×1080 mínimo
- Activa el cursor resaltado (herramienta: PowerToys, cursor highlighter)
- Abre el sistema con el sidebar expandido para que se vean los nombres del menú
- Usa datos ficticios pero realistas (nombres de eventos reales del mercado chileno)
- Música de fondo sugerida: instrumental suave, sin letra
- Edición: agrega títulos de sección ("Escena 3 — Inventario") como texto en pantalla
