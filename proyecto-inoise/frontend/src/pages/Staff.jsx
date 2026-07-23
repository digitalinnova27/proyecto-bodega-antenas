import { useState, useEffect, useCallback } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { useInventory } from '../context/InventoryContext'

const EMPTY_FORM = { nombre: '', apellido: '', rut: '', telefono: '', cargo: '' }

function formatRut(value) {
  // Formatea RUT chileno: 12.345.678-9
  const clean = value.replace(/[^0-9kK]/g, '').toUpperCase()
  if (clean.length < 2) return clean
  const body = clean.slice(0, -1)
  const dv = clean.slice(-1)
  const formatted = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${formatted}-${dv}`
}

export default function Staff() {
  const { currentUser } = useAuth()
  const { addAuditEntry } = useInventory()
  const [staff, setStaff]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing]   = useState(null)   // null = nuevo
  const [form, setForm]         = useState(EMPTY_FORM)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [search, setSearch]     = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/api/staff')
      // api.js devuelve el body tal cual (safe() en el backend responde
      // { ok, data } o { ok:false, error }) — NO es estilo axios (res.data.data).
      if (res && res.ok) {
        setStaff(Array.isArray(res.data) ? res.data : [])
      } else {
        console.error('[Staff] /api/staff GET falló:', res?.error)
        setStaff([])
      }
    } catch (e) {
      console.error('[Staff] /api/staff GET excepción:', e)
      setStaff([])
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function openNew() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setError('')
    setShowModal(true)
  }

  function openEdit(person) {
    setEditing(person)
    setForm({
      nombre: person.nombre || '',
      apellido: person.apellido || '',
      rut: person.rut || '',
      telefono: person.telefono || '',
      cargo: person.cargo || ''
    })
    setError('')
    setShowModal(true)
  }

  function closeModal() {
    setShowModal(false)
    setEditing(null)
    setForm(EMPTY_FORM)
    setError('')
  }

  async function handleSave() {
    if (!form.nombre.trim() || !form.apellido.trim()) return
    setSaving(true)
    setError('')
    try {
      const res = editing
        ? await api.put(`/api/staff/${editing.id}`, form)
        : await api.post('/api/staff', form)

      if (!res || !res.ok) {
        setError(res?.error || 'No se pudo guardar. Intenta de nuevo.')
        setSaving(false)
        return
      }

      addAuditEntry?.(
        editing ? 'Personal modificado' : 'Personal agregado',
        `${form.nombre} ${form.apellido}`,
        'personal',
        currentUser
      )

      await load()
      closeModal()
    } catch (e) {
      console.error('[Staff] guardar excepción:', e)
      setError('Error de conexión al guardar.')
    }
    setSaving(false)
  }

  async function handleDelete(id) {
    const person = staff.find(p => p.id === id)
    try {
      const res = await api.delete(`/api/staff/${id}`)
      if (!res || !res.ok) {
        console.error('[Staff] eliminar falló:', res?.error)
        setDeleteConfirm(null)
        return
      }
      if (person) {
        addAuditEntry?.('Personal eliminado', `${person.nombre} ${person.apellido}`, 'personal', currentUser)
      }
      await load()
    } catch (e) { console.error('[Staff] eliminar excepción:', e) }
    setDeleteConfirm(null)
  }

  const filtered = staff.filter(p => {
    const q = search.toLowerCase()
    return (
      p.nombre.toLowerCase().includes(q) ||
      p.apellido.toLowerCase().includes(q) ||
      (p.rut || '').toLowerCase().includes(q) ||
      (p.cargo || '').toLowerCase().includes(q)
    )
  })

  return (
    <div style={{ padding: '24px', maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#fff' }}>Personal</h1>
          <p style={{ margin: '4px 0 0', color: '#94a3b8', fontSize: 13 }}>
            {staff.length} persona{staff.length !== 1 ? 's' : ''} registrada{staff.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button onClick={openNew} style={{
          background: '#6366f1', color: '#fff', border: 'none', borderRadius: 8,
          padding: '10px 20px', fontWeight: 600, cursor: 'pointer', fontSize: 14,
          display: 'flex', alignItems: 'center', gap: 8
        }}>
          + Agregar persona
        </button>
      </div>

      {/* Buscador */}
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Buscar por nombre, RUT o cargo..."
        style={{
          width: '100%', boxSizing: 'border-box', padding: '10px 14px',
          borderRadius: 8, border: '1px solid #334155', background: '#1e293b',
          color: '#fff', fontSize: 14, marginBottom: 16, outline: 'none'
        }}
      />

      {/* Tabla */}
      {loading ? (
        <p style={{ color: '#94a3b8', textAlign: 'center', marginTop: 40 }}>Cargando...</p>
      ) : filtered.length === 0 ? (
        <div style={{
          background: '#1e293b', borderRadius: 12, padding: '48px 24px',
          textAlign: 'center', color: '#64748b'
        }}>
          {search ? 'Sin resultados para esa búsqueda.' : 'Aún no hay personal registrado. Agrega el primero.'}
        </div>
      ) : (
        <div style={{ background: '#1e293b', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#0f172a' }}>
                {['Nombre', 'RUT', 'Teléfono', 'Cargo', 'Acciones'].map(h => (
                  <th key={h} style={{
                    padding: '12px 16px', textAlign: 'left', color: '#94a3b8',
                    fontSize: 12, fontWeight: 600, letterSpacing: '0.05em',
                    textTransform: 'uppercase', borderBottom: '1px solid #1e293b'
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => (
                <tr key={p.id} style={{
                  borderBottom: i < filtered.length - 1 ? '1px solid #0f172a' : 'none',
                  transition: 'background 0.15s'
                }}
                  onMouseEnter={e => e.currentTarget.style.background = '#273244'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ fontWeight: 600, color: '#f1f5f9', fontSize: 14 }}>
                      {p.nombre} {p.apellido}
                    </div>
                  </td>
                  <td style={{ padding: '14px 16px', color: '#94a3b8', fontSize: 13 }}>
                    {p.rut || '—'}
                  </td>
                  <td style={{ padding: '14px 16px', color: '#94a3b8', fontSize: 13 }}>
                    {p.telefono ? (
                      <a href={`tel:${p.telefono}`} style={{ color: '#6366f1', textDecoration: 'none' }}>
                        {p.telefono}
                      </a>
                    ) : '—'}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    {p.cargo ? (
                      <span style={{
                        background: '#1e3a5f', color: '#60a5fa', borderRadius: 6,
                        padding: '3px 10px', fontSize: 12, fontWeight: 500
                      }}>{p.cargo}</span>
                    ) : '—'}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => openEdit(p)} style={{
                        background: '#334155', color: '#cbd5e1', border: 'none',
                        borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 12
                      }}>Editar</button>
                      <button onClick={() => setDeleteConfirm(p)} style={{
                        background: '#450a0a', color: '#fca5a5', border: 'none',
                        borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 12
                      }}>Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal crear / editar */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{
            background: '#1e293b', borderRadius: 16, padding: 28, width: 420,
            boxShadow: '0 25px 50px rgba(0,0,0,0.5)'
          }}>
            <h2 style={{ margin: '0 0 20px', color: '#f1f5f9', fontSize: 18 }}>
              {editing ? 'Editar persona' : 'Agregar persona'}
            </h2>

            {error && (
              <div style={{
                background: '#450a0a', color: '#fca5a5', borderRadius: 8,
                padding: '10px 12px', fontSize: 13, marginBottom: 14
              }}>
                {error}
              </div>
            )}

            {[
              { label: 'Nombre *', key: 'nombre', placeholder: 'Carlos' },
              { label: 'Apellido *', key: 'apellido', placeholder: 'González' },
              { label: 'RUT', key: 'rut', placeholder: '12.345.678-9' },
              { label: 'Teléfono', key: 'telefono', placeholder: '+56 9 1234 5678' },
              { label: 'Cargo', key: 'cargo', placeholder: 'Técnico RFID' },
            ].map(({ label, key, placeholder }) => (
              <div key={key} style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: 12, marginBottom: 6, fontWeight: 500 }}>
                  {label}
                </label>
                <input
                  value={form[key]}
                  onChange={e => setForm(f => ({
                    ...f,
                    [key]: key === 'rut' ? formatRut(e.target.value) : e.target.value
                  }))}
                  placeholder={placeholder}
                  style={{
                    width: '100%', boxSizing: 'border-box', padding: '10px 12px',
                    borderRadius: 8, border: '1px solid #334155', background: '#0f172a',
                    color: '#f1f5f9', fontSize: 14, outline: 'none'
                  }}
                />
              </div>
            ))}

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={closeModal} style={{
                flex: 1, padding: '10px', borderRadius: 8, border: '1px solid #334155',
                background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: 14
              }}>Cancelar</button>
              <button
                onClick={handleSave}
                disabled={saving || !form.nombre.trim() || !form.apellido.trim()}
                style={{
                  flex: 2, padding: '10px', borderRadius: 8, border: 'none',
                  background: saving ? '#4338ca' : '#6366f1', color: '#fff',
                  cursor: saving ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 600
                }}
              >
                {saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Agregar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmar eliminar */}
      {deleteConfirm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{
            background: '#1e293b', borderRadius: 16, padding: 28, width: 360,
            boxShadow: '0 25px 50px rgba(0,0,0,0.5)', textAlign: 'center'
          }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
            <h3 style={{ margin: '0 0 8px', color: '#f1f5f9' }}>¿Eliminar persona?</h3>
            <p style={{ color: '#94a3b8', fontSize: 13, margin: '0 0 20px' }}>
              Se eliminará a <strong style={{ color: '#f1f5f9' }}>
                {deleteConfirm.nombre} {deleteConfirm.apellido}
              </strong> permanentemente.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setDeleteConfirm(null)} style={{
                flex: 1, padding: '10px', borderRadius: 8, border: '1px solid #334155',
                background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: 14
              }}>Cancelar</button>
              <button onClick={() => handleDelete(deleteConfirm.id)} style={{
                flex: 1, padding: '10px', borderRadius: 8, border: 'none',
                background: '#dc2626', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600
              }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
