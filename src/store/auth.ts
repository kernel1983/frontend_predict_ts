import { create } from 'zustand'
import type { WalletMe } from '@/types/api'

export type SessionStatus = 'loading' | 'authenticated' | 'anonymous'

export interface AuthState {
  user: WalletMe | null
  status: SessionStatus
  setUser(user: WalletMe): void
  clearUser(): void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: 'loading',
  setUser: (user) => set({ user, status: 'authenticated' }),
  clearUser: () => set({ user: null, status: 'anonymous' }),
}))