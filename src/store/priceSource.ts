import { create } from 'zustand'

/** 行情源：hyperliquid = Hyperliquid 的 BTC 永续，base = Base 链上 cbBTC 池子（backend/ws.py） */
export type PriceSource = 'hyperliquid' | 'base'

interface PriceSourceState {
  source: PriceSource
  setSource: (source: PriceSource) => void
}

const STORAGE_KEY = 'predict:price-source'

function loadSource(): PriceSource {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    if (value === 'hyperliquid' || value === 'base') return value
  } catch {
    // ignore storage errors
  }
  return 'hyperliquid'
}

export const usePriceSourceStore = create<PriceSourceState>((set) => ({
  source: loadSource(),
  setSource: (source) => {
    try {
      localStorage.setItem(STORAGE_KEY, source)
    } catch {
      // ignore storage errors
    }
    set({ source })
  },
}))
