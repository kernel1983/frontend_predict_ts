import { formatUsdc } from '@/lib/zentra'
import { usePredictBalances } from '@/hooks/usePredictBalances'

export function BalancesPanel({
  address,
  slug,
  enabled,
  refreshKey,
}: {
  address: string | undefined
  slug: string
  enabled: boolean
  refreshKey: number
}) {
  const balances = usePredictBalances(address, slug, enabled, refreshKey)
  const fmt = (raw: string) => formatUsdc(BigInt(raw || '0'), 2)

  const rows = [
    { label: 'USDC', value: fmt(balances.usdcRaw) },
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