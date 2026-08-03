/**
 * RfidSocketContext.jsx — UNA sola conexión WebSocket al bridge RFID,
 * compartida por toda la app.
 *
 * Antes, useRfidSocket() abría su PROPIA conexión cada vez que un
 * componente lo llamaba (RfidRegistrar, Antennas, useNotifications,
 * Operations...). Eso significaba varios WebSockets simultáneos al mismo
 * bridge, y — más grave — que el estado "lastReadAt" (única señal real de
 * que hay una antena física conectada) vivía en cada instancia por
 * separado. Resultado: la campanita (montada una vez en App.jsx) podía
 * decir "Antena conectada" mientras la página /antennas, recién montada,
 * mostraba "Offline" porque su propia instancia del hook todavía no había
 * recibido ningún paquete.
 *
 * Este Provider se monta UNA vez en App.jsx (fuera de las rutas) y
 * mantiene la única conexión real. useRfidSocket() ahora simplemente lee
 * este contexto si existe, así que todas las páginas ven exactamente el
 * mismo estado sin tener que cambiar su código.
 */

import React from 'react'
import { useInventory } from './InventoryContext'

const WS_URL = 'ws://localhost:3001'
const RECONNECT_INTERVAL = 3000
const SIGNAL_HISTORY_SIZE = 10

// ── Lector USB de escritorio en modo teclado (ej. Vanch VD-67E) ────────────
// Este lector no tiene (todavía) integración por su SDK nativo — en vez de
// eso se configuró en "modo teclado": al leer un tag, escribe el código
// como si alguien lo hubiera tipeado con un teclado real, tecla por tecla,
// y termina con Enter. Un lector hace esto en milisegundos, muchísimo más
// rápido que cualquier persona tipeando a mano — usamos esa diferencia de
// velocidad para reconocer una lectura del lector y no confundirla con
// alguien escribiendo en un campo de texto cualquiera de la app.
const WEDGE_MAX_GAP_MS = 40   // más lento que esto entre teclas → es una persona, no el lector
const WEDGE_MIN_LENGTH = 8
const WEDGE_MAX_LENGTH = 40
const WEDGE_CHAR_RE = /^[0-9a-fA-F]$/

export const RfidSocketContext = React.createContext(null)

export function RfidSocketProvider({ children }) {
    const [isConnected, setIsConnected] = React.useState(false)
    const [lastScan, setLastScan] = React.useState(null)
    const [unknownTags, setUnknownTags] = React.useState([])
    const [signalHistory, setSignalHistory] = React.useState([])
    const [lastReadAt, setLastReadAt] = React.useState(null)
    const wsRef = React.useRef(null)
    const timerRef = React.useRef(null)

    // epcMap vive en InventoryContext (que envuelve a este Provider —
    // ver App.jsx/main.jsx), lo usamos para resolver el EPC leído por
    // teclado a su unitId, igual que ya lo resuelve el bridge del lado
    // del servidor para las antenas de red.
    const { epcMap } = useInventory()
    const epcMapRef = React.useRef(epcMap)
    React.useEffect(() => { epcMapRef.current = epcMap }, [epcMap])

    const connect = React.useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) return

        const ws = new WebSocket(WS_URL)

        ws.onopen = () => {
            setIsConnected(true)
            console.log('[RFID] WebSocket compartido conectado al bridge')
            clearTimeout(timerRef.current)
        }

        ws.onmessage = (evt) => {
            try {
                const msg = JSON.parse(evt.data)
                if (msg.type === 'rfid_scan') {
                    setLastScan({ epc: msg.epc, sku: msg.sku, timestamp: msg.timestamp })
                    setLastReadAt(Date.now())
                    if (typeof msg.rssi === 'number') {
                        setSignalHistory(prev => [...prev.slice(-(SIGNAL_HISTORY_SIZE - 1)), msg.rssi])
                    }
                } else if (msg.type === 'rfid_unknown') {
                    setUnknownTags(prev => [...prev.slice(-9), msg.epc])
                    setLastReadAt(Date.now())
                    if (typeof msg.rssi === 'number') {
                        setSignalHistory(prev => [...prev.slice(-(SIGNAL_HISTORY_SIZE - 1)), msg.rssi])
                    }
                }
            } catch (e) { }
        }

        ws.onclose = () => {
            setIsConnected(false)
            setLastReadAt(null)
            setSignalHistory([])
            console.log('[RFID] WebSocket compartido desconectado, reintentando en 3s...')
            timerRef.current = setTimeout(connect, RECONNECT_INTERVAL)
        }

        ws.onerror = () => ws.close()
        wsRef.current = ws
    }, [])

    React.useEffect(() => {
        connect()
        return () => {
            clearTimeout(timerRef.current)
            wsRef.current?.close()
        }
    }, [connect])

    // ── Captura del lector USB en modo teclado ─────────────────────────
    React.useEffect(() => {
        let buffer = ''
        let lastTime = 0
        let fastRun = 0 // cuántas teclas seguidas llegaron "rápido" (ritmo de lector)

        const reset = () => { buffer = ''; fastRun = 0 }

        const handleKeyDown = (e) => {
            const now = Date.now()
            const gap = now - lastTime
            lastTime = now

            if (e.key === 'Enter') {
                if (fastRun >= WEDGE_MIN_LENGTH - 1 && buffer.length >= WEDGE_MIN_LENGTH && buffer.length <= WEDGE_MAX_LENGTH) {
                    e.preventDefault()
                    e.stopPropagation()
                    const epc = buffer.toUpperCase()
                    const unitId = epcMapRef.current ? epcMapRef.current[epc] : undefined
                    setLastScan({ epc, sku: unitId, timestamp: Date.now(), source: 'keyboard' })
                }
                reset()
                return
            }

            if (e.key.length !== 1 || !WEDGE_CHAR_RE.test(e.key)) {
                // Tecla que no es un dígito hex (flechas, Shift, Tab, etc.) — no
                // rompe necesariamente una ráfaga en curso, pero tampoco cuenta.
                return
            }

            if (gap <= WEDGE_MAX_GAP_MS && buffer.length > 0 && buffer.length < WEDGE_MAX_LENGTH) {
                buffer += e.key
                fastRun += 1
                // Ya se confirmó que es una ráfaga de lector — evitar que estas
                // teclas también le lleguen a un <input> enfocado por casualidad.
                if (fastRun >= WEDGE_MIN_LENGTH - 1) {
                    e.preventDefault()
                    e.stopPropagation()
                }
            } else {
                // Muy lento (tecleo humano) o buffer lleno → arrancar de nuevo.
                buffer = e.key
                fastRun = 0
            }
        }

        // Fase de captura: para poder hacer preventDefault ANTES de que la
        // tecla llegue a cualquier <input> enfocado en la página.
        window.addEventListener('keydown', handleKeyDown, true)
        return () => window.removeEventListener('keydown', handleKeyDown, true)
    }, [])

    const clearLastScan = React.useCallback(() => setLastScan(null), [])

    const value = { isConnected, lastScan, unknownTags, clearLastScan, signalHistory, lastReadAt }

    return (
        <RfidSocketContext.Provider value={value}>
            {children}
        </RfidSocketContext.Provider>
    )
}
