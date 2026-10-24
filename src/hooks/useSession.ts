import { useEffect, useState } from 'react'
import { supabase, supabaseConfigured } from '@/lib/supabase'

interface SessionUser {
  id: string
  address: string | null
  email?: string | null
  deposits?: Record<string, unknown>
}

export function useSession() {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready'>('loading')

  useEffect(() => {
    if (!supabaseConfigured() || !supabase) {
      setUser(null)
      setStatus('ready')
      return
    }

    supabase.auth
      .getSession()
      .then(({ data }: any) => {
        const session = data?.session
        if (!session?.user) {
          setUser(null)
          setStatus('ready')
          return
        }
        const address =
          (session.user.user_metadata?.evm_address as string | undefined) ??
          (session.user.user_metadata?.address as string | undefined) ??
          null
        setUser({
          id: session.user.id,
          address,
          email: session.user.email,
          deposits: (session.user.user_metadata?.deposits as Record<string, unknown>) || {},
        })
        setStatus('ready')
      })
      .catch(() => {
        setUser(null)
        setStatus('ready')
      })

    const { data: sub } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
      if (!session?.user) {
        setUser(null)
        setStatus('ready')
        return
      }
      const address =
        (session.user.user_metadata?.evm_address as string | undefined) ??
        (session.user.user_metadata?.address as string | undefined) ??
        null
      setUser({
        id: session.user.id,
        address,
        email: session.user.email,
        deposits: (session.user.user_metadata?.deposits as Record<string, unknown>) || {},
      })
      setStatus('ready')
    })

    return () => {
      sub.subscription.unsubscribe()
    }
  }, [])

  return { user, status }
}