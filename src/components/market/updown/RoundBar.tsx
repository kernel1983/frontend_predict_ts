import { cn } from '@/lib/cn'
import type { RoundState } from '@/lib/round'

function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const p = (n: number) => String(n).padStart(2, '0')
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return h > 0 ? `${p(h)}:${p(m)}:${p(sec)}` : `${p(m)}:${p(sec)}`
}

const stateLabel: Record<RoundState, string> = {
  active: 'Active',
  settling: 'Settling…',
  resolved: 'Resolved',
}

const stateClass: Record<RoundState, string> = {
  active: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  settling: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  resolved: 'bg-slate-500/10 text-slate-500',
}

export function RoundBar({
  slug,
  state,
  remaining,
  progress,
  isCurrent,
  onPrev,
  onNext,
  onCurrent,
}: {
  slug: string
  state: RoundState
  remaining: number
  progress: number
  isCurrent: boolean
  onPrev: () => void
  onNext: () => void
  onCurrent: () => void
}) {
  const urgent = remaining <= 30 && state === 'active'

  return (
    <section className="rounded-2xl border border-border bg-bg p-5 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-mono text-sm font-semibold text-text-h">{slug}</p>
          <span className={cn('mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium', stateClass[state])}>
            {isCurrent && state === 'active' ? 'Live' : stateLabel[state]}
          </span>
        </div>
        <span className={cn('font-mono text-xl font-semibold tabular-nums', urgent ? 'text-red-500' : 'text-text-h')}>
          {state === 'active' ? formatCountdown(remaining) : '—:—'}
        </span>
      </div>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
        <div
          className={cn('h-full rounded-full transition-[width] duration-1000 ease-linear', urgent ? 'bg-red-500' : 'bg-accent')}
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onPrev}
          className="rounded-lg border border-border bg-bg px-3 py-1.5 text-sm text-text-h transition-colors hover:border-accent-border"
        >
          ← Previous
        </button>
        <button
          type="button"
          onClick={onCurrent}
          disabled={isCurrent}
          className="rounded-lg border border-border bg-bg px-3 py-1.5 text-sm text-accent transition-colors hover:border-accent-border disabled:opacity-40"
        >
          Current
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={isCurrent}
          className="rounded-lg border border-border bg-bg px-3 py-1.5 text-sm text-text-h transition-colors hover:border-accent-border disabled:opacity-40"
        >
          Next →
        </button>
      </div>
    </section>
  )
}