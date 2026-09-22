import { useCallback, useState } from 'react'
import { useSignMessage } from 'wagmi'
import { ApiError, api } from '@/lib/api'
import { toErrorMessage } from '@/lib/wallet'
import { useAuthStore } from '@/store/auth'

export interface UseSiweLoginResult {
  login(messageOverride?: string): Promise<{ ok: true } | { ok: false; error: string }>
  verifying: boolean
  error: string | null
  clearError(): void
}

export function useSiweLogin(address: string): UseSiweLoginResult {
  const { mutateAsync: signMessageAsync } = useSignMessage()
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const clearError = useCallback(() => setError(null), [])

  const login = useCallback(
    async (messageOverride?: string): Promise<{ ok: true } | { ok: false; error: string }> => {
      try {
        let message = messageOverride
        if (!message) {
          const challenge = await api.walletChallenge(address)
          message = challenge?.message
        }
        if (!message) {
          const msg = 'The server did not return a signing message. Make sure the wallet address is registered'
          setError(msg)
          return { ok: false, error: msg }
        }
        const signature = await signMessageAsync({
          message,
          account: address as `0x${string}`,
        })
        setVerifying(true)
        try {
          await api.walletVerify({ message, signature })
          const me = await api.walletMe()
          useAuthStore.getState().setUser(me)
          return { ok: true }
        } finally {
          setVerifying(false)
        }
      } catch (err) {
        const msg = err instanceof ApiError ? err.message : toErrorMessage(err)
        setError(msg)
        return { ok: false, error: msg }
      }
    },
    [address, signMessageAsync],
  )

  return { login, verifying, error, clearError }
}