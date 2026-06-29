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

const WS_URL = 'ws://localhost:3001'
const RECONNECT_INTERVAL = 3000
const SIGNAL_HISTORY_SIZE = 10

export const RfidSocketContext = React.createContext(null)

export function RfidSocketProvider({ children }) {
    const [isConnected, setIsConnected] = React.useState(false)
    const [lastScan, setLastScan] = React.useState(null)
    const [unknownTags, setUnknownTags] = React.useState([])
    const [signalHistory, setSignalHistory] = React.useState([])
    const [lastReadAt, setLastReadAt] = React.useState(null)
    const wsRef = React.useRef(null)
    const timerRef = React.useRef(null)

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

    const clearLastScan = React.useCallback(() => setLastScan(null), [])

    const value = { isConnected, lastScan, unknownTags, clearLastScan, signalHistory, lastReadAt }

    return (
        <RfidSocketContext.Provider value={value}>
            {children}
        </RfidSocketContext.Provider>
    )
}
