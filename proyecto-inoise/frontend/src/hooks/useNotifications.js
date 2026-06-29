/**
 * useNotifications.js — Notificaciones reales del sistema (no mock data)
 *
 * Antes, App.jsx tenía un arreglo hardcodeado con 2 notificaciones falsas
 * ("Antena 2 está offline", "Par LED con bajo stock") que nunca cambiaban
 * y no llevaban a ningún lado. Este hook calcula notificaciones reales a
 * partir del estado actual de la app cada vez que algo cambia:
 *
 *  - Evento próximo      → events a 2 días o menos de su fecha, no realizados
 *  - Rental por vencer   → rentals a 2 días o menos de su fin (o el mismo
 *                          día, si el rental dura 1 solo día)
 *
 * "Bajo stock" queda POSTERGADA a propósito: todavía no hay un umbral de
 * stock bajo definido con el cliente, así que mostrarla ahora generaría
 * alertas sin criterio real. Se puede reactivar fácilmente más adelante
 * (queda comentado abajo dónde iría).
 *
 * Sin persistencia molesta: una notificación se queda en la lista hasta
 * que se marca como leída (botón "Ir", "Marcar todas" o simplemente cerrar
 * la campanita). Una vez leída, desaparece — no se queda ahí "apagada".
 *
 * El estado de la antena (conectada/cobertura) NO vive en esta lista de
 * notificaciones descartables — es un estado persistente (ver
 * `antennaStatus` más abajo) que siempre se recalcula con la lectura real
 * del bridge, para no tener que ir a la sección de Antenas a revisarlo.
 */

import React from 'react'
import { useInventory } from '../context/InventoryContext'
import { useRfidSocket } from './useRfidSocket'

// Ventana de aviso (en días) para eventos y rentals próximos a vencer
const EVENT_WINDOW_DAYS = 2
const RENTAL_WINDOW_DAYS = 2

// Sin lecturas en los últimos X ms → se considera "esperando lecturas"
// (neutral), no "fallando".
const NO_SIGNAL_GRACE_MS = 2 * 60 * 1000 // 2 minutos

// Umbral de cobertura: por debajo de esto, la antena se considera con
// señal baja (rojo). 50% o más = funcionando correctamente (verde).
const COVERAGE_OK_THRESHOLD = 50

// RSSI (dBm) típico: -30 = señal fuerte (100%), -90 = señal débil (0%).
// Mapeo lineal simple entre esos dos extremos.
const RSSI_STRONG = -30
const RSSI_WEAK = -90

const rssiToPct = (rssi) => {
    const pct = ((rssi - RSSI_WEAK) / (RSSI_STRONG - RSSI_WEAK)) * 100
    return Math.max(0, Math.min(100, Math.round(pct)))
}

// Diferencia en días calendario (fecha objetivo − hoy). Negativo = ya pasó.
const daysFromToday = (dateStr) => {
    if (!dateStr) return null
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const d = new Date(dateStr + 'T00:00:00')
    return Math.round((d.getTime() - today.getTime()) / 86400000)
}

// Texto relativo simple: "hoy", "mañana", "en 2 días"
const relativeDay = (diff) => {
    if (diff === 0) return 'hoy'
    if (diff === 1) return 'mañana'
    return `en ${diff} días`
}

export function useNotifications() {
    const { events, rentals } = useInventory()
    const { isConnected, signalHistory, lastReadAt } = useRfidSocket()
    const [seenIds, setSeenIds] = React.useState(() => new Set())

    // ── Estado persistente de la antena (no es una "notificación" descartable) ──
    // Se recalcula siempre con la lectura real del bridge: conexión + RSSI
    // promedio de las últimas lecturas + qué tan reciente fue la última.
    const antennaStatus = React.useMemo(() => {
        if (!isConnected) {
            return { state: 'offline', pct: null, label: 'Sin conexión con el bridge' }
        }

        // El bridge corre siempre dentro de Electron (isConnected = WebSocket
        // conectado al bridge), así que por sí solo NO significa que haya una
        // antena física enchufada al PC. La única señal real de hardware es
        // haber recibido al menos un paquete UDP desde que se abrió la app.
        if (!lastReadAt) {
            return { state: 'offline', pct: null, label: 'Sin antena física detectada' }
        }

        const sinceLastRead = Date.now() - lastReadAt
        if (sinceLastRead > NO_SIGNAL_GRACE_MS) {
            return { state: 'neutral', pct: null, label: 'Conectada — esperando lecturas' }
        }

        const avgRssi = signalHistory.length
            ? signalHistory.reduce((a, b) => a + b, 0) / signalHistory.length
            : null

        if (avgRssi == null) {
            return { state: 'neutral', pct: null, label: 'Conectada — esperando lecturas' }
        }

        const pct = rssiToPct(avgRssi)
        if (pct >= COVERAGE_OK_THRESHOLD) {
            return { state: 'good', pct, label: `Funcionando correctamente — cobertura ~${pct}%` }
        }
        return { state: 'low', pct, label: `Cobertura baja (~${pct}%) — revisa ubicación/orientación` }
    }, [isConnected, signalHistory, lastReadAt])

    const allNotifications = React.useMemo(() => {
        const list = []

        // ── Bajo stock (POSTERGADO — falta definir umbral real con el cliente) ──
        // products.forEach(p => {
        //   const available = getAvailableQty(p.id)
        //   if (available <= LOW_STOCK_THRESHOLD) {
        //     list.push({
        //       id: `low-stock-${p.id}`,
        //       severity: 'warning',
        //       icon: 'ti-package',
        //       title: 'Bajo stock',
        //       text: `${p.name} — ${available} disponible${available === 1 ? '' : 's'}`,
        //       route: '/inventory'
        //     })
        //   }
        // })

        // ── Evento próximo (≤ 2 días, no realizado/suspendido) ──
        events.forEach(e => {
            const diff = daysFromToday(e.date)
            if (diff == null || diff < 0 || diff > EVENT_WINDOW_DAYS) return
            if (['Realizado', 'Concluido', 'Suspendido'].includes(e.status)) return
            list.push({
                id: `event-soon-${e.id}`,
                severity: 'info',
                icon: 'ti-calendar-event',
                title: 'Evento próximo',
                text: `"${e.name}" — ${relativeDay(diff)}`,
                route: '/operations'
            })
        })

        // ── Rental por vencer ──
        // Si el rental dura 1 día (mismo día inicio/fin) avisa ese mismo día.
        // Si dura más, avisa cuando falten RENTAL_WINDOW_DAYS días o menos.
        rentals.forEach(r => {
            const diffEnd = daysFromToday(r.endDate)
            if (diffEnd == null || diffEnd < 0) return
            const duration = r.date ? daysFromToday(r.date) - diffEnd : null // negativo o 0
            const sameDayRental = duration === 0
            const windowOk = sameDayRental ? diffEnd === 0 : diffEnd <= RENTAL_WINDOW_DAYS
            if (!windowOk) return
            list.push({
                id: `rental-due-${r.id}`,
                severity: 'accent',
                icon: 'ti-truck-return',
                title: 'Rental por vencer',
                text: `"${r.name}" — vence ${relativeDay(diffEnd)}`,
                route: '/operations'
            })
        })

        return list
    }, [events, rentals])

    // Solo se muestran las que NO se han marcado como leídas. Sin "seen: true"
    // dando vueltas en la lista — una vez leída, desaparece.
    const notifications = allNotifications.filter(n => !seenIds.has(n.id))
    const unread = notifications.length

    const markSeen = (id) => setSeenIds(prev => new Set(prev).add(id))

    const markAllSeen = () => setSeenIds(prev => {
        const next = new Set(prev)
        allNotifications.forEach(n => next.add(n.id))
        return next
    })

    return { notifications, unread, markSeen, markAllSeen, antennaStatus }
}