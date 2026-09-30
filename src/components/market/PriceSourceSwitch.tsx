import { cn } from '@/lib/cn'
import { usePriceSourceStore, type PriceSource } from '@/store/priceSource'

const sources: { value: PriceSource; label: string }[] = [
  { value: 'hyperliquid', label: 'Hyperliquid' },
  { value: 'base', label: 'Base' },
]

/** 行情源切换：Hyperliquid BTC 永续 ↔ Base 上 cbBTC（backend/ws.py） */
export function PriceSourceSwitch() {
  const { source, setSource } = usePriceSourceStore()

  return (
    <div
      role="tablist"
      aria-label="Price source"
      className="flex h-8 items-center gap-0.5 rounded-full border border-border bg-bg p-0.5"
    >
      {sources.map((s) => {
        const active = source === s.value
        return (
          <button
            key={s.value}
            type="button"
            role="tab"
            aria-selected={active}
            title={s.value === 'base' ? 'cbBTC/USDC from backend/ws.py' : 'BTC perp from Hyperliquid'}
            onClick={() => setSource(s.value)}
            className={cn(
              'h-full rounded-full px-3 text-xs font-medium transition-colors',
              active ? 'bg-accent text-white' : 'text-text hover:text-text-h',
            )}
          >
            {s.label}
          </button>
        )
      })}
    </div>
  )
}
