import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { Spinner } from '@/components/ui/Spinner'
import { useSession } from '@/hooks/useSession'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const location = useLocation()
  const { user, status } = useSession()

  if (status === 'loading') {
    return (
      <div className="flex min-h-svh items-center justify-center text-accent">
        <Spinner className="size-8" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <>{children}</>
}