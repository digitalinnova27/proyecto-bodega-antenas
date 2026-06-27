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
 */

import { useState, useEffect, useRef, useCallback } from 'react'

const WS_URL = 'ws://localhost:3001'
const RECONNECT_INTERVAL = 3000

// Cuántas lecturas de RSSI guardamos para calcular el promedio de cobertura
const SIGNAL_HISTORY_SIZE = 10

export function useRfidSocket() {
    const [isConnected, setIsConnected] = useState(false)
    const [lastScan, setLastScan] = useState(null)  // { epc, sku, timestamp }
    const [unknownTags, setUnknownTags] = useState([])
    // RSSI (dBm) de las últimas lecturas reales — sirve para calcular el
    // % de cobertura de la antena (ver useNotifications.js). Se llenan tanto
    // con tags conocidos como desconocidos, porque ambos confirman que la
    // antena está leyendo algo físicamente.
    const [signalHistory, setSignalHistory] = useState([])
    const [lastReadAt, setLastReadAt] = useState(null)
    const wsRef = useRef(null)
    const timerRef = useRef(null)

    const connect = useCallback(() => {
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
    }, [])

    useEffect(() => {
        connect()
        return () => {
            clearTimeout(timerRef.current)
            wsRef.current?.close()
        }
    }, [connect])

    const clearLastScan = useCallback(() => setLastScan(null), [])

    return { isConnected, lastScan, unknownTags, clearLastScan, signalHistory, lastReadAt }
}