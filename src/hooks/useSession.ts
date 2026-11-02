import { useEffect, useRef, useState } from 'react'
import { supabase, supabaseConfigured } from '@/lib/supabase'

interface SessionUser {
  id: string
  address: string | null
  email?: string | null
  deposits?: Record<string, unknown>
}

function userFromAuthUser(authUser: any): SessionUser {
  const address =
    (authUser.user_metadata?.evm_address as string | undefined) ??
    (authUser.user_metadata?.address as string | undefined) ??
    null
  return {
    id: authUser.id,
    address,
    email: authUser.email,
    deposits: (authUser.user_metadata?.deposits as Record<string, unknown>) || {},
  }
}

export function useSession() {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready'>('loading')
  const userRef = useRef<SessionUser | null>(null)
  const verifyingRef = useRef(false)

  const applyUser = (next: SessionUser | null) => {
    userRef.current = next
    setUser(next)
  }

  useEffect(() => {
    if (!supabaseConfigured() || !supabase) {
      setUser(null)
      setStatus('ready')
      return
    }

    const verifyWithServer = async () => {
      if (verifyingRef.current) return
      verifyingRef.current = true
      try {
        const { data, error }: any = await supabase.auth.getUser()
        const authUser = error ? null : data?.user
        applyUser(authUser ? userFromAuthUser(authUser) : null)
      } catch {
        applyUser(null)
      } finally {
        verifyingRef.current = false
        setStatus('ready')
      }
    }

    void verifyWithServer()

    const { data: sub } = supabase.auth.onAuthStateChange((event: any, session: any) => {
      if (session?.user) {
        applyUser(userFromAuthUser(session.user))
        setStatus('ready')
        return
      }
      // The local session may be stale (e.g. its refresh token was rotated
      // away by another tab) while the access token is still accepted by the
      // server. Trust the server: re-verify instead of signing out locally.
      // Only re-verify while a user is actually set, otherwise clearing the
      // session re-emits SIGNED_OUT and we would loop forever.
      if ((event === 'SIGNED_OUT' || event === 'INITIAL_SESSION') && userRef.current) {
        void verifyWithServer()
        return
      }
      if (event !== 'INITIAL_SESSION') applyUser(null)
      setStatus('ready')
    })

    return () => {
      sub.subscription.unsubscribe()
    }
  }, [])

  return { user, status }
}
