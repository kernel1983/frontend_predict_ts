import { cn } from '@/lib/cn'
import { useNavigate } from 'react-router-dom'

export interface PredictionMarket {
  asset: string
  symbol: string
  interval: string
  price: string
  change: string
  upChance: number
  endsIn: string
  tone: 'orange' | 'blue' | 'purple' | 'green'
}

const toneClass = {
  orange: 'from-orange-400 to-amber-500',
  blue: 'from-sky-400 to-blue-600',
  purple: 'from-violet-400 to-purple-600',
  green: 'from-emerald-400 to-teal-600',
}

function PriceLine({ rising }: { rising: boolean }) {
  return (
    <svg viewBox="0 0 240 64" fill="none" className="h-full w-full" aria-hidden="true">
      <path
        d={rising ? 'M2 51 C23 48 25 38 43 42 S66 28 84 34 S105 18 123 28 S146 20 164 25 S185 9 205 16 S221 9 238 5' : 'M2 17 C20 14 28 26 45 23 S67 38 85 31 S107 46 126 39 S146 55 165 44 S187 58 205 48 S223 54 238 59'}
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function PredictionCard({
  market,
  featured = false,
  to,
}: {
  market: PredictionMarket
  featured?: boolean
  to?: string
}) {
  const rising = !market.change.startsWith('-')
  const navigate = useNavigate()

  const openMarket = () => {
    if (to) navigate(to)
  }

  return (
    <article
      className={cn(
        'rounded-2xl border border-border bg-bg shadow-card transition-transform hover:-translate-y-0.5',
        featured ? 'overflow-hidden p-6 md:p-7' : 'p-4',
        to && 'cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
      )}
      role={to ? 'link' : undefined}
      tabIndex={to ? 0 : undefined}
      onClick={openMarket}
      onKeyDown={(event) => {
        if (to && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault()
          openMarket()
        }
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={cn('flex items-center justify-center rounded-xl bg-gradient-to-br font-bold text-white', toneClass[market.tone], featured ? 'size-12 text-lg' : 'size-9 text-xs')}>
            {market.symbol.slice(0, 1)}
          </span>
          <div>
            <h2 className={cn('font-semibold text-text-h', featured ? 'text-xl' : 'text-base')}>{market.asset}</h2>
            <p className="text-xs text-text">{market.interval} prediction</p>
          </div>
        </div>
        <span className="rounded-full bg-accent-bg px-2.5 py-1 text-xs font-medium text-accent">Ends in {market.endsIn}</span>
      </div>

      <div className={cn('flex items-end justify-between gap-4', featured ? 'mt-7' : 'mt-5')}>
        <div>
          <p className={cn('font-mono font-semibold text-text-h', featured ? 'text-3xl' : 'text-xl')}>{market.price}</p>
          <p className={cn('mt-1 text-xs font-medium', rising ? 'text-emerald-500' : 'text-red-500')}>{market.change}</p>
        </div>
        <div className={cn('text-emerald-500', featured ? 'h-20 w-48' : 'h-12 w-28')}>
          <PriceLine rising={rising} />
        </div>
      </div>

      <div className={cn('grid grid-cols-2 gap-2', featured ? 'mt-7' : 'mt-5')}>
        <button type="button" className="rounded-xl bg-emerald-500 px-3 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-600">Up {market.upChance}¢</button>
        <button type="button" className="rounded-xl bg-red-500 px-3 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-600">Down {100 - market.upChance}¢</button>
      </div>
    </article>
  )
}
