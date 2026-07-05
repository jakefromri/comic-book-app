import { Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuthContext } from '@/hooks/useAuthContext'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuthContext()

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <p className="text-text-muted">loading...</p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}
