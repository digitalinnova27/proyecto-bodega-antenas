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

export function useRfidSocket() {
    const [isConnected, setIsConnected] = useState(false)
    const [lastScan, setLastScan] = useState(null)  // { epc, sku, timestamp }
    const [unknownTags, setUnknownTags] = useState([])
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
                } else if (msg.type === 'rfid_unknown') {
                    setUnknownTags(prev => [...prev.slice(-9), msg.epc])
                }
            } catch (e) { }
        }

        ws.onclose = () => {
            setIsConnected(false)
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

    return { isConnected, lastScan, unknownTags, clearLastScan }
}
