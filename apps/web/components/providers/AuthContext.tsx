'use client'

import axios from 'axios'
import {
  createContext,
  useContext,
  useEffect,
  useState,
} from 'react'

interface User {
  id: number
  email: string
  login: string
}

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (identifier: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => {},
  logout: () => {},
})

export const useAuth = () => useContext(AuthContext)

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchUser = async () => {
    const token = localStorage.getItem('access_token')

    if (!token) {
      setUser(null)
      setLoading(false)
      return
    }

    try {
      const res = await axios.get('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      })
      console.log(res.data)
      setUser(res.data)
    } catch {
      localStorage.removeItem('access_token')
      setUser(null)
    } finally {
      setLoading(false)
      window.location.href = '/'
    }
  }

  const login = async (identifier: string, password: string) => {
    const res = await axios.post('/api/auth/login', {
      identifier,
      password,
    })

    const token = res.data.access_token
    localStorage.setItem('access_token', token)
    await fetchUser()
  }

  const logout = () => {
    localStorage.removeItem('access_token')
    setUser(null)
    window.location.href = '/'
  }

  useEffect(() => {
    fetchUser()
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
