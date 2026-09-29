import { cn } from '@/lib/cn'

export function MarketPanel({
  isLive,
  currentPrice,
  target,
  finalPrice,
  yesPrice,
  noPrice,
}: {
  isLive: boolean
  currentPrice: number | null
  target: number | null
  finalPrice: number | null
  yesPrice: number | null
  noPrice: number | null
}) {
  const yesRatio =
    yesPrice !== null && noPrice !== null ? (100 * yesPrice) / (yesPrice + noPrice) : null
  const settled = !isLive && finalPrice !== null && target !== null
  const won = settled && finalPrice !== null && target !== null ? finalPrice > target : null
  const fmt = (n: number | null) =>
    n === null
      ? '—'
      : `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  return (
    <section className="rounded-2xl border border-border bg-bg p-5 shadow-card">
      <h2 className="text-base font-semibold text-text-h">Market</h2>

      {settled && won !== null ? (
        <div
          className={cn(
            'mt-4 rounded-xl border p-4 text-center',
            won ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-red-500/30 bg-red-500/10',
          )}
        >
          <p className={cn('text-lg font-bold', won ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
            {won ? 'YES / Up' : 'NO / Down'} won
          </p>
          {finalPrice !== null && (
            <p className="mt-1 text-xs text-text">
              Final {fmt(finalPrice)}
              {target !== null ? ` vs Target ${fmt(target)}` : ''}
            </p>
          )}
        </div>
      ) : (
        <>
          <div className="mt-4 flex items-center justify-between">
            <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">YES / Up</span>
            <span className="font-mono text-sm text-text-h">{fmt(yesPrice)}</span>
          </div>
          <div className="mt-2 flex h-8 overflow-hidden rounded-lg text-xs font-semibold text-white">
            {yesRatio === null ? (
              <div className="flex w-full items-center justify-center bg-border text-text-h">
                no orderbook
              </div>
            ) : (
              <>
                <div className="flex items-center justify-center bg-emerald-500" style={{ width: `${Math.round(yesRatio)}%` }}>
                  {Math.round(yesRatio)}%
                </div>
                <div className="flex items-center justify-center bg-red-500" style={{ width: `${100 - Math.round(yesRatio)}%` }}>
                  {100 - Math.round(yesRatio)}%
                </div>
              </>
            )}
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-sm font-semibold text-red-600 dark:text-red-400">NO / Down</span>
            <span className="font-mono text-sm text-text-h">{fmt(noPrice)}</span>
          </div>

          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text">
            {currentPrice !== null && isLive && (
              <span>
                Price <span className="font-mono text-text-h">{fmt(currentPrice)}</span>
              </span>
            )}
            {target !== null && (
              <span>
                Target <span className="font-mono text-amber-600 dark:text-amber-400">{fmt(target)}</span>
              </span>
            )}
            {currentPrice !== null && target !== null && isLive && (
              <span className={cn('font-medium', currentPrice > target ? 'text-emerald-600' : 'text-red-600')}>
                {currentPrice > target ? 'Above target → YES' : 'At or below target → NO'}
              </span>
            )}
          </div>
          <p className="mt-3 text-xs text-text">
            Prices are live orderbook best asks — “—” means no resting orders on that side.
          </p>
        </>
      )}
    </section>
  )
}