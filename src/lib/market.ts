export type MarketKind = 'updown' | 'steady'

export type UpdownInterval = '5m' | '15m' | '1h'

/** 周期型：{symbol}_updown_{interval}_{YYYYMMDDHHMM(UTC)}，如 eth_updown_15m_202609241345 */
export interface UpdownMarket {
  kind: 'updown'
  symbol: string
  asset: string
  interval: UpdownInterval
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

export type Market = UpdownMarket | SteadyMarket

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

const UPDOWN_RE = /^([a-z0-9]+)_updown_(5m|15m|1h)(?:_(\d{12}))?$/
const STEADY_RE = /^([a-z0-9]+)_eom_(\d{4})(\d{2})$/
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
  return Math.floor(
    Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5])) / 1000,
  )
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
    const stampTs = up[3] ? parseRoundStamp(up[3]) : undefined
    return {
      kind: 'updown',
      symbol: up[1],
      asset: assetName(up[1]),
      interval: up[2] as UpdownInterval,
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
  return null
}

export function isUpdown(market: Market): market is UpdownMarket {
  return market.kind === 'updown'
}

export function isSteady(market: Market): market is SteadyMarket {
  return market.kind === 'steady'
}

/** 周期起点（UTC）：未指定 timestamp 时取当前周期 */
export function updownWindowStart(market: UpdownMarket): number {
  if (market.timestamp != null) return market.timestamp
  const seconds = UPDOWN_INTERVAL_SECONDS[market.interval]
  return Math.floor(Date.now() / 1000 / seconds) * seconds
}

/** updown 的下单/余额 slug（与 URL 一致），如 btc_updown_5m_202609241345 */
export function updownSlug(market: UpdownMarket): string {
  return `${market.symbol.toLowerCase()}_updown_${market.interval}_${toRoundStamp(updownWindowStart(market))}`
}

/** 生成 URL/下单 slug，updown 未给 timestamp 时取当前周期起点（UTC） */
export function marketId(market: Market): string {
  if (isUpdown(market)) {
    const startSec = updownWindowStart(market)
    return `${market.symbol.toLowerCase()}_updown_${market.interval}_${toRoundStamp(startSec)}`
  }
  return `${market.symbol.toLowerCase()}_eom_${market.year}${String(market.month).padStart(2, '0')}`
}