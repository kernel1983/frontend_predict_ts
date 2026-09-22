import { useEffect } from 'react'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/auth'

let hydratePromise: Promise<void> | null = null

function hydrate() {
  if (!hydratePromise) {
    hydratePromise = (async () => {
      const store = useAuthStore.getState()
      try {
        const me = await api.walletMe()
        store.setUser(me)
      } catch {
        store.clearUser()
      }
    })()
  }
  return hydratePromise
}

export function useSession() {
  const user = useAuthStore((s) => s.user)
  const status = useAuthStore((s) => s.status)

  useEffect(() => {
    void hydrate()
  }, [])

  return { user, status }
}