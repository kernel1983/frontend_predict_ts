import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAccount } from 'wagmi'
import { AppLayout } from '@/components/layout/AppLayout'
import {
  PredictionCard,
  type PredictionMarket,
} from '@/components/prediction/PredictionCard'
import { DepositModal } from '@/components/wallet/DepositModal'
import { Button } from '@/components/ui/Button'
import { useSession } from '@/hooks/useSession'
import { useUsdcBalance } from '@/hooks/useUsdcBalance'
import {
  computeDepositAddress,
  depositFactoriesByMode,
  type DepositFactoryConfig,
} from '@/lib/deposit'
import { formatUsdc } from '@/lib/zentra'
import { marketId } from '@/lib/market'
import { useChainModeStore } from '@/store/chainMode'

const featuredMarket: PredictionMarket = {
  market: { kind: 'updown', symbol: 'btc', asset: 'Bitcoin', interval: '5m' },
  price: '$104,286.42', change: '+0.38%', upChance: 64, endsIn: '02:41', tone: 'orange',
}

const markets: PredictionMarket[] = [
  { market: { kind: 'updown', symbol: 'btc', asset: 'Bitcoin', interval: '15m' }, price: '$104,286.42', change: '+0.38%', upChance: 61, endsIn: '12:41', tone: 'orange' },
  { market: { kind: 'updown', symbol: 'btc', asset: 'Bitcoin', interval: '1h' }, price: '$104,286.42', change: '+0.38%', upChance: 57, endsIn: '42:41', tone: 'orange' },
  { market: { kind: 'updown', symbol: 'eth', asset: 'Ethereum', interval: '15m' }, price: '$2,516.83', change: '+0.21%', upChance: 53, endsIn: '08:41', tone: 'blue' },
  { market: { kind: 'updown', symbol: 'sol', asset: 'Solana', interval: '1h' }, price: '$148.26', change: '-0.14%', upChance: 46, endsIn: '35:41', tone: 'purple' },
  { market: { kind: 'updown', symbol: 'hype', asset: 'Hyperliquid', interval: '15m' }, price: '$25.34', change: '+3.12%', upChance: 54, endsIn: '10:41', tone: 'purple' },
  { market: { kind: 'steady', symbol: 'btc', asset: 'Bitcoin', year: 2026, month: 9, targets: [60000, 70000, 80000, 90000, 100000] }, price: '$104,286.42', change: '+0.38%', upChance: 70, endsIn: 'Sep 30', tone: 'orange' },
]

function marketPath(market: PredictionMarket): string {
  return `/market/${marketId(market.market)}`
}

export default function HomePage() {
  const { user } = useSession()
  const { address } = useAccount()
  const { mode } = useChainModeStore()
  const [depositOpen, setDepositOpen] = useState(false)
  const { data: balance, isLoading: balanceLoading, error: balanceError } = useUsdcBalance(address)
  const factories: DepositFactoryConfig[] = depositFactoriesByMode[mode]
  console.log(address);
  const predicted = address
    ? factories.map((config) => ({
        config,
        address: computeDepositAddress(config.factory, address, config.initCode),
      }))
    : []

  return (
    <AppLayout>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-text-h">Markets</h1>
          <p className="mt-1 text-sm text-text">Predict where crypto prices will move next.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/portfolio" className="rounded-xl border border-border bg-bg px-3 py-2 text-right shadow-card transition-colors hover:border-accent-border" aria-label="View portfolio">
            <p className="text-xs text-text">Available</p>
            <p className="font-mono text-sm font-medium text-text-h">
              {balanceLoading ? '…' : balanceError ? '—' : `${formatUsdc(balance ?? 0n, 2)} USDC`}
            </p>
          </Link>
          <Button size="md" onClick={() => setDepositOpen(true)}>Deposit</Button>
        </div>
      </div>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-text-h">Featured market</h2>
          <span className="text-xs text-text">Short-term · settles soon</span>
        </div>
        <PredictionCard market={featuredMarket} featured to={marketPath(featuredMarket)} />
      </section>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-text-h">More predictions</h2>
          <span className="text-xs text-text">New markets update regularly</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {markets.map((market) => (
            <PredictionCard key={`${market.market.symbol}-${market.market.kind}`} market={market} to={marketPath(market)} />
          ))}
        </div>
      </section>

      <DepositModal
        open={depositOpen}
        onClose={() => setDepositOpen(false)}
        predicted={predicted}
        deposits={user?.deposits ?? {}}
        walletConnected={Boolean(address)}
        mainnet={mode === 'mainnet'}
      />
    </AppLayout>
  )
}
