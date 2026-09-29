import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAccount } from 'wagmi'
import { useQuery } from '@tanstack/react-query'
import { AppLayout } from '@/components/layout/AppLayout'
import { BalancesPanel } from '@/components/market/updown/BalancesPanel'
import { MarketPanel } from '@/components/market/updown/MarketPanel'
import { PriceChart, type PricePoint } from '@/components/market/updown/PriceChart'
import { TradePanel } from '@/components/market/updown/TradePanel'
import { usePredictBalances } from '@/hooks/usePredictBalances'
import {
  liveUpdownSlug,
  notLiveSlug,
  type LiveUpdownMarket,
  type NotLiveUpdownMarket,
} from '@/lib/market'
import { HyperliquidWS, fetchCandleSnapshot, hlCoinFor } from '@/lib/hyperliquid'
import {
  ZENTRA_ENVS,
  fetchPredictMarketProbe,
  fetchPredictOrderbook,
  fetchPredictOrderbookRaw,
  isEnvConfigured,
} from '@/lib/zentra'
import { useChainModeStore } from '@/store/chainMode'
import { cn } from '@/lib/cn'

const fmtPrice = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/** 解析盘口级：price 18 位小数 → 美元；base 6 位小数数量 → 取绝对值 */
const parseLevel = (l: { price: string; base: string }) => ({
  price: Number(l.price) / 1e18,
  size: Math.abs(Number(l.base)) / 1e6,
})

/**
 * UpdownTemplate 的 fork：市场没有结束时间（不按轮次结算，slug 恒定）。
 * 仅用于 testnet 调试 —— 展示 slug 是否已在链上创建、实时 Up/Down 价格等。
 * notlive 复用同一模板，slug 走 notLiveSlug。
 */
export function LiveUpdownTemplate({
  market,
}: {
  market: LiveUpdownMarket | NotLiveUpdownMarket
}) {
  const mode = useChainModeStore((s) => s.mode)
  const env = ZENTRA_ENVS[mode]
  const configured = isEnvConfigured(env)
  const testnet = mode === 'testnet'
  const isUpdownLive = market.kind === 'live'

  const hlCoin = hlCoinFor(market.symbol)
  const slug = isUpdownLive ? liveUpdownSlug(market) : notLiveSlug(market)

  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000))
  const minuteStart = Math.floor(now / 60) * 60
  const [price, setPrice] = useState<number | null>(null)
  const [connected, setConnected] = useState(false)
  const [points, setPoints] = useState<PricePoint[]>([])
  const [target, setTarget] = useState<number | null>(null)
  const [balTick, setBalTick] = useState(0)
  const minuteRef = useRef(0)

  const { address } = useAccount()

  // 1s 心跳
  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1_000)
    return () => clearInterval(t)
  }, [])

  // WS 行情订阅：trades/candle 事件回调里更新价格与秒级点（持续，无轮次）
  useEffect(() => {
    if (!hlCoin) return
    const ws = new HyperliquidWS()
    ws.on('price', (data) => {
      const p = (data as { price: number }).price
      setPrice(p)
      const nowSec = Math.floor(Date.now() / 1000)
      const mStart = Math.floor(nowSec / 60) * 60
      if (minuteRef.current !== mStart) {
        minuteRef.current = mStart
        setPoints([{ time: nowSec, value: p }])
        setTarget(null)
        return
      }
      setPoints((prev) => {
        if (prev.length === 0) return [{ time: nowSec, value: p }]
        const last = prev[prev.length - 1]
        if (last.time === nowSec) return [...prev.slice(0, -1), { time: nowSec, value: p }]
        return [...prev, { time: nowSec, value: p }]
      })
    })
    ws.on('candle', (data) => {
      setPrice((data as { candle: { close: number } }).candle.close)
    })
    ws.on('connected', () => setConnected(true))
    ws.on('disconnected', () => setConnected(false))
    ws.connect()
    ws.subscribeTrades(hlCoin)
    ws.subscribeCandle(hlCoin, '1m')
    return () => {
      ws.disconnect()
    }
  }, [hlCoin])

  // 当前分钟内拉取 1m 蜡烛：该分钟 open 作为不断滚动更新的 Target，并回填秒级价格
  useEffect(() => {
    if (!hlCoin) return
    let cancelled = false
    const fetchFrom = minuteStart * 1000
    const fetchTo = Math.max(fetchFrom, Date.now())
    fetchCandleSnapshot(hlCoin, fetchFrom, fetchTo)
      .then((candles) => {
        if (cancelled || candles.length === 0) return
        const c = candles[0]
        const cTs = Math.floor(c.t / 1000)
        const nowSec = Math.floor(Date.now() / 1000)
        const backfilled: PricePoint[] = []
        for (let s = cTs; s <= nowSec; s++) backfilled.push({ time: s, value: c.o })
        minuteRef.current = minuteStart
        setPoints(backfilled)
        setTarget(c.o)
      })
      .catch((err) => console.error('Live template candle fetch failed:', err))
    return () => {
      cancelled = true
    }
  }, [hlCoin, minuteStart])

  // YES/NO 报价（orderbook 实时轮询；无挂单时用启发式占位）
  const { data: book } = useQuery({
    queryKey: ['predict-book-live', slug],
    queryFn: () => fetchPredictOrderbook(slug),
    enabled: Boolean(hlCoin) && configured,
    refetchInterval: 2_000,
  })

  // 调试用原始订单簿（含 bestBid / asks / bids 全盘口）
  const { data: rawBook } = useQuery({
    queryKey: ['predict-book-raw-live', slug],
    queryFn: () => fetchPredictOrderbookRaw(slug),
    enabled: configured,
    refetchInterval: 2_000,
  })

  // 只用真实盘口报价：某一侧没有挂单（无 bestAsk）时为 null，界面显示 —，不做启发式填充
  const yesPrice = book?.yes ?? null
  const noPrice = book?.no ?? null
  const yesBid = book?.yesBid ?? null
  const noBid = book?.noBid ?? null

  // 调试探测：slug 是否已在链上创建
  const probe = useQuery({
    queryKey: ['market-probe', slug],
    queryFn: () => fetchPredictMarketProbe(slug),
    enabled: configured,
    refetchInterval: 10_000,
  })

  const balances = usePredictBalances(
    address?.toLowerCase(),
    slug,
    configured,
    balTick,
  )

  return (
    <AppLayout>
      <div className="mb-6">
        <Link to="/" className="text-sm text-accent hover:underline">
          ← Back to markets
        </Link>
        <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'inline-block rounded-full px-2.5 py-0.5 text-xs font-medium',
                  isUpdownLive
                    ? 'bg-red-500/10 text-red-500'
                    : 'bg-gray-500/10 text-gray-500',
                )}
              >
                {isUpdownLive ? 'LIVE' : 'NOT LIVE'}
              </span>
              <span className="text-xs text-text">
                {isUpdownLive ? 'no fixed settlement' : 'control · market not created'}
              </span>
            </div>
            <h1 className="mt-1 text-3xl font-semibold text-text-h">
              {market.asset} Up or Down?
            </h1>
          </div>
          <span className="font-mono text-xs text-text">{slug}</span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-border bg-bg p-5 shadow-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-text">Last price · {market.symbol.toUpperCase()}</p>
                <p className="font-mono text-2xl font-semibold text-text-h">
                  {price !== null ? fmtPrice(price) : '—'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-text">
                  Target {target !== null ? fmtPrice(target) : '—'}
                </p>
                <p className="mt-1 text-xs">
                  <span
                    className={cn(
                      'mr-1.5 inline-block size-1.5 rounded-full align-middle',
                      connected ? 'bg-emerald-500' : 'bg-red-500',
                    )}
                  />
                  {connected ? 'Live via Hyperliquid' : 'Disconnected'}
                </p>
              </div>
            </div>
            <div className="mt-4">
              {hlCoin ? (
                <PriceChart points={points} target={target} />
              ) : (
                <div className="flex h-[220px] items-center justify-center rounded-xl border border-border text-sm text-text">
                  No price feed for {market.symbol.toUpperCase()}.
                </div>
              )}
            </div>
          </section>

          <MarketPanel
            isLive
            currentPrice={price}
            target={target}
            finalPrice={null}
            yesPrice={yesPrice}
            noPrice={noPrice}
          />

          {testnet && (
            <section className="rounded-2xl border border-dashed border-accent-border bg-bg p-5 shadow-card">
              <h2 className="text-base font-semibold text-text-h">Debug orderbook (testnet)</h2>
              <p className="mt-1 text-xs text-text">
                raw <code className="font-mono">/api/predict_orderbook?slug=</code> · refreshed 2s ·
                levels shown as price × shares resting
              </p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                {(['yes', 'no'] as const).map((side) => {
                  const s = rawBook?.[side]
                  return (
                    <div key={side} className="rounded-xl border border-border bg-bg p-3">
                      <p
                        className={cn(
                          'text-sm font-semibold',
                          side === 'yes'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-red-600 dark:text-red-400',
                        )}
                      >
                        {side.toUpperCase()}
                      </p>
                      <dl className="mt-2 space-y-1 text-xs">
                        <div className="flex justify-between">
                          <dt className="text-text">bestAsk</dt>
                          <dd className="font-mono text-text-h">{s?.bestAsk ?? '—'}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-text">bestBid</dt>
                          <dd className="font-mono text-text-h">{s?.bestBid ?? '—'}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-text">asks / bids</dt>
                          <dd className="font-mono text-text-h">
                            {s ? `${s.asks.length} / ${s.bids.length}` : '—'}
                          </dd>
                        </div>
                      </dl>
                      {s && (s.asks.length > 0 || s.bids.length > 0) ? (
                        <div className="mt-2 space-y-0.5 font-mono text-[11px] text-text">
                          {s.asks
                            .slice(0, 3)
                            .map((l, i) => (
                              <div key={`a${i}`} className="flex justify-between">
                                <span>ask {parseLevel(l).price.toFixed(2)}</span>
                                <span>× {parseLevel(l).size.toFixed(2)}</span>
                              </div>
                            ))}
                          {s.bids
                            .slice(0, 3)
                            .map((l, i) => (
                              <div key={`b${i}`} className="flex justify-between">
                                <span>bid {parseLevel(l).price.toFixed(2)}</span>
                                <span>× {parseLevel(l).size.toFixed(2)}</span>
                              </div>
                            ))}
                        </div>
                      ) : (
                        <p className="mt-2 text-[11px] text-text">empty — no resting orders</p>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          )}
        </div>

        <aside className="space-y-6">
          {testnet && (
            <section className="rounded-2xl border border-dashed border-accent-border bg-bg p-5 shadow-card">
              <h2 className="text-base font-semibold text-text-h">Debug (testnet)</h2>

              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <dt className="shrink-0 text-text">Market slug</dt>
                  <dd className="truncate font-mono text-text-h">{slug}</dd>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <dt className="shrink-0 text-text">Created on-chain</dt>
                  <dd
                    className={cn(
                      'font-mono',
                      probe.data?.marketExists
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-amber-600 dark:text-amber-400',
                    )}
                  >
                    {probe.isLoading
                      ? 'checking…'
                      : probe.data?.marketExists
                        ? `yes (${probe.data.foundPrefix})`
                        : 'no / not found'}
                  </dd>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <dt className="shrink-0 text-text">Orderbook exists</dt>
                  <dd className="font-mono text-text-h">
                    {probe.data?.orderbookExists ? 'yes' : 'no'}
                  </dd>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <dt className="shrink-0 text-text">Target (rolling)</dt>
                  <dd className="font-mono text-amber-600 dark:text-amber-400">
                    {target !== null ? fmtPrice(target) : '—'}
                  </dd>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <dt className="shrink-0 text-text">Last price</dt>
                  <dd className="font-mono text-text-h">
                    {price !== null ? fmtPrice(price) : '—'}
                  </dd>
                </div>
              </dl>

              <div className="mt-4 rounded-xl border border-border bg-bg p-3">
                <p className="text-xs text-text">Live Up / Down prices (best ask)</p>
                <p className="mt-2 text-[11px] text-text">
                  yesAsk = {yesPrice !== null ? yesPrice.toFixed(4) : '—'} · noAsk ={' '}
                  {noPrice !== null ? noPrice.toFixed(4) : '—'}
                  {book?.yes != null || book?.no != null
                    ? ' · from predict_orderbook'
                    : ' · no asks on the book'}
                </p>
              </div>

              {probe.data?.details && (
                <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap rounded-xl border border-border bg-bg p-3 font-mono text-[11px] leading-relaxed text-text">
                  {probe.data.details}
                </pre>
              )}
              {probe.error && (
                <p className="mt-2 text-xs text-red-500">
                  Probe failed: {String(probe.error)}
                </p>
              )}
            </section>
          )}

          {testnet && (
            <TradePanel
              slug={slug}
              usdcRaw={balances.usdcRaw}
              yesRaw={balances.yesRaw}
              noRaw={balances.noRaw}
              upAsk={yesPrice}
              downAsk={noPrice}
              upBid={yesBid}
              downBid={noBid}
              enabled={Boolean(hlCoin)}
              onTraded={() => setBalTick((t) => t + 1)}
            />
          )}

          <BalancesPanel
            address={address?.toLowerCase()}
            slug={slug}
            enabled={configured}
            refreshKey={balTick}
          />
        </aside>
      </div>

      <p className="mt-6 text-center text-xs text-text">
        Continuous up/down market with no settlement. Target rolls every minute with the latest
        1-minute Hyperliquid open. Orders go to the zen address ({env.withdrawChainName}) via
        signed JSON calldata.
      </p>
    </AppLayout>
  )
}