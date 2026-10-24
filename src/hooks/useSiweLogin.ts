import { useCallback, useState } from 'react'
import { useSignMessage } from 'wagmi'
import { toErrorMessage } from '@/lib/wallet'
import { supabase, supabaseConfigured } from '@/lib/supabase'

export interface UseSiweLoginResult {
  login(messageOverride?: string): Promise<{ ok: true } | { ok: false; error: string }>
  verifying: boolean
  error: string | null
  clearError(): void
}

export function useSiweLogin(address: string): UseSiweLoginResult {
  const { signMessageAsync } = useSignMessage()
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const clearError = useCallback(() => setError(null), [])

  const login = useCallback(
    async (messageOverride?: string): Promise<{ ok: true } | { ok: false; error: string }> => {
      try {
        const message = messageOverride
        if (!message) {
          const msg = 'Missing signing message. Get a challenge from siwe-challenge first.'
          setError(msg)
          return { ok: false, error: msg }
        }
        const signature = await signMessageAsync({
          message,
          account: address as `0x${string}`,
        })
        setVerifying(true)
        try {
          if (!supabaseConfigured() || !supabase) {
            throw new Error('Supabase not configured')
          }
          const { data, error: fnError } = await supabase.functions.invoke(
            'siwe-verify',
            { body: { message, signature } },
          )
          if (fnError) throw fnError
          if (!data?.session) {
            throw new Error(data?.error ?? 'Login failed')
          }
          const { error: sessionError } = await supabase.auth.setSession(
            data.session,
          )
          if (sessionError) throw sessionError
          return { ok: true }
        } finally {
          setVerifying(false)
        }
      } catch (err) {
        const msg = toErrorMessage(err)
        setError(msg)
        return { ok: false, error: msg }
      }
    },
    [address, signMessageAsync],
  )

  return { login, verifying, error, clearError }
}