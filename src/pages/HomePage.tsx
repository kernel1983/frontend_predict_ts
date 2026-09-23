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
import { useChainModeStore } from '@/store/chainMode'

const featuredMarket: PredictionMarket = {
  asset: 'Bitcoin', symbol: 'BTC', interval: '5 minute', price: '$104,286.42',
  change: '+0.38%', upChance: 64, endsIn: '02:41', tone: 'orange',
}

const markets: PredictionMarket[] = [
  { asset: 'Bitcoin', symbol: 'BTC', interval: '15 minute', price: '$104,286.42', change: '+0.38%', upChance: 61, endsIn: '12:41', tone: 'orange' },
  { asset: 'Bitcoin', symbol: 'BTC', interval: '1 hour', price: '$104,286.42', change: '+0.38%', upChance: 57, endsIn: '42:41', tone: 'orange' },
  { asset: 'Ethereum', symbol: 'ETH', interval: '15 minute', price: '$2,516.83', change: '+0.21%', upChance: 53, endsIn: '08:41', tone: 'blue' },
  { asset: 'Solana', symbol: 'SOL', interval: '1 hour', price: '$148.26', change: '-0.14%', upChance: 46, endsIn: '35:41', tone: 'purple' },
  { asset: 'XRP', symbol: 'XRP', interval: '15 minute', price: '$2.18', change: '+0.09%', upChance: 51, endsIn: '10:41', tone: 'green' },
]

function marketPath(market: PredictionMarket) {
  const secondsByInterval: Record<PredictionMarket['interval'], number> = {
    '5 minute': 5 * 60,
    '15 minute': 15 * 60,
    '1 hour': 60 * 60,
  }
  const period = secondsByInterval[market.interval]
  const timestamp = Math.floor(Date.now() / 1000 / period) * period
  const interval = market.interval === '5 minute' ? '5m' : market.interval === '15 minute' ? '15m' : '1h'
  return `/market/${market.symbol.toLowerCase()}_updown_${interval}_${timestamp}`
}

export default function HomePage() {
  const { user } = useSession()
  const { address } = useAccount()
  const { mode } = useChainModeStore()
  const [depositOpen, setDepositOpen] = useState(false)
  const { data: balance, isLoading: balanceLoading, error: balanceError } = useUsdcBalance(address)
  const factories: DepositFactoryConfig[] = depositFactoriesByMode[mode]
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
            <PredictionCard key={`${market.symbol}-${market.interval}`} market={market} to={marketPath(market)} />
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
