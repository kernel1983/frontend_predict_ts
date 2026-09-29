import { Link, useParams } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { LiveUpdownTemplate } from '@/components/market/LiveUpdownTemplate'
import { SteadyTemplate } from '@/components/market/SteadyTemplate'
import { UpdownTemplate } from '@/components/market/UpdownTemplate'
import { isLive, isNotLive, isSteady, isUpdown, parseMarketId } from '@/lib/market'

export default function MarketPage() {
  const { marketId } = useParams()
  const market = marketId ? parseMarketId(marketId) : null

  if (!market) {
    return (
      <AppLayout>
        <Link to="/" className="text-sm text-accent hover:underline">← Back to markets</Link>
        <section className="mt-5 max-w-2xl rounded-2xl border border-border bg-bg p-6 shadow-card">
          <h1 className="text-3xl font-semibold text-text-h">Market not found</h1>
          <p className="mt-3 text-sm text-text">
            The URL does not match a known market template.
          </p>
        </section>
      </AppLayout>
    )
  }

  if (isUpdown(market)) {
    return <UpdownTemplate market={market} />
  }

  if (isSteady(market)) {
    return <SteadyTemplate market={market} />
  }

  if (isLive(market) || isNotLive(market)) {
    return <LiveUpdownTemplate market={market} />
  }

  return null
}