import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import adminImg from '../assets/admin.png'
import operadorImg from '../assets/operador.png'
import '../styles/login.css'

/* ─── Presets de avatar ─────────────────────────────────────────────────── */
export const AVATARS = [
  { id: 'av1', emoji: '👨‍💼', color: '#1D9E75' },
  { id: 'av2', emoji: '👩‍💼', color: '#378ADD' },
  { id: 'av3', emoji: '🧑‍🔧', color: '#EF9F27' },
  { id: 'av4', emoji: '👷', color: '#E24B4A' },
  { id: 'av5', emoji: '🧑‍💻', color: '#7C3AED' },
  { id: 'av6', emoji: '⚡',   color: '#F59E0B' },
  { id: 'av7', emoji: '🎯',   color: '#EC4899' },
  { id: 'av8', emoji: '🦁',   color: '#6366F1' },
]

export const CARGO_OPTIONS = [
  'Supervisor', 'Jefe de Bodega', 'Operador'
]

/* ─── Ícono ojo ─────────────────────────────────────────────────────────── */
function EyeIcon({ open }) {
  return open ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  )
}

/* ─── Input PIN — reemplaza el teclado visual ──────────────────────────────
 * Campo tipo password con:
 *  • Asteriscos/puntos por defecto (type="password")
 *  • Ojo para mostrar/ocultar
 *  • Acepta solo dígitos (filtra cualquier otro carácter)
 *  • Teclado numérico en móvil (inputMode="numeric")
 *  • Auto-envío al llegar a 4 dígitos
 *  • Auto-foco al montar
 * Exportado para reutilizar en Settings.jsx                               */
export function PinPad({ value = '', onChange, onSubmit, disabled = false, error = '' }) {
  const [show, setShow] = useState(false)
  const inputRef = useRef(null)

  // Auto-foco al montar (con pequeño delay para que el DOM esté listo)
  useEffect(() => {
    const t = setTimeout(() => { if (inputRef.current) inputRef.current.focus() }, 80)
    return () => clearTimeout(t)
  }, [])

  const handleChange = (e) => {
    // Filtrar cualquier carácter no numérico y limitar a 4 dígitos
    const raw = e.target.value.replace(/\D/g, '').slice(0, 4)
    onChange(raw)
    if (raw.length === 4 && onSubmit) onSubmit(raw)
  }

  const handleKeyDown = (e) => {
    // Bloquear teclas no numéricas salvo control (backspace, flechas, etc.)
    const ctrl = e.ctrlKey || e.metaKey
    const allowed = /^[0-9]$/.test(e.key) || ctrl ||
      ['Backspace','Delete','Tab','Enter','ArrowLeft','ArrowRight'].includes(e.key)
    if (!allowed) e.preventDefault()
  }

  /* ícono ojo — SVG inline para no depender de MUI en este archivo */
  const EyeIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
  const EyeOffIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )

  return (
    <div style={{ width: 200, margin: '0 auto' }}>
      <div style={{ position: 'relative' }}>
        <input
          ref={inputRef}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          maxLength={4}
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="one-time-code"
          placeholder="••••"
          style={{
            width: '100%',
            padding: '13px 44px 13px 14px',
            fontSize: 26,
            letterSpacing: '0.4em',
            textAlign: 'center',
            borderRadius: 10,
            border: `1.5px solid ${error ? '#E24B4A' : 'rgba(255,255,255,0.22)'}`,
            background: 'rgba(255,255,255,0.07)',
            color: '#fff',
            outline: 'none',
            boxSizing: 'border-box',
            caretColor: '#66FCF1',
            transition: 'border-color 0.15s',
            fontFamily: 'inherit'
          }}
        />
        <button
          type="button"
          onClick={() => setShow(s => !s)}
          tabIndex={-1}
          title={show ? 'Ocultar PIN' : 'Mostrar PIN'}
          style={{
            position: 'absolute', right: 10, top: '50%',
            transform: 'translateY(-50%)',
            background: 'none', border: 'none',
            color: 'rgba(255,255,255,0.45)',
            cursor: 'pointer', padding: 4,
            display: 'flex', alignItems: 'center',
            lineHeight: 1,
            /* override .credentials button animation that would reset transform */
            animation: 'none', opacity: 1, marginTop: 0
          }}
        >
          {show ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
      {error && (
        <p style={{ color: '#E24B4A', fontSize: 12, margin: '6px 0 0', textAlign: 'center' }}>
          {error}
        </p>
      )}
    </div>
  )
}

/* ─── Validaciones ──────────────────────────────────────────────────────── */
function validatePassword(pw) {
  if (!pw || pw.length < 8) return 'Mínimo 8 caracteres'
  if (!/[A-Z]/.test(pw))    return 'Debe incluir al menos una mayúscula'
  if (!/[0-9]/.test(pw))    return 'Debe incluir al menos un número'
  return null
}

function validateUsername(u) {
  if (!u || u.length < 3) return 'Mínimo 3 caracteres'
  if (/\s/.test(u))        return 'Sin espacios'
  return null
}

/* ─── Selector de avatar ────────────────────────────────────────────────── */
function AvatarPicker({ value, onChange }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <p style={{ fontSize: 12, color: '#C5C6C7', margin: '0 0 8px', textAlign: 'left' }}>
        Elige tu avatar
      </p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {AVATARS.map(av => (
          <button
            key={av.id}
            type="button"
            onClick={() => onChange(av.id)}
            style={{
              width: 48, height: 48, borderRadius: '50%',
              background: av.color,
              border: value === av.id ? '3px solid #66FCF1' : '3px solid transparent',
              cursor: 'pointer', fontSize: 22,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'transform 0.15s, border-color 0.15s',
              transform: value === av.id ? 'scale(1.15)' : 'scale(1)',
              outline: 'none', padding: 0,
              /* override .credentials button animation */
              animation: 'none', opacity: 1, marginTop: 0
            }}
          >
            {av.emoji}
          </button>
        ))}
      </div>
    </div>
  )
}

/* ─── Formulario de creación de cuenta ─────────────────────────────────── */
function CreateAccountForm({ selectedRole, adminExists, onBack }) {
  const { createUser, login } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    nombre: '', apellido: '', email: '', cargo: CARGO_OPTIONS[0],
    avatar: '', username: '', password: '', confirm: ''
  })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [globalError, setGlobalError] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const set = (k, v) => {
    setForm(f => ({ ...f, [k]: v }))
    setErrors(e => ({ ...e, [k]: '' }))
    setGlobalError('')
  }

  const validate = () => {
    const e = {}
    if (!form.nombre.trim())    e.nombre = 'Requerido'
    if (!form.apellido.trim())  e.apellido = 'Requerido'
    if (!form.cargo)            e.cargo = 'Requerido'
    if (!form.avatar)           e.avatar = 'Elige un avatar'
    const uErr = validateUsername(form.username)
    if (uErr) e.username = uErr
    const pErr = validatePassword(form.password)
    if (pErr) e.password = pErr
    if (form.password !== form.confirm) e.confirm = 'Las contraseñas no coinciden'
    return e
  }

  const handleSubmit = async () => {
    const e = validate()
    if (Object.keys(e).length > 0) { setErrors(e); return }
    setLoading(true)
    setGlobalError('')
    const data = {
      role: selectedRole,
      nombre: form.nombre.trim(),
      apellido: form.apellido.trim(),
      email: form.email.trim(),
      cargo: form.cargo,
      avatar: form.avatar,
      username: form.username.trim()
    }
    try {
      const res = await createUser(data, form.password)
      if (!res.ok) {
        setGlobalError(res.error || 'Error al crear la cuenta')
        setLoading(false)
        return
      }
      const loginRes = await login(form.username.trim(), form.password)
      if (!loginRes?.ok) {
        setGlobalError('Cuenta creada. Reinicia la app e inicia sesión.')
        setLoading(false)
        return
      }
      navigate('/dashboard')
    } catch (err) {
      console.error('[CreateAccount]', err)
      setGlobalError('Error de conexión con la BD. Reinicia la aplicación.')
      setLoading(false)
    }
  }

  const inputStyle = {
    padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.18)',
    background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: 14, width: '100%',
    boxSizing: 'border-box', outline: 'none'
  }
  const labelStyle = { fontSize: 12, color: '#C5C6C7', marginBottom: 4, display: 'block', textAlign: 'left' }
  const errStyle  = { fontSize: 11, color: '#E24B4A', marginTop: 2 }
  const eyeStyle  = {
    position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
    background: 'none', border: 'none', cursor: 'pointer',
    color: 'rgba(255,255,255,0.45)', padding: 4,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    animation: 'none', opacity: 1, marginTop: 0
  }

  return (
    <div style={{ width: '100%', maxWidth: 420, margin: '0 auto' }}>
      <h2 style={{ textAlign: 'center', color: '#66FCF1', marginBottom: 4, fontSize: 22 }}>
        Crear cuenta
      </h2>
      <p style={{ textAlign: 'center', color: '#C5C6C7', fontSize: 13, marginBottom: 20 }}>
        {selectedRole === 'admin' ? '👑 Administrador' : '🔧 Operador'}
      </p>

      {/* Nombre + Apellido */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Nombre *</label>
          <input
            style={{ ...inputStyle, borderColor: errors.nombre ? '#E24B4A' : 'rgba(255,255,255,0.18)' }}
            value={form.nombre} onChange={e => set('nombre', e.target.value)} placeholder="Juan" />
          {errors.nombre && <p style={errStyle}>{errors.nombre}</p>}
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Apellido *</label>
          <input
            style={{ ...inputStyle, borderColor: errors.apellido ? '#E24B4A' : 'rgba(255,255,255,0.18)' }}
            value={form.apellido} onChange={e => set('apellido', e.target.value)} placeholder="Pérez" />
          {errors.apellido && <p style={errStyle}>{errors.apellido}</p>}
        </div>
      </div>

      {/* Email */}
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>Correo electrónico</label>
        <input style={inputStyle} type="email"
          value={form.email} onChange={e => set('email', e.target.value)}
          placeholder="correo@empresa.cl" />
      </div>

      {/* Cargo */}
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>Cargo *</label>
        <select
          value={form.cargo}
          onChange={e => set('cargo', e.target.value)}
          style={{ ...inputStyle, cursor: 'pointer', borderColor: errors.cargo ? '#E24B4A' : 'rgba(255,255,255,0.18)' }}
        >
          {CARGO_OPTIONS.map(c => <option key={c} value={c} style={{ background: '#1F2833' }}>{c}</option>)}
        </select>
        {errors.cargo && <p style={errStyle}>{errors.cargo}</p>}
      </div>

      {/* Avatar */}
      <AvatarPicker value={form.avatar} onChange={v => set('avatar', v)} />
      {errors.avatar && <p style={{ ...errStyle, marginTop: -8, marginBottom: 8 }}>{errors.avatar}</p>}

      {/* Username */}
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>Nombre de usuario *</label>
        <input
          style={{ ...inputStyle, borderColor: errors.username ? '#E24B4A' : 'rgba(255,255,255,0.18)' }}
          value={form.username} onChange={e => set('username', e.target.value.toLowerCase())}
          placeholder="juanperez" autoComplete="off" />
        {errors.username && <p style={errStyle}>{errors.username}</p>}
      </div>

      {/* Password + Confirm */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Contraseña *</label>
          <div style={{ position: 'relative' }}>
            <input
              style={{ ...inputStyle, paddingRight: 36, borderColor: errors.password ? '#E24B4A' : 'rgba(255,255,255,0.18)' }}
              type={showPw ? 'text' : 'password'}
              value={form.password} onChange={e => set('password', e.target.value)}
              placeholder="Mín. 8 car., 1 may., 1 núm." />
            <button type="button" tabIndex={-1} onClick={() => setShowPw(v => !v)} style={eyeStyle}>
              <EyeIcon open={showPw} />
            </button>
          </div>
          {errors.password && <p style={errStyle}>{errors.password}</p>}
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Confirmar *</label>
          <div style={{ position: 'relative' }}>
            <input
              style={{ ...inputStyle, paddingRight: 36, borderColor: errors.confirm ? '#E24B4A' : 'rgba(255,255,255,0.18)' }}
              type={showConfirm ? 'text' : 'password'}
              value={form.confirm} onChange={e => set('confirm', e.target.value)}
              placeholder="Repetir contraseña" />
            <button type="button" tabIndex={-1} onClick={() => setShowConfirm(v => !v)} style={eyeStyle}>
              <EyeIcon open={showConfirm} />
            </button>
          </div>
          {errors.confirm && <p style={errStyle}>{errors.confirm}</p>}
        </div>
      </div>

      {globalError && (
        <p style={{ color: '#E24B4A', fontSize: 13, textAlign: 'center', marginBottom: 12 }}>
          {globalError}
        </p>
      )}

      <button
        onClick={handleSubmit}
        disabled={loading}
        style={{
          width: '100%', padding: '13px', borderRadius: 8, border: 'none',
          background: '#1D9E75', color: '#000', fontWeight: 700, fontSize: 15,
          cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1,
          animation: 'none', marginTop: 0
        }}
      >
        {loading ? 'Creando cuenta…' : 'Crear cuenta'}
      </button>

      <button
        onClick={onBack}
        style={{
          width: '100%', marginTop: 10, padding: '10px', borderRadius: 8,
          border: '1px solid rgba(255,255,255,0.18)', background: 'transparent',
          color: '#C5C6C7', fontSize: 14, cursor: 'pointer',
          animation: 'none', opacity: 1, transform: 'none'
        }}
      >
        ← Volver
      </button>
    </div>
  )
}

/* ─── Pantalla de setup inicial (primera vez, sin config) ──────────────── */
function SetupScreen({ onDone }) {
  const [step, setStep] = useState('choice') // 'choice' | 'connect'

  // Auto-descubrimiento
  const [discovering, setDiscovering]   = useState(false)
  const [discoveredUrl, setDiscoveredUrl] = useState(null)  // URL encontrada por UDP

  // Fallback manual
  const [serverUrl, setServerUrl]   = useState('')
  const [verifying, setVerifying]   = useState(false)
  const [error, setError]           = useState('')
  const [showManual, setShowManual] = useState(false) // true si UDP no encontró nada

  // Al entrar al paso 'connect', lanzar auto-descubrimiento UDP
  useEffect(() => {
    if (step !== 'connect') return
    // Reset states
    setDiscovering(true)
    setDiscoveredUrl(null)
    setShowManual(false)
    setError('')
    setServerUrl('')

    // Si no hay Electron (modo web / sin preload) saltar directo al manual
    if (!window.api?.discoverServer) {
      setDiscovering(false)
      setShowManual(true)
      return
    }

    window.api.discoverServer().then(res => {
      setDiscovering(false)
      if (res?.ok && res?.url) {
        setDiscoveredUrl(res.url)
        setServerUrl(res.url)
      } else {
        // Tiempo agotado — mostrar formulario manual
        setShowManual(true)
        setError('No se encontró servidor automáticamente. Ingresa la IP del administrador.')
      }
    }).catch(() => {
      setDiscovering(false)
      setShowManual(true)
      setError('Error en auto-descubrimiento. Ingresa la IP del administrador.')
    })
  }, [step])

  const cardBase = {
    background: 'rgba(31,40,51,0.95)',
    border: '2px solid rgba(102,252,241,0.15)',
    borderRadius: 16, padding: '28px 24px',
    cursor: 'pointer', textAlign: 'center',
    transition: 'border-color 0.2s, transform 0.2s',
    flex: 1, maxWidth: 280
  }

  const handleChooseServer = async () => {
    await window.api?.saveConfig?.({ mode: 'server' })
    onDone('server')
  }

  const handleConnect = async (urlToUse) => {
    setError('')
    let url = (urlToUse || serverUrl).trim()
    if (!url) { setError('Ingresa la IP del servidor'); return }
    if (!url.startsWith('http')) url = `http://${url}`
    if (!/:\d+$/.test(url)) url = `${url}:3005`
    setVerifying(true)
    const res = await window.api?.verifyServer?.(url)
    setVerifying(false)
    if (!res?.ok) {
      setError(res?.error || 'No se pudo conectar al servidor')
      return
    }
    await window.api?.saveConfig?.({ mode: 'client', serverUrl: url })
    onDone('client')
  }

  const inputStyle = (hasErr) => ({
    padding: '11px 14px', borderRadius: 8,
    border: `1.5px solid ${hasErr ? '#E24B4A' : 'rgba(255,255,255,0.2)'}`,
    background: 'rgba(255,255,255,0.07)', color: '#fff',
    fontSize: 15, width: '100%', boxSizing: 'border-box',
    outline: 'none', fontFamily: 'inherit'
  })

  const btnPrimary = (disabled) => ({
    marginTop: 16, width: '100%', padding: '13px', borderRadius: 8,
    border: 'none', background: '#66FCF1', color: '#000',
    fontWeight: 700, fontSize: 15,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.7 : 1, animation: 'none'
  })

  const btnSecondary = {
    marginTop: 10, width: '100%', padding: '10px', borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.15)', background: 'transparent',
    color: '#C5C6C7', fontSize: 14, cursor: 'pointer', animation: 'none'
  }

  if (step === 'connect') {
    return (
      <div style={{ width: '100%', maxWidth: 380, textAlign: 'center' }}>
        <h2 style={{ color: '#66FCF1', marginBottom: 6, fontSize: 20 }}>
          Conectar al servidor
        </h2>

        {/* ── Estado: buscando ── */}
        {discovering && (
          <div style={{ padding: '32px 0' }}>
            {/* Spinner animado */}
            <div style={{
              width: 48, height: 48, margin: '0 auto 20px',
              border: '4px solid rgba(102,252,241,0.2)',
              borderTopColor: '#66FCF1',
              borderRadius: '50%',
              animation: 'spin 0.9s linear infinite'
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <p style={{ color: '#66FCF1', fontWeight: 600, margin: '0 0 6px', fontSize: 15 }}>
              Buscando servidor en la red…
            </p>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, margin: 0 }}>
              Esto puede tardar hasta 8 segundos
            </p>
          </div>
        )}

        {/* ── Estado: servidor encontrado ── */}
        {!discovering && discoveredUrl && (
          <div style={{ padding: '8px 0 4px' }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>✅</div>
            <p style={{ color: '#66FCF1', fontWeight: 600, margin: '0 0 4px', fontSize: 15 }}>
              Servidor encontrado
            </p>
            <p style={{
              color: 'rgba(255,255,255,0.55)', fontSize: 13,
              background: 'rgba(102,252,241,0.06)',
              border: '1px solid rgba(102,252,241,0.2)',
              borderRadius: 8, padding: '8px 14px',
              margin: '12px 0 0', wordBreak: 'break-all'
            }}>
              {discoveredUrl}
            </p>
            {error && (
              <p style={{ color: '#E24B4A', fontSize: 12, marginTop: 8 }}>{error}</p>
            )}
            <button
              onClick={() => handleConnect(discoveredUrl)}
              disabled={verifying}
              style={btnPrimary(verifying)}
            >
              {verifying ? 'Verificando…' : 'Conectar'}
            </button>
            <button
              onClick={() => { setDiscoveredUrl(null); setShowManual(true); setError('') }}
              style={btnSecondary}
            >
              Ingresar IP manualmente
            </button>
          </div>
        )}

        {/* ── Estado: fallback manual (UDP falló o usuario lo eligió) ── */}
        {!discovering && !discoveredUrl && showManual && (
          <div>
            {error && (
              <p style={{ color: 'rgba(255,200,100,0.85)', fontSize: 12, margin: '0 0 16px' }}>
                {error}
              </p>
            )}
            <p style={{ color: '#C5C6C7', fontSize: 13, margin: '0 0 16px' }}>
              Ingresa la IP del PC del administrador.
              Puedes verla en <strong>Ajustes → Información del sistema</strong>.
            </p>
            <input
              style={inputStyle(!!error && !serverUrl)}
              placeholder="192.168.1.100  ó  192.168.1.100:3005"
              value={serverUrl}
              onChange={e => { setServerUrl(e.target.value); setError('') }}
              onKeyDown={e => e.key === 'Enter' && handleConnect()}
              autoFocus
            />
            {error && serverUrl && (
              <p style={{ color: '#E24B4A', fontSize: 12, marginTop: 8 }}>{error}</p>
            )}
            <button
              onClick={() => handleConnect()}
              disabled={verifying}
              style={btnPrimary(verifying)}
            >
              {verifying ? 'Verificando…' : 'Conectar'}
            </button>
            <button
              onClick={() => {
                setShowManual(false)
                setError('')
                setServerUrl('')
                setStep('connect') // re-trigger useEffect → nueva búsqueda
              }}
              style={btnSecondary}
            >
              🔄 Buscar de nuevo
            </button>
          </div>
        )}

        <button
          onClick={() => { setStep('choice'); setError('') }}
          style={{ ...btnSecondary, marginTop: 14, color: 'rgba(255,255,255,0.35)', fontSize: 12, border: 'none' }}
        >
          ← Volver
        </button>
      </div>
    )
  }

  return (
    <div style={{ width: '100%', maxWidth: 620, textAlign: 'center' }}>
      <h2 style={{ color: '#66FCF1', marginBottom: 6, fontSize: 22 }}>
        Configuración inicial
      </h2>
      <p style={{ color: '#C5C6C7', fontSize: 14, marginBottom: 32 }}>
        ¿Cómo deseas usar este equipo?
      </p>
      <div style={{ display: 'flex', gap: 20, justifyContent: 'center', flexWrap: 'wrap' }}>
        <div
          style={cardBase}
          onClick={handleChooseServer}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#66FCF1'; e.currentTarget.style.transform = 'translateY(-3px)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(102,252,241,0.15)'; e.currentTarget.style.transform = 'none' }}
        >
          <div style={{ fontSize: 42, marginBottom: 12 }}>🖥️</div>
          <h3 style={{ color: '#fff', margin: '0 0 8px', fontSize: 17 }}>Servidor principal</h3>
          <p style={{ color: '#C5C6C7', fontSize: 13, margin: 0, lineHeight: 1.5 }}>
            Este PC almacena todos los datos. Los demás equipos se conectarán a él.
          </p>
        </div>
        <div
          style={cardBase}
          onClick={() => setStep('connect')}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#66FCF1'; e.currentTarget.style.transform = 'translateY(-3px)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(102,252,241,0.15)'; e.currentTarget.style.transform = 'none' }}
        >
          <div style={{ fontSize: 42, marginBottom: 12 }}>🔗</div>
          <h3 style={{ color: '#fff', margin: '0 0 8px', fontSize: 17 }}>Conectarme a otro equipo</h3>
          <p style={{ color: '#C5C6C7', fontSize: 13, margin: 0, lineHeight: 1.5 }}>
            Este PC se conectará al servidor del administrador para ver todos los datos sincronizados.
          </p>
        </div>
      </div>
    </div>
  )
}

/* ─── Pantalla principal de Login ───────────────────────────────────────── */
export default function Login() {
  const { login, loginPin, loadUsers, hasAnyUsers, loginUsers } = useAuth()
  const navigate = useNavigate()

  // Config leída síncronamente al montar (antes del primer render)
  const [appCfg] = useState(() => {
    try { return window.api?.getConfig?.() || {} } catch { return {} }
  })
  const isClientMode = appCfg.mode === 'client'

  // 'loading' | 'setup' | 'firstRun' | 'login'
  const [phase, setPhase] = useState('loading')
  const [adminExists, setAdminExists] = useState(false)

  // First-run
  const [createStep, setCreateStep] = useState('role')   // 'role' | 'form'
  const [createRole, setCreateRole] = useState(null)

  // Login normal
  const [loginStep, setLoginStep]   = useState('role')   // 'role' | 'credentials'
  const [selectedRole, setSelectedRole] = useState(null)
  const [loginMode, setLoginMode]   = useState('password') // 'password' | 'pin'

  // Password mode
  const [username, setUsername]     = useState('')
  const [password, setPassword]     = useState('')
  const [showPw, setShowPw]         = useState(false)
  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)

  // PIN mode
  const [pinUser, setPinUser]       = useState(null)
  const [pinDigits, setPinDigits]   = useState('')
  const [pinError, setPinError]     = useState('')
  const [pinLoading, setPinLoading] = useState(false)

  // Determinar fase inicial:
  //  1. Leer config (síncrono, ya disponible desde main.js)
  //  2. Sin config → mostrar pantalla de setup
  //  3. Modo cliente → ir directo a login (el server ya tiene usuarios)
  //  4. Modo servidor → firstRun si no hay usuarios, login si hay
  useEffect(() => {
    const cfg = window.api?.getConfig?.() || {}

    // Primera ejecución: aún no eligió modo
    if (!cfg.mode) {
      setPhase('setup')
      return
    }

    // Modo cliente: saltar directo al formulario de operador (sin elección de rol)
    if (cfg.mode === 'client') {
      if (hasAnyUsers === null) return // cargando
      setPhase('login')
      setSelectedRole('operador')
      setLoginStep('credentials')
      return
    }

    // Modo servidor: flujo normal
    if (hasAnyUsers === null) return
    setPhase(hasAnyUsers ? 'login' : 'firstRun')
  }, [hasAnyUsers]) // eslint-disable-line

  const handleSetupDone = (mode) => {
    if (mode === 'server') {
      // Recargar para que api.js/socket.js lean el config nuevo
      window.location.reload()
    } else {
      window.location.reload()
    }
  }

  const handleLoginRoleSelect = (role) => {
    setSelectedRole(role)
    setLoginError('')
    setPinUser(null)
    setPinDigits('')
    setPinError('')
    setLoginMode('password')
    setTimeout(() => setLoginStep('credentials'), 300)
  }

  const handleLogin = async () => {
    setLoginError('')
    setLoginLoading(true)
    const res = await login(username, password)
    setLoginLoading(false)
    if (!res.ok) { setLoginError(res.error || 'Credenciales incorrectas'); return }
    // En modo cliente no validamos rol (solo existe el operador en este equipo)
    if (!isClientMode && res.user.role !== selectedRole) {
      setLoginError('El usuario no corresponde al perfil seleccionado')
      return
    }
    navigate('/dashboard')
  }

  const handlePinSubmit = async (val) => {
    if (!pinUser) return
    setPinLoading(true)
    const res = await loginPin(pinUser.id, val)
    setPinLoading(false)
    if (!res.ok) {
      setPinError('PIN incorrecto')
      setTimeout(() => { setPinDigits(''); setPinError('') }, 500)
      return
    }
    navigate('/dashboard')
  }

  const handleKeyDown = (e) => { if (e.key === 'Enter') handleLogin() }

  const handleBack = () => {
    setLoginStep('role')
    setSelectedRole(null)
    setUsername('')
    setPassword('')
    setLoginError('')
    setPinUser(null)
    setPinDigits('')
    setPinError('')
    setLoginMode('password')
  }

  const switchMode = (mode) => {
    setLoginMode(mode)
    setPinUser(null)
    setPinDigits('')
    setPinError('')
    setLoginError('')
  }

  // ─── Loading ───────────────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <div className="login-container" style={{ justifyContent: 'center' }}>
        <p style={{ color: '#C5C6C7' }}>Cargando…</p>
      </div>
    )
  }

  // ─── Setup (primera vez — sin config.json) ─────────────────────────────
  if (phase === 'setup') {
    return (
      <div className="login-container">
        <div className="login-main" style={{ alignItems: 'center', justifyContent: 'center' }}>
          <SetupScreen onDone={handleSetupDone} />
        </div>
        <img src="/logo-header.png" alt="Orbitag" className="login-logo" />
      </div>
    )
  }

  // Resetea la config y vuelve al setup (para corregir elección de modo)
  const handleResetConfig = async () => {
    await window.api?.saveConfig?.({})
    window.location.reload()
  }

  // ─── First run ─────────────────────────────────────────────────────────
  // Solo llega acá en modo servidor sin usuarios. Solo muestra Admin.
  if (phase === 'firstRun') {
    return (
      <div className="login-container">
        <div className="login-main">
          {createStep === 'role' && (
            <>
              <p style={{ color: '#66FCF1', marginBottom: 24, fontSize: 16, textAlign: 'center' }}>
                Bienvenido. Crea la cuenta de administrador del sistema.
              </p>
              <div className="cards" style={{ justifyContent: 'center' }}>
                <div
                  className="card admin"
                  onClick={() => { setCreateRole('admin'); setCreateStep('form') }}
                >
                  <img src={adminImg} alt="Administrador" />
                  <h2>Administrador</h2>
                  <p>Control total del sistema</p>
                </div>
              </div>
              {/* Escape para quien eligió "Servidor" por error */}
              <button
                onClick={handleResetConfig}
                style={{
                  marginTop: 28, background: 'none', border: 'none',
                  color: 'rgba(255,255,255,0.35)', fontSize: 12,
                  cursor: 'pointer', textDecoration: 'underline',
                  animation: 'none', opacity: 1
                }}
              >
                ← Este equipo no es el servidor principal
              </button>
            </>
          )}

          {createStep === 'form' && (
            <div style={{
              width: '100%', maxWidth: 440,
              background: 'rgba(31,40,51,0.95)',
              borderRadius: 16, padding: '28px 28px 20px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
              overflowY: 'auto', maxHeight: '82vh', boxSizing: 'border-box'
            }}>
              <CreateAccountForm
                selectedRole={createRole}
                adminExists={adminExists}
                onBack={() => setCreateStep('role')}
              />
            </div>
          )}
        </div>

        <img
          src="/logo-header.png"
          alt="Orbitag"
          className={`login-logo ${createStep === 'form' ? 'hide' : ''}`}
        />
      </div>
    )
  }

  // ─── Login normal ──────────────────────────────────────────────────────
  // Usuarios con PIN configurado y del rol seleccionado (pre-auth, lista pública)
  const pinUsers = loginUsers.filter(u => u.role === selectedRole && u.hasPin)

  const modeToggleStyle = (active) => ({
    flex: 1, padding: '7px 0', borderRadius: 6, border: 'none', fontSize: 12,
    background: active ? 'rgba(102,252,241,0.2)' : 'transparent',
    color: active ? '#66FCF1' : 'rgba(255,255,255,0.45)',
    fontWeight: active ? 600 : 400,
    cursor: 'pointer', transition: 'all 0.2s',
    /* override .credentials button animation */
    animation: 'none', opacity: 1, marginTop: 0, transform: 'none'
  })

  return (
    <div className="login-container">
      {loginStep === 'credentials' && !isClientMode && (
        <button className="back-arrow" onClick={handleBack} aria-label="Volver">
          <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"
            strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M11 18l-6-6 6-6" />
          </svg>
        </button>
      )}

      <div className="login-main">
        <div className={`cards ${selectedRole ? 'selected' : ''}`}>
          {(loginStep === 'role' || selectedRole === 'admin') && (
            <div
              className={`card admin ${selectedRole === 'admin' ? 'active' : ''}`}
              onClick={() => loginStep === 'role' && handleLoginRoleSelect('admin')}
            >
              <img src={adminImg} alt="Administrador" />
              <h2>Administrador</h2>
              <p>Control total del sistema</p>
            </div>
          )}
          {(loginStep === 'role' || selectedRole === 'operador') && (
            <div
              className={`card operator ${selectedRole === 'operador' ? 'active' : ''}`}
              onClick={() => loginStep === 'role' && handleLoginRoleSelect('operador')}
            >
              <img src={operadorImg} alt="Operador" />
              <h2>Operador</h2>
              <p>Gestión operativa</p>
            </div>
          )}
        </div>

        {/* Credentials panel — width expands in PIN mode */}
        <div
          className={`credentials ${loginStep === 'credentials' ? 'show' : ''}`}
          style={loginMode === 'pin' ? { width: 'min(320px, 88vw)' } : {}}
        >
          {/* Selector de modo */}
          <div style={{
            display: 'flex', borderRadius: 8, background: 'rgba(255,255,255,0.07)',
            padding: 3, gap: 3,
            animation: 'none', opacity: 1, marginTop: 0, transform: 'none'
          }}>
            <button type="button" style={modeToggleStyle(loginMode === 'password')}
              onClick={() => switchMode('password')}>
              🔑 Contraseña
            </button>
            <button type="button" style={modeToggleStyle(loginMode === 'pin')}
              onClick={() => switchMode('pin')}>
              🔢 PIN rápido
            </button>
          </div>

          {/* ── Modo contraseña ── */}
          {loginMode === 'password' && (
            <>
              <input
                type="text"
                placeholder="Usuario"
                value={username}
                onChange={e => { setUsername(e.target.value); setLoginError('') }}
                onKeyDown={handleKeyDown}
                autoComplete="off"
              />
              {/* Wrapper relativo para el botón ojo */}
              <div style={{ position: 'relative' }}>
                <input
                  type={showPw ? 'text' : 'password'}
                  placeholder="Contraseña"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setLoginError('') }}
                  onKeyDown={handleKeyDown}
                  style={{ paddingRight: 38, width: '100%', boxSizing: 'border-box' }}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPw(v => !v)}
                  style={{
                    position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'rgba(80,80,80,0.9)', padding: 4,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    animation: 'none', opacity: 1, marginTop: 0
                  }}
                >
                  <EyeIcon open={showPw} />
                </button>
              </div>
              {loginError && (
                <p style={{ color: '#E24B4A', fontSize: 12, margin: 0, textAlign: 'center' }}>
                  {loginError}
                </p>
              )}
              <button onClick={handleLogin} disabled={loginLoading}>
                {loginLoading ? 'Verificando…' : 'Ingresar'}
              </button>
            </>
          )}

          {/* ── Modo PIN ── */}
          {loginMode === 'pin' && (
            <div style={{ animation: 'none', opacity: 1, transform: 'none', marginTop: 6 }}>
              {!pinUser ? (
                /* Selector de usuario */
                <>
                  <p style={{
                    textAlign: 'center', color: '#C5C6C7', fontSize: 12,
                    margin: '4px 0 12px'
                  }}>
                    Selecciona tu perfil
                  </p>
                  {pinUsers.length === 0 ? (
                    <p style={{
                      textAlign: 'center', color: 'rgba(255,255,255,0.3)',
                      fontSize: 12, margin: 0
                    }}>
                      Ningún usuario tiene PIN configurado
                    </p>
                  ) : (
                    <div style={{
                      display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center'
                    }}>
                      {pinUsers.map(u => {
                        const av = AVATARS.find(a => a.id === u.avatar) || AVATARS[0]
                        return (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => { setPinUser(u); setPinDigits(''); setPinError('') }}
                            style={{
                              display: 'flex', flexDirection: 'column', alignItems: 'center',
                              gap: 5, padding: '10px 14px', borderRadius: 10,
                              border: '1px solid rgba(255,255,255,0.1)',
                              background: 'rgba(255,255,255,0.05)',
                              cursor: 'pointer', color: '#fff', minWidth: 72,
                              animation: 'none', opacity: 1, marginTop: 0, transform: 'none',
                              transition: 'background 0.15s'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(102,252,241,0.1)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                          >
                            <div style={{
                              width: 44, height: 44, borderRadius: '50%', background: av.color,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 20
                            }}>
                              {av.emoji}
                            </div>
                            <span style={{ fontSize: 12, fontWeight: 600 }}>{u.nombre}</span>
                            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>
                              {u.cargo || u.username}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </>
              ) : (
                /* Numpad */
                <>
                  {/* Avatar del usuario seleccionado */}
                  {(() => {
                    const av = AVATARS.find(a => a.id === pinUser.avatar) || AVATARS[0]
                    return (
                      <div style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                        gap: 3, marginBottom: 16
                      }}>
                        <div style={{
                          width: 52, height: 52, borderRadius: '50%', background: av.color,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 24
                        }}>
                          {av.emoji}
                        </div>
                        <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>
                          {pinUser.nombre} {pinUser.apellido}
                        </p>
                        <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>
                          {pinUser.cargo || ''}
                        </p>
                      </div>
                    )
                  })()}

                  <PinPad
                    value={pinDigits}
                    onChange={(v) => { setPinDigits(v); if (pinError) setPinError('') }}
                    onSubmit={handlePinSubmit}
                    disabled={pinLoading}
                    error={pinError}
                  />

                  <button
                    type="button"
                    onClick={() => { setPinUser(null); setPinDigits(''); setPinError('') }}
                    style={{
                      marginTop: 14, background: 'none', border: 'none',
                      color: 'rgba(255,255,255,0.38)', fontSize: 11,
                      cursor: 'pointer', textDecoration: 'underline',
                      animation: 'none', opacity: 1, transform: 'none',
                      padding: 0, display: 'block', margin: '14px auto 0'
                    }}
                  >
                    ← Otros usuarios
                  </button>
                </>
              )}
            </div>
          )}

          {/* ── Escape al fondo del panel de credenciales ─────────────────
              • Modo cliente: resetear config → volver al setup
              • Modo servidor viendo operador: cambiar a admin            */}
          {loginStep === 'credentials' && (
            <div style={{ marginTop: 14, textAlign: 'center' }}>
              {isClientMode ? (
                <button
                  onClick={handleResetConfig}
                  style={{
                    background: 'none', border: 'none', padding: 0,
                    color: 'rgba(255,255,255,0.28)', fontSize: 11,
                    cursor: 'pointer', textDecoration: 'underline',
                    animation: 'none', opacity: 1
                  }}
                >
                  ← Cambiar configuración de equipo
                </button>
              ) : selectedRole === 'operador' ? (
                <button
                  onClick={() => handleLoginRoleSelect('admin')}
                  style={{
                    background: 'none', border: 'none', padding: 0,
                    color: 'rgba(102,252,241,0.5)', fontSize: 11,
                    cursor: 'pointer', textDecoration: 'underline',
                    animation: 'none', opacity: 1
                  }}
                >
                  Ingresar como Administrador →
                </button>
              ) : selectedRole === 'admin' ? (
                <button
                  onClick={() => handleLoginRoleSelect('operador')}
                  style={{
                    background: 'none', border: 'none', padding: 0,
                    color: 'rgba(255,255,255,0.28)', fontSize: 11,
                    cursor: 'pointer', textDecoration: 'underline',
                    animation: 'none', opacity: 1
                  }}
                >
                  ← Ingresar como Operador
                </button>
              ) : null}
            </div>
          )}
        </div>
      </div>

      <img
        src="/logo-header.png"
        alt="Orbitag"
        className={`login-logo ${loginStep === 'credentials' ? 'hide' : ''}`}
      />

      {/* Enlace de escape en pantalla de selección de rol (modo servidor) */}
      {loginStep === 'role' && !isClientMode && (
        <button
          onClick={handleResetConfig}
          style={{
            position: 'fixed', bottom: 18, left: '50%', transform: 'translateX(-50%)',
            background: 'none', border: 'none',
            color: 'rgba(255,255,255,0.22)', fontSize: 11,
            cursor: 'pointer', textDecoration: 'underline',
            animation: 'none', opacity: 1
          }}
        >
          ← Cambiar configuración de equipo
        </button>
      )}
    </div>
  )
}
