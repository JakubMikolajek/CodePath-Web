'use client'

import axios from 'axios'
import { useRouter } from 'next/navigation'
import {
  createContext,
  ReactNode,
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

export default function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchUser = async () => {
    try {
      const res = await axios.get('/api/auth/me')

      setUser(res.data)
    } catch {
      localStorage.removeItem('access_token')
      setUser(null)
    } finally {
      setLoading(false)
      router.push('/dashboard')
    }
  }

  const login = async (identifier: string, password: string) => {
    await axios.post('/api/auth/login', { identifier, password })
    await fetchUser()
  }

  const logout = () => {
    setUser(null)
    router.push('/')
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
