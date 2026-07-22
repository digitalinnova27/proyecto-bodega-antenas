/**
 * helpFaq.js
 *
 * Base de conocimiento local del Asistente de Ayuda (botón flotante "?").
 * 100% local: no llama a ninguna API externa, no requiere internet ni
 * costo por uso. Solo responde dudas de FUNCIONAMIENTO de la app —
 * no explica código ni configuración técnica del proyecto.
 *
 * Cada entrada:
 *   id        — identificador único
 *   category  — sección de la app a la que pertenece (para agrupar)
 *   question  — pregunta "canónica" que se muestra como título
 *   keywords  — palabras/sinónimos adicionales para mejorar la búsqueda
 *   answer    — string (puede tener \n para párrafos) con la respuesta
 */

export const HELP_FAQ = [
  // ── General ──────────────────────────────────────────────────────────
  {
    id: 'roles',
    category: 'General',
    question: '¿Cuál es la diferencia entre Administrador y Operador?',
    keywords: ['rol', 'roles', 'admin', 'administrador', 'operador', 'permisos', 'perfil'],
    answer: 'El Administrador tiene control total: puede forzar cierres de fase, eliminar eventos, gestionar usuarios y aprobar eliminaciones. El Operador puede ejecutar las operaciones normales del día a día (despachos, recepciones, crear eventos) pero no puede forzar cierres ni eliminar registros directamente — sus solicitudes de eliminación quedan pendientes de aprobación del Administrador.'
  },
  {
    id: 'pin',
    category: 'General',
    question: '¿Cómo configuro un PIN de acceso rápido?',
    keywords: ['pin', 'acceso rapido', 'login rapido', 'clave rapida', 'contraseña'],
    answer: 'Ve a Configuración → "Acceso rápido (PIN)". Ahí puedes configurar un PIN de 4 dígitos (te pedirá tu contraseña para confirmarlo). Una vez configurado, podrás iniciar sesión más rápido usando el PIN en lugar de la contraseña completa. También puedes cambiarlo o eliminarlo desde la misma sección.'
  },
  {
    id: 'login-enter',
    category: 'General',
    question: '¿Cómo inicio sesión más rápido?',
    keywords: ['login', 'iniciar sesion', 'entrar', 'enter'],
    answer: 'En la pantalla de inicio, escribe tu usuario y contraseña y presiona la tecla Enter — no necesitas hacer clic en el botón. También puedes usar el PIN de acceso rápido si lo configuraste en Configuración.'
  },
  {
    id: 'notificaciones',
    category: 'General',
    question: '¿Para qué sirve la campana de notificaciones?',
    keywords: ['notificacion', 'notificaciones', 'campana', 'alertas', 'avisos'],
    answer: 'El ícono de campana (arriba a la izquierda) muestra alertas del sistema: eventos próximos, retornos pendientes, incidencias, etc. Las notificaciones no desaparecen solas — se marcan como leídas al hacer clic en "Ir" de cada una, o con el botón "Marcar todas como leídas". El estado de conexión de la antena RFID también aparece fijo en este panel.'
  },
  {
    id: 'actualizar-datos',
    category: 'General',
    question: '¿Qué hace el botón de recargar (ícono de refresco)?',
    keywords: ['actualizar', 'recargar', 'refresh', 'sincronizar'],
    answer: 'El ícono de refresco en la barra superior vuelve a traer los datos más recientes del sistema (inventario, eventos, etc.), por si otro colaborador hizo cambios mientras tú estabas en otra pantalla.'
  },
  {
    id: 'tour',
    category: 'General',
    question: '¿Cómo repito el tour de bienvenida?',
    keywords: ['tour', 'bienvenida', 'ayuda inicial', 'guia'],
    answer: 'Haz clic en el ícono de interrogación (?) junto al menú, en la barra superior. Te llevará paso a paso por Dashboard, Inventario, Eventos, Operaciones y el control de administrador.'
  },

  // ── Dashboard ────────────────────────────────────────────────────────
  {
    id: 'dashboard',
    category: 'Dashboard',
    question: '¿Qué información muestra el Dashboard?',
    keywords: ['dashboard', 'inicio', 'resumen', 'kpi', 'panel principal'],
    answer: 'El Dashboard es el centro de mando: muestra de un vistazo cuántos artículos están Disponibles, Reservados, Ocupados o con incidencias (En Mantenimiento / Perdido), además de los próximos eventos programados. Es la pantalla recomendada para revisar al empezar el día.'
  },

  // ── Inventario ───────────────────────────────────────────────────────
  {
    id: 'estados-inventario',
    category: 'Inventario',
    question: '¿Qué significan los estados de un artículo?',
    keywords: ['estado', 'disponible', 'reservado', 'ocupado', 'mantenimiento', 'perdido', 'colores'],
    answer: 'Cada unidad puede estar en uno de estos estados: Disponible (libre para asignar), Reservado (comprometida para un evento futuro), Ocupado (fuera de bodega, en uso), En Mantenimiento (con una incidencia registrada) o Perdido (reportada como extraviada).'
  },
  {
    id: 'disponibilidad-fecha',
    category: 'Inventario',
    question: '¿Cómo sé qué equipo está disponible para una fecha específica?',
    keywords: ['disponibilidad', 'fecha', 'disponible al dia', 'consultar stock'],
    answer: 'En Inventario, usa el selector "Disponibilidad al día". Elige la fecha que te interesa y el sistema te mostrará automáticamente cuántas unidades de cada producto están libres ese día, descontando lo que ya está reservado por otros eventos. Así evitas comprometer equipo dos veces.'
  },
  {
    id: 'detalle-unidad',
    category: 'Inventario',
    question: '¿Cómo veo el detalle de las unidades RFID de un producto?',
    keywords: ['detalle', 'unidad', 'rfid individual', 'codigo'],
    answer: 'Haz clic en "Detalle" sobre cualquier producto en Inventario. Se abre la lista de unidades individuales con su código RFID propio, donde puedes ver (y en algunos casos cambiar manualmente) el estado de cada una por separado.'
  },

  // ── Productos ────────────────────────────────────────────────────────
  {
    id: 'productos-vs-inventario',
    category: 'Productos',
    question: '¿En qué se diferencia Productos de Inventario?',
    keywords: ['productos', 'catalogo', 'diferencia inventario'],
    answer: 'Inventario muestra el estado operativo de cada unidad (disponible, ocupada, etc.). Productos es más bien el catálogo: permite ver y administrar la vinculación entre cada unidad física y su tag RFID (EPC), incluyendo desvincular stickers "huérfanos" cuyo producto ya no existe.'
  },
  {
    id: 'vincular-epc',
    category: 'Productos',
    question: '¿Cómo vinculo o desvinculo un tag RFID a un producto?',
    keywords: ['vincular', 'desvincular', 'epc', 'tag', 'sticker'],
    answer: 'En Productos puedes ver qué unidades tienen un tag RFID (EPC) vinculado. Para vincular uno nuevo, usa la sección "Registrar RFID" del menú lateral, donde asocias el sticker físico a la unidad correspondiente escaneándolo.'
  },

  // ── Antenas / Registrar RFID ─────────────────────────────────────────
  {
    id: 'antenas',
    category: 'Antenas',
    question: '¿Qué muestra la sección Antenas?',
    keywords: ['antena', 'antenas', 'conexion', 'wifi', 'lectura'],
    answer: 'Muestra el estado de conexión de las antenas RFID de bodega (conectada/desconectada) y las lecturas que van captando en tiempo real cuando el equipo pasa por el portal. Este mismo estado también aparece en la campana de notificaciones.'
  },
  {
    id: 'registrar-rfid',
    category: 'Antenas',
    question: '¿Cómo registro un nuevo tag RFID?',
    keywords: ['registrar rfid', 'nuevo tag', 'sticker nuevo'],
    answer: 'Ve a "Registrar RFID" en el menú lateral. Ahí puedes escanear o ingresar el código EPC del sticker y asociarlo a la unidad de producto correspondiente.'
  },

  // ── Eventos ──────────────────────────────────────────────────────────
  {
    id: 'crear-evento',
    category: 'Eventos',
    question: '¿Cómo creo un evento nuevo?',
    keywords: ['crear evento', 'nuevo evento', 'evento'],
    answer: 'En Eventos, haz clic en "Nuevo Evento". Completa nombre, fecha, lugar y notas, luego asigna las cantidades de cada producto que necesitas — el sistema te muestra en tiempo real la disponibilidad real para esa fecha y bloquea asignar más de lo disponible. Al guardar, el evento recibe un número de orden único (ej: EVT-101) y el equipo pasa a estado Reservado.'
  },
  {
    id: 'buscar-evento',
    category: 'Eventos',
    question: '¿Cómo busco un evento por su número de orden?',
    keywords: ['buscar evento', 'numero de orden', 'evt', 'orden'],
    answer: 'En Eventos, escribe el número de orden (ej: EVT-101) en el campo de búsqueda y presiona Buscar. Se abre un modal con todos los detalles del evento y las opciones "Descargar PDF" y "WhatsApp / Correo" para compartirlo.'
  },
  {
    id: 'compartir-evento',
    category: 'Eventos',
    question: '¿Cómo comparto los detalles de un evento por PDF o WhatsApp?',
    keywords: ['pdf', 'whatsapp', 'correo', 'compartir', 'exportar'],
    answer: 'Desde el modal de detalle de un evento (al buscarlo por número de orden) tienes los botones "Descargar PDF" y "WhatsApp / Correo" para compartir la información directamente.'
  },
  {
    id: 'deshacer-evento',
    category: 'Eventos',
    question: '¿Cómo deshago o elimino un evento?',
    keywords: ['deshacer evento', 'eliminar evento', 'papelera', 'cancelar evento'],
    answer: 'Cada evento tiene un botón "Deshacer" (ícono de papelera roja). Al confirmar, el evento se elimina y todo el equipo que tenía reservado vuelve automáticamente a estado Disponible en el inventario.'
  },

  // ── Rental ───────────────────────────────────────────────────────────
  {
    id: 'rental',
    category: 'Rental',
    question: '¿Qué es la sección Rental y en qué se diferencia de Eventos?',
    keywords: ['rental', 'arriendo', 'arriendos', 'cliente externo'],
    answer: 'Rental funciona de forma muy similar a Eventos (asignas productos con disponibilidad en tiempo real y generas un PDF), pero está pensada para arriendos de equipo a un cliente externo en vez de un evento propio de producción.'
  },

  // ── Operaciones ──────────────────────────────────────────────────────
  {
    id: 'fases-operaciones',
    category: 'Operaciones',
    question: '¿Cuáles son las 4 fases del ciclo logístico?',
    keywords: ['fases', 'operaciones', 'ciclo', 'despacho', 'recepcion', 'f1', 'f2', 'f3', 'f4'],
    answer: 'Todo evento pasa por 4 fases obligatorias, en orden: F1 Despacho desde bodega, F2 Recepción en el evento, F3 Despacho desde el evento, F4 Recepción en bodega. Cada fase completa suma 25% a la barra de progreso; no se puede saltar a la siguiente sin terminar la anterior. Al completar F4, el evento se cierra automáticamente como "Realizado" y el equipo vuelve a estado Disponible.'
  },
  {
    id: 'modo-manual',
    category: 'Operaciones',
    question: '¿Qué hago si falla la lectura de la antena RFID?',
    keywords: ['modo manual', 'falla antena', 'lectura manual', 'marcar articulo'],
    answer: 'En cada fase de Operaciones existe un botón "Modo manual" que permite marcar los artículos uno por uno desde la lista, sin depender de la antena. Es el respaldo cuando el hardware falla.'
  },
  {
    id: 'incidencias',
    category: 'Operaciones',
    question: '¿Cómo registro una incidencia (equipo dañado o perdido)?',
    keywords: ['incidencia', 'dañado', 'perdido', 'reportar daño'],
    answer: 'Durante cualquier fase de Operaciones, haz clic en "Incidencia" sobre el artículo afectado. Selecciona el nuevo estado (Perdido o En Mantenimiento), describe qué pasó y confirma con "Registrar y notificar". El sistema envía automáticamente una notificación por WhatsApp y correo al responsable del evento, y queda registrado con fecha, hora y motivo.'
  },
  {
    id: 'cierre-forzado',
    category: 'Operaciones',
    question: '¿Qué es el cierre forzado y quién puede usarlo?',
    keywords: ['cierre forzado', 'forzar cierre', 'emergencia', 'solo admin'],
    answer: 'Es una función exclusiva del Administrador para forzar el cierre de una fase o del ciclo completo ante una emergencia (por ejemplo, una falla técnica). Se debe escribir un motivo, y el sistema registra fecha, hora, responsable y motivo — todo queda disponible en el historial del evento haciendo clic en el chip "Cierre forzado".'
  },

  // ── Historial y Reportes ─────────────────────────────────────────────
  {
    id: 'historial',
    category: 'Historial',
    question: '¿Qué información queda registrada en el Historial?',
    keywords: ['historial', 'registro', 'auditoria', 'log'],
    answer: 'El Historial guarda un registro auditable de las acciones relevantes del sistema: cambios de estado, cierres forzados, incidencias y movimientos de equipo, con fecha, hora y responsable.'
  },
  {
    id: 'reportes',
    category: 'Reportes',
    question: '¿Para qué sirve el Reporte de operaciones?',
    keywords: ['reporte', 'reportes', 'estadisticas', 'informe'],
    answer: 'Es una vista consolidada de las operaciones realizadas (eventos, fases completadas, incidencias) pensada para análisis y control de gestión.'
  },

  // ── Usuarios ─────────────────────────────────────────────────────────
  {
    id: 'usuarios',
    category: 'Usuarios',
    question: '¿Cómo agrego o desactivo un usuario?',
    keywords: ['usuarios', 'agregar usuario', 'desactivar', 'bloquear', 'nuevo colaborador'],
    answer: 'La sección Usuarios (solo visible/administrable para el Administrador) permite ver a todos los colaboradores, su rol (Administrador u Operador) y activarlos o desactivarlos. Un usuario desactivado no puede iniciar sesión ni aparece disponible para chatear.'
  },

  // ── Chat interno ─────────────────────────────────────────────────────
  {
    id: 'chat-interno',
    category: 'Chat',
    question: '¿Cómo funciona el chat interno entre colaboradores?',
    keywords: ['chat', 'mensajes', 'conversacion', 'colaboradores'],
    answer: 'El ícono de chat (arriba a la derecha) abre un panel con la lista de colaboradores. Al seleccionar uno, puedes enviarle mensajes de texto, emojis, o compartir referencias directas a un evento o arriendo (con el botón de evento junto al campo de texto). Los mensajes no leídos se marcan con un número en el ícono.'
  },
  {
    id: 'chat-duracion',
    category: 'Chat',
    question: '¿Los mensajes del chat se borran automáticamente?',
    keywords: ['borrar mensajes', 'duracion chat', 'eliminar mensajes', 'expiran'],
    answer: 'No. Actualmente los mensajes del chat interno quedan guardados de forma indefinida en la base de datos local de la app — no existe borrado automático ni límite de tiempo.'
  },
]

/* ── Normaliza texto: minúsculas y sin tildes, para comparar sin errores ── */
function normalize(str = '') {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
}

/**
 * Busca en HELP_FAQ las entradas más relevantes para una consulta libre.
 * Búsqueda 100% local por coincidencia de palabras — sin IA externa.
 * Devuelve hasta `limit` resultados ordenados por relevancia.
 */
export function searchFaq(query, limit = 5) {
  const q = normalize(query)
  if (!q) return []

  const terms = q.split(/\s+/).filter(t => t.length > 1)
  if (terms.length === 0) return []

  const scored = HELP_FAQ.map(entry => {
    const haystack = normalize(
      [entry.question, entry.category, ...(entry.keywords || [])].join(' ')
    )
    let score = 0
    terms.forEach(term => {
      if (haystack.includes(term)) score += 1
      // Coincidencia exacta de palabra completa pesa más que substring
      if (new RegExp(`\\b${term}\\b`).test(haystack)) score += 1
    })
    return { entry, score }
  })
  .filter(r => r.score > 0)
  .sort((a, b) => b.score - a.score)
  .slice(0, limit)

  return scored.map(r => r.entry)
}
