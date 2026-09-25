import { Link } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import {
  endOfMonthLabel,
  steadyEndTs,
  type SteadyMarket,
} from '@/lib/market'
import { formatLocal } from '@/lib/marketTime'

export function SteadyTemplate({ market }: { market: SteadyMarket }) {
  const deadline = steadyEndTs(market.year, market.month)

  return (
    <AppLayout>
      <Link to="/" className="text-sm text-accent hover:underline">← Back to markets</Link>
      <section className="mt-5 max-w-2xl rounded-2xl border border-border bg-bg p-6 shadow-card">
        <p className="text-sm text-text">End of {endOfMonthLabel(market.year, market.month)} prediction</p>
        <h1 className="mt-1 text-3xl font-semibold text-text-h">
          Will {market.asset} stay above these prices?
        </h1>
        <p className="mt-3 text-sm text-text">
          Settles at {formatLocal(new Date(deadline * 1000))}.
        </p>
        <ul className="mt-6 divide-y divide-border rounded-xl border border-border">
          {market.targets.map((target, i) => (
            <li key={target} className="flex items-center justify-between gap-4 p-4">
              <div className="min-w-0">
                <p className="font-semibold text-text-h">
                  {market.asset} above ${target.toLocaleString('en-US')}?
                </p>
                <p className="mt-0.5 text-xs text-text">
                  Will the price exceed ${target.toLocaleString('en-US')} by the settlement time.
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button type="button" className="rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600">
                  Yes {Math.max(0, 99 - i * 10)}¢
                </button>
                <button type="button" className="rounded-xl bg-red-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-600">
                  No {Math.min(100, 1 + i * 10)}¢
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </AppLayout>
  )
}