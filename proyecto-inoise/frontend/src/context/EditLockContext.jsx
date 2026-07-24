/**
 * EditLockContext.jsx
 *
 * Reservas de edición en tiempo real ("Fulano está editando esto") para
 * evitar que dos PCs conectadas al mismo servidor (ej. vía Tailscale, cada
 * una en una ciudad distinta) se pisen al editar el mismo producto casi al
 * mismo tiempo. Antes, guardar era simplemente "el último que guarda gana"
 * sin que nadie se enterara — con esto, quien entra segundo ve quién lo
 * tiene abierto y no puede sobreescribir por encima.
 *
 * El servidor (electron/server/index.js) es la única fuente de verdad de
 * qué está bloqueado — mantiene un Map en memoria y lo libera solo si el
 * mismo socket que lo tomó lo suelta, o si ese socket se desconecta. Este
 * contexto solo espeja ese estado vía Socket.io para que cualquier pantalla
 * pueda usar useEditLock() sin manejar el socket a mano.
 *
 * Uso típico en una pantalla:
 *   const { acquireLock, releaseLock, getLockedBy } = useEditLock()
 *   // Al abrir el modal de edición de un producto:
 *   acquireLock('product', product.id)
 *   // Al cerrarlo (cancelar, guardar, eliminar):
 *   releaseLock('product', product.id)
 *   // En cualquier render, para mostrar el aviso:
 *   const lock = getLockedBy('product', product.id) // null si libre o si soy yo mismo
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { getSocket } from '../lib/socket'
import { useAuth } from './AuthContext'

const EditLockContext = createContext(null)

const keyOf = (entityType, entityId) => `${entityType}:${entityId}`

export function EditLockProvider({ children }) {
  // { [`${entityType}:${entityId}`]: { entityType, entityId, userId, displayName, since } }
  const [locks, setLocks] = useState({})
  const { currentUser } = useAuth()

  useEffect(() => {
    const sock = getSocket()

    const onSync = (list) => {
      const map = {}
      ;(list || []).forEach(l => { map[keyOf(l.entityType, l.entityId)] = l })
      setLocks(map)
    }
    const onAcquired = (lock) => {
      setLocks(prev => ({ ...prev, [keyOf(lock.entityType, lock.entityId)]: lock }))
    }
    const onReleased = ({ entityType, entityId }) => {
      setLocks(prev => {
        const next = { ...prev }
        delete next[keyOf(entityType, entityId)]
        return next
      })
    }

    sock.on('locks:sync', onSync)
    sock.on('lock:acquired', onAcquired)
    sock.on('lock:released', onReleased)
    return () => {
      sock.off('locks:sync', onSync)
      sock.off('lock:acquired', onAcquired)
      sock.off('lock:released', onReleased)
    }
  }, [])

  const acquireLock = useCallback((entityType, entityId) => {
    if (entityId === undefined || entityId === null) return
    getSocket().emit('lock:acquire', { entityType, entityId })
  }, [])

  const releaseLock = useCallback((entityType, entityId) => {
    if (entityId === undefined || entityId === null) return
    getSocket().emit('lock:release', { entityType, entityId })
  }, [])

  // Devuelve el lock activo de una entidad, o null si está libre, o
  // también null si el que la tiene tomada soy yo mismo (no tiene sentido
  // avisarme a mí mismo "vos estás editando esto").
  const getLockedBy = useCallback((entityType, entityId) => {
    const lock = locks[keyOf(entityType, entityId)]
    if (!lock) return null
    if (currentUser && lock.userId === currentUser.id) return null
    return lock
  }, [locks, currentUser])

  // Suscripción puntual a "denegado" — se dispara justo cuando ESTE cliente
  // intentó tomar una entidad que ya tenía otro, para poder avisar de
  // inmediato (snackbar) sin esperar a que se refleje en la lista general.
  const onDenied = useCallback((handler) => {
    const sock = getSocket()
    sock.on('lock:denied', handler)
    return () => sock.off('lock:denied', handler)
  }, [])

  return (
    <EditLockContext.Provider value={{ locks, acquireLock, releaseLock, getLockedBy, onDenied }}>
      {children}
    </EditLockContext.Provider>
  )
}

export function useEditLock() {
  const ctx = useContext(EditLockContext)
  if (!ctx) throw new Error('useEditLock debe usarse dentro de EditLockProvider')
  return ctx
}
