import { create } from 'zustand'

export type ChainMode = 'testnet' | 'mainnet'

interface ChainModeState {
  mode: ChainMode
  setMode: (mode: ChainMode) => void
}

const STORAGE_KEY = 'predict:chain-mode'

function loadMode(): ChainMode {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    if (value === 'testnet' || value === 'mainnet') return value
  } catch {
    // ignore storage errors
  }
  return 'testnet'
}

export const useChainModeStore = create<ChainModeState>((set) => ({
  mode: loadMode(),
  setMode: (mode) => {
    try {
      localStorage.setItem(STORAGE_KEY, mode)
    } catch {
      // ignore storage errors
    }
    set({ mode })
  },
}))