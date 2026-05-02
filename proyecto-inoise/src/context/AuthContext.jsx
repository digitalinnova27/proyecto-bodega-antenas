import React, { createContext, useContext, useState } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [role, setRole] = useState(null) // 'admin' | 'operator' | null

  const login = (newRole) => {
    setRole(newRole)
  }

  const logout = () => {
    setRole(null)
  }

  return (
    <AuthContext.Provider
      value={{
        role,
        login,
        logout,
        isAuthenticated: Boolean(role)
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth debe usarse dentro de AuthProvider')
  }
  return ctx
}
