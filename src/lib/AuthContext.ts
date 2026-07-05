import { createContext } from 'react'
import type { useAuth } from '@/hooks/useAuth'

export type AuthContextValue = ReturnType<typeof useAuth>

export const AuthContext = createContext<AuthContextValue | null>(null)
