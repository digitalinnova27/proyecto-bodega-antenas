import { useState, useEffect } from 'react'
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
  'Jefe de Bodega', 'Supervisor', 'Coordinador', 'Operario', 'Técnico', 'Otro'
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

/* ─── Numpad PIN (exportado para reutilizar en Settings) ─────────────────── */
export function PinPad({ value = '', onChange, onSubmit, disabled = false, error = '' }) {
  const handleDigit = (d) => {
    if (value.length >= 4 || disabled) return
    const next = value + d
    onChange(next)
    if (next.length === 4 && onSubmit) onSubmit(next)
  }
  const handleBack = () => {
    if (disabled) return
    onChange(value.slice(0, -1))
  }
  const keys = ['1','2','3','4','5','6','7','8','9','','0','⌫']
  return (
    <div>
      {/* Indicadores de dígito */}
      <div style={{ display: 'flex', gap: 14, justifyContent: 'center', marginBottom: 18 }}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{
            width: 13, height: 13, borderRadius: '50%',
            background: i < value.length ? '#66FCF1' : 'rgba(255,255,255,0.2)',
            transition: 'background 0.12s',
            boxShadow: i < value.length ? '0 0 6px #66FCF1' : 'none'
          }} />
        ))}
      </div>
      {error && (
        <p style={{ color: '#E24B4A', fontSize: 12, textAlign: 'center', margin: '0 0 10px' }}>
          {error}
        </p>
      )}
      {/* Teclado numérico 3×4 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, maxWidth: 216, margin: '0 auto' }}>
        {keys.map((k, i) => (
          <button
            key={i}
            type="button"
            disabled={disabled || k === ''}
            onClick={() => k === '⌫' ? handleBack() : k && handleDigit(k)}
            style={{
              height: 54, borderRadius: 10, border: 'none',
              background: k === '' ? 'transparent'
                : k === '⌫' ? 'rgba(255,255,255,0.07)'
                : 'rgba(255,255,255,0.11)',
              color: '#fff', fontSize: k === '⌫' ? 18 : 20, fontWeight: 600,
              cursor: k === '' ? 'default' : 'pointer', outline: 'none',
              /* override .credentials button animation */
              animation: 'none', opacity: 1, transform: 'none',
              marginTop: 0, padding: 0, transition: 'background 0.12s'
            }}
          >
            {k}
          </button>
        ))}
      </div>
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

/* ─── Pantalla principal de Login ───────────────────────────────────────── */
export default function Login() {
  const { login, loginPin, loadUsers, users } = useAuth()
  const navigate = useNavigate()

  // 'loading' | 'firstRun' | 'login'
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

  useEffect(() => {
    loadUsers()
      .then(list => {
        const hasAdmin = list.some(u => u.role === 'admin')
        setAdminExists(hasAdmin)
        setPhase(list.length === 0 ? 'firstRun' : 'login')
      })
      .catch(() => setPhase('firstRun'))
  }, []) // eslint-disable-line

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
    if (res.user.role !== selectedRole) {
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

  // ─── First run ─────────────────────────────────────────────────────────
  if (phase === 'firstRun') {
    return (
      <div className="login-container">
        <div className="login-main">
          {createStep === 'role' && (
            <>
              <p style={{ color: '#66FCF1', marginBottom: 24, fontSize: 16, textAlign: 'center' }}>
                Bienvenido. Crea la primera cuenta del sistema.
              </p>
              <div className="cards">
                <div
                  className="card admin"
                  onClick={() => { setCreateRole('admin'); setCreateStep('form') }}
                >
                  <img src={adminImg} alt="Administrador" />
                  <h2>Administrador</h2>
                  <p>Control total del sistema</p>
                </div>
                <div
                  className={`card operator ${adminExists ? 'disabled' : ''}`}
                  style={adminExists ? { opacity: 0.4, pointerEvents: 'none' } : {}}
                  onClick={() => !adminExists && (setCreateRole('operador'), setCreateStep('form'))}
                >
                  <img src={operadorImg} alt="Operador" />
                  <h2>Operador</h2>
                  <p>{adminExists ? 'Crea el admin primero' : 'Gestión operativa'}</p>
                </div>
              </div>
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
  // Usuarios con PIN configurado y del rol seleccionado
  const pinUsers = users.filter(u => u.role === selectedRole && u.hasPin)

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
      {loginStep === 'credentials' && (
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
        </div>
      </div>

      <img
        src="/logo-header.png"
        alt="Orbitag"
        className={`login-logo ${loginStep === 'credentials' ? 'hide' : ''}`}
      />
    </div>
  )
}
