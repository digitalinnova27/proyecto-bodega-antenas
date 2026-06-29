/**
 * useRfidSocket.js — Hook React para recibir scans reales del RFID Bridge
 *
 * Uso en OpModalExternal:
 *   const { lastScan, isConnected } = useRfidSocket()
 *
 *   useEffect(() => {
 *     if (lastScan && activePhase) {
 *       onManualScan(eventId, activePhase, { id: lastScan.sku, rfid: lastScan.epc, name: ..., sku: lastScan.sku })
 *     }
 *   }, [lastScan])
 *
 * IMPORTANTE: si la app está envuelta en <RfidSocketProvider> (ver
 * App.jsx), este hook devuelve ese estado COMPARTIDO en vez de abrir su
 * propia conexión — así todas las páginas (Antenas, RfidRegistrar, la
 * campanita de notificaciones, etc.) ven siempre el mismo "conectada /
 * última lectura", sin importar cuál esté montada en este momento. Antes
 * cada página abría su propio WebSocket y perdía ese estado al navegar a
 * otra pantalla, lo que causaba que /antennas mostrara "Offline" pese a
 * que la campanita decía "Conectada".
 *
 * Si no hay Provider (p. ej. en algún test aislado), cae de vuelta a abrir
 * su propia conexión local, igual que antes.
 */

import { useState, useEffect, useRef, useCallback, useContext } from 'react'
import { RfidSocketContext } from '../context/RfidSocketContext'

const WS_URL = 'ws://localhost:3001'
const RECONNECT_INTERVAL = 3000

// Cuántas lecturas de RSSI guardamos para calcular el promedio de cobertura
const SIGNAL_HISTORY_SIZE = 10

export function useRfidSocket() {
    const shared = useContext(RfidSocketContext)

    const [isConnected, setIsConnected] = useState(false)
    const [lastScan, setLastScan] = useState(null)  // { epc, sku, timestamp }
    const [unknownTags, setUnknownTags] = useState([])
    const [signalHistory, setSignalHistory] = useState([])
    const [lastReadAt, setLastReadAt] = useState(null)
    const wsRef = useRef(null)
    const timerRef = useRef(null)

    const connect = useCallback(() => {
        if (shared) return // ya existe una conexión compartida vía RfidSocketProvider
        if (wsRef.current?.readyState === WebSocket.OPEN) return

        const ws = new WebSocket(WS_URL)

        ws.onopen = () => {
            setIsConnected(true)
            console.log('[RFID] WebSocket conectado al bridge')
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
            console.log('[RFID] WebSocket desconectado, reintentando en 3s...')
            timerRef.current = setTimeout(connect, RECONNECT_INTERVAL)
        }

        ws.onerror = () => ws.close()
        wsRef.current = ws
    }, [shared])

    useEffect(() => {
        if (shared) return // el Provider ya mantiene su propia conexión
        connect()
        return () => {
            clearTimeout(timerRef.current)
            wsRef.current?.close()
        }
    }, [connect, shared])

    const clearLastScan = useCallback(() => {
        if (shared) { shared.clearLastScan(); return }
        setLastScan(null)
    }, [shared])

    if (shared) return shared

    return { isConnected, lastScan, unknownTags, clearLastScan, signalHistory, lastReadAt }
}
