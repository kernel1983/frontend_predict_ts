import { formatAmount } from '@/lib/amounts'
import { usePredictBalances } from '@/hooks/usePredictBalances'
import { QUOTE_DECIMALS, type QuoteToken } from '@/lib/market'

export function BalancesPanel({
  address,
  slug,
  enabled,
  refreshKey,
  quote = 'USDC',
  quoteDecimals,
}: {
  address: string | undefined
  slug: string
  enabled: boolean
  refreshKey: number
  quote?: QuoteToken
  quoteDecimals?: number
}) {
  const decimals = quoteDecimals ?? QUOTE_DECIMALS[quote]
  const balances = usePredictBalances(address, slug, enabled, refreshKey, quote)
  const fmt = (raw: string) =>
    formatAmount(BigInt(raw || '0'), decimals, Math.min(decimals, 2))

  const rows = [
    { label: quote, value: fmt(balances.quoteRaw) },
    { label: 'YES', value: fmt(balances.yesRaw) },
    { label: 'NO', value: fmt(balances.noRaw) },
  ]

  return (
    <section className="rounded-2xl border border-border bg-bg p-5 shadow-card">
      <h2 className="text-base font-semibold text-text-h">My Assets</h2>
      {balances.loading ? (
        <div className="mt-4 h-24 animate-pulse rounded-xl bg-black/5 dark:bg-white/10" />
      ) : (
        <ul className="mt-3 divide-y divide-border">
          {rows.map((row) => (
            <li key={row.label} className="flex items-center justify-between py-2.5">
              <span className="text-sm text-text">{row.label}</span>
              <span className="font-mono text-sm text-text-h">{row.value}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}