import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import adminImg from '../assets/admin.png'
import operadorImg from '../assets/operador.png'
import '../styles/login.css'

export default function Login() {
  const { login } = useAuth()

  const [selectedRole, setSelectedRole] = useState(null)
  const [step, setStep] = useState('role') // role | credentials
  const [user, setUser] = useState('')
  const [password, setPassword] = useState('')

  const handleSelectRole = (role) => {
    setSelectedRole(role)

    // ⏳ Espera a que la card se centre antes de mostrar el form
    setTimeout(() => {
      setStep('credentials')
    }, 400)
  }

  const handleLogin = () => {
    // credenciales mock (DEMO)
    const credentials = {
      admin: { user: 'admin', password: 'ad123' },
      operator: { user: 'operador', password: 'ope123' }
    }

    const valid = credentials[selectedRole]

    if (!valid || user !== valid.user || password !== valid.password) {
      alert('Credenciales incorrectas')
      return
    }

    login(selectedRole)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && step === 'credentials') {
      handleLogin()
    }
  }

  return (
    <div className="login-container">

      {/* ===== CARDS ===== */}
      <div className={`cards ${selectedRole ? 'selected' : ''}`}>

        {/* ADMIN */}
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

        {/* OPERADOR */}
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

      {/* ===== FORMULARIO (SIEMPRE MONTADO) ===== */}
      <div className={`credentials ${step === 'credentials' ? 'show' : ''}`}>
        <input
          type="text"
          placeholder="Usuario"
          value={user}
          onChange={e => setUser(e.target.value)}
          onKeyDown={handleKeyDown}
        />

        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={handleKeyDown}
        />

        <button onClick={handleLogin}>
          Ingresar
        </button>
      </div>

    </div>
  )
}
