export type MarketKind = 'updown' | 'steady' | 'live' | 'notlive'

export type UpdownInterval = '5m' | '15m' | '1h'

export type QuoteToken = 'USDC' | 'USDG'

export const QUOTE_TOKENS: QuoteToken[] = ['USDC', 'USDG']

export const QUOTE_DECIMALS: Record<QuoteToken, number> = {
  USDC: 6,
  USDG: 6,
}

/** 最小报价单位（UI 展示/数量步进） */
export const QUOTE_TICK: Record<QuoteToken, number> = {
  USDC: 0.01,
  USDG: 0.01,
}

export function isQuoteToken(value: string | null | undefined): value is QuoteToken {
  return value === 'USDC' || value === 'USDG'
}

/** 周期型：USDC 为 {symbol}_updown_{interval}_{stamp}，USDG 为 {symbol}_updownusdg_{interval}_{stamp} */
export interface UpdownMarket {
  kind: 'updown'
  symbol: string
  asset: string
  interval: UpdownInterval
  /** 报价币种；旧 slug 默认 USDC */
  quote: QuoteToken
  /** 周期起点，epoch 秒（UTC） */
  timestamp?: number
}

/** 单次型：{symbol}_eom_{yyyymm}，如 btc_eom_202609。同一页面展示多个阈值，各配一组 Yes/No（月末 23:59:59 UTC 结算） */
export interface SteadyMarket {
  kind: 'steady'
  symbol: string
  asset: string
  year: number
  month: number
  targets: number[]
}

/** 无结束时间的连续 updown：{symbol}_updown_live。不按轮次结算，仅作 testnet 调试模板 */
export interface LiveUpdownMarket {
  kind: 'live'
  symbol: string
  asset: string
  quote?: QuoteToken
}

/** 对照 slug：{symbol}_updown_notlive。用作「市场未创建」状态的调试对照页 */
export interface NotLiveUpdownMarket {
  kind: 'notlive'
  symbol: string
  asset: string
  quote?: QuoteToken
}

export type Market = UpdownMarket | SteadyMarket | LiveUpdownMarket | NotLiveUpdownMarket

const ASSETS: Record<string, string> = {
  btc: 'Bitcoin',
  eth: 'Ethereum',
  sol: 'Solana',
  hype: 'Hyperliquid',
}

export function assetName(symbol: string): string {
  return ASSETS[symbol.toLowerCase()] ?? symbol.toUpperCase()
}

export const UPDOWN_INTERVAL_LABEL: Record<UpdownInterval, string> = {
  '5m': '5 minute',
  '15m': '15 minute',
  '1h': '1 hour',
}

export const UPDOWN_INTERVAL_SECONDS: Record<UpdownInterval, number> = {
  '5m': 5 * 60,
  '15m': 15 * 60,
  '1h': 60 * 60,
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

export function endOfMonthLabel(year: number, month: number): string {
  return `${MONTH_NAMES[month - 1]} ${year}`
}

/** 月末结算时间：当月最后一天 23:59:59 UTC */
export function steadyEndTs(year: number, month: number): number {
  return Math.floor(Date.UTC(year, month, 0, 23, 59, 59) / 1000)
}

const UPDOWN_RE = /^([a-z0-9]+)_updown(usdg)?_(5m|15m|1h)(?:_(\d{12}))?$/
const STEADY_RE = /^([a-z0-9]+)_eom_(\d{4})(\d{2})$/
const LIVE_RE = /^([a-z0-9]+)_updown(?:usd(?:g)?)?_live$/
const NOTLIVE_RE = /^([a-z0-9]+)_updown(?:usd(?:g)?)?_notlive$/
const STAMP_RE = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})$/

/** epoch 秒 → YYYYMMDDHHMM(UTC) */
export function toRoundStamp(tsSec: number): string {
  const d = new Date(tsSec * 1000)
  const p = (n: number) => String(n).padStart(2, '0')
  return (
    `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}` +
    `${p(d.getUTCHours())}${p(d.getUTCMinutes())}`
  )
}

/** YYYYMMDDHHMM(UTC) → epoch 秒；非法返回 null */
export function parseRoundStamp(stamp: string): number | null {
  const m = stamp.match(STAMP_RE)
  if (!m) return null
  const [year, month, day, hour, minute] = m.slice(1).map(Number)
  const ts = Date.UTC(year, month - 1, day, hour, minute)
  const d = new Date(ts)
  const valid =
    d.getUTCFullYear() === year &&
    d.getUTCMonth() + 1 === month &&
    d.getUTCDate() === day &&
    d.getUTCHours() === hour &&
    d.getUTCMinutes() === minute
  return valid ? Math.floor(ts / 1000) : null
}

const STEADY_TARGETS: Record<string, number[]> = {
  btc: [60000, 70000, 80000, 90000, 100000],
}

export function steadyTargets(symbol: string): number[] {
  return STEADY_TARGETS[symbol.toLowerCase()] ?? []
}

export function parseMarketId(id: string): Market | null {
  const up = id.match(UPDOWN_RE)
  if (up) {
    const stampTs = up[4] ? parseRoundStamp(up[4]) : undefined
    if (up[4] && stampTs === null) return null
    return {
      kind: 'updown',
      symbol: up[1],
      asset: assetName(up[1]),
      interval: up[3] as UpdownInterval,
      quote: up[2] ? 'USDG' : 'USDC',
      timestamp: stampTs ?? undefined,
    }
  }
  const st = id.match(STEADY_RE)
  if (st) {
    const year = Number(st[2])
    const month = Number(st[3])
    return {
      kind: 'steady',
      symbol: st[1],
      asset: assetName(st[1]),
      year,
      month,
      targets: steadyTargets(st[1]),
    }
  }
  const live = id.match(LIVE_RE)
  if (live) {
    return {
      kind: 'live',
      symbol: live[1],
      asset: assetName(live[1]),
      quote: live[0].includes('usd') ? (live[0].includes('usdg') ? 'USDG' : 'USDC') : undefined,
    }
  }
  const notlive = id.match(NOTLIVE_RE)
  if (notlive) {
    return {
      kind: 'notlive',
      symbol: notlive[1],
      asset: assetName(notlive[1]),
      quote: notlive[0].includes('usd') ? (notlive[0].includes('usdg') ? 'USDG' : 'USDC') : undefined,
    }
  }
  return null
}

export function isUpdown(market: Market): market is UpdownMarket {
  return market.kind === 'updown'
}

export function isSteady(market: Market): market is SteadyMarket {
  return market.kind === 'steady'
}

export function isLive(market: Market): market is LiveUpdownMarket {
  return market.kind === 'live'
}

export function isNotLive(market: Market): market is NotLiveUpdownMarket {
  return market.kind === 'notlive'
}

/** 周期起点（UTC）：未指定 timestamp 时取当前周期 */
export function updownWindowStart(market: UpdownMarket): number {
  if (market.timestamp != null) return market.timestamp
  const seconds = UPDOWN_INTERVAL_SECONDS[market.interval]
  return Math.floor(Date.now() / 1000 / seconds) * seconds
}

/** updown 的下单/余额 slug（与 URL 一致），如 btc_updown_5m_202609241345 / btc_updownusdg_5m_... */
export function updownSlug(market: UpdownMarket): string {
  const infix = market.quote === 'USDG' ? 'updownusdg' : 'updown'
  return `${market.symbol.toLowerCase()}_${infix}_${market.interval}_${toRoundStamp(updownWindowStart(market))}`
}

/** 无结束时间 updown 的下单/余额 slug，如 btc_updown_live / btc_updownusdg_live */
export function liveUpdownSlug(market: LiveUpdownMarket): string {
  const infix = market.quote === 'USDG' ? 'updownusdg' : market.quote === 'USDC' ? 'updownusd' : 'updown'
  return `${market.symbol.toLowerCase()}_${infix}_live`
}

/** 对照 slug，如 btc_updown_notlive / btc_updownusdg_notlive */
export function notLiveSlug(market: NotLiveUpdownMarket): string {
  const infix = market.quote === 'USDG' ? 'updownusdg' : market.quote === 'USDC' ? 'updownusd' : 'updown'
  return `${market.symbol.toLowerCase()}_${infix}_notlive`
}

/** 生成 URL/下单 slug，updown 未给 timestamp 时取当前周期起点（UTC） */
export function marketId(market: Market): string {
  if (isUpdown(market)) {
    return updownSlug(market)
  }
  if (isLive(market)) {
    return liveUpdownSlug(market)
  }
  if (isNotLive(market)) {
    return notLiveSlug(market)
  }
  return `${market.symbol.toLowerCase()}_eom_${market.year}${String(market.month).padStart(2, '0')}`
}