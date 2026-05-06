import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import adminImg from '../assets/admin.png'
import operadorImg from '../assets/operador.png'
import '../styles/login.css'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()

  const [selectedRole, setSelectedRole] = useState(null)
  const [step, setStep] = useState('role')
  const [user, setUser] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handleSelectRole = (role) => {
    setSelectedRole(role)
    setError('')
    setTimeout(() => setStep('credentials'), 400)
  }

  const handleLogin = () => {
    const credentials = {
      admin: { user: 'admin', password: 'ad123' },
      operator: { user: 'operador', password: 'ope123' }
    }
    const valid = credentials[selectedRole]
    if (!valid || user !== valid.user || password !== valid.password) {
      setError('Usuario o contraseña incorrectos')
      return
    }
    login(selectedRole)
    navigate('/dashboard')
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && step === 'credentials') handleLogin()
  }

  return (
    <div className="login-container">

      <div className={`cards ${selectedRole ? 'selected' : ''}`}>
        {(step === 'role' || selectedRole === 'admin') && (
          <div
            className={`card admin ${selectedRole === 'admin' ? 'active' : ''}`}
            onClick={() => step === 'role' && handleSelectRole('admin')}
          >
            <img src={adminImg} alt="Administrador" />
            <h2>Administrador</h2>
            <p>Control total del sistema</p>
          </div>
        )}

        {(step === 'role' || selectedRole === 'operator') && (
          <div
            className={`card operator ${selectedRole === 'operator' ? 'active' : ''}`}
            onClick={() => step === 'role' && handleSelectRole('operator')}
          >
            <img src={operadorImg} alt="Operador" />
            <h2>Operador</h2>
            <p>Gestión operativa</p>
          </div>
        )}
      </div>

      <div className={`credentials ${step === 'credentials' ? 'show' : ''}`}>
        <input
          type="text"
          placeholder="Usuario"
          value={user}
          onChange={e => { setUser(e.target.value); setError('') }}
          onKeyDown={handleKeyDown}
        />
        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={e => { setPassword(e.target.value); setError('') }}
          onKeyDown={handleKeyDown}
        />
        {error && (
          <p style={{ color: '#E24B4A', fontSize: 12, margin: '4px 0 0', textAlign: 'center' }}>
            {error}
          </p>
        )}
        <button onClick={handleLogin}>Ingresar</button>
      </div>

    </div>
  )
} 
