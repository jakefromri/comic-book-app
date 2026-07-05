import type { ReactNode } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { AuthContext } from '@/lib/AuthContext'

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuth()
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>
}
