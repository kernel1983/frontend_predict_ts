import { formatAmount, parseAmount } from './amounts.ts'
import type { BookLevel, BookSide } from './orderBook.ts'

export type SellUnit = 'usdc' | 'shares'

export type MarketOrderArgs =
  | [string, null, 'yes' | 'no', string]
  | [string, string, 'yes' | 'no', null]

export interface MarketOrderPreview {
  args: MarketOrderArgs | null
  error: string | null
  warning: string | null
  maxQuote: bigint | null
  maxShares: bigint | null
  quoteRaw: bigint | null
  sharesRaw: bigint | null
  estQuote: string
  estShares: string
  avgPrice: string
  partial: boolean
}

interface Fill {
  quote: bigint
  shares: bigint
  partial: boolean
}

const ZERO = 0n

function min(a: bigint, b: bigint): bigint {
  return a < b ? a : b
}

function bidCapacity(level: BookLevel, one: bigint): bigint {
  if (level.priceRaw <= 0n) return ZERO
  return min(level.sizeRaw, (level.quoteRaw * one) / level.priceRaw)
}

function totalAskQuote(asks: BookLevel[], one: bigint): bigint {
  return asks.reduce((sum, level) => sum + (level.sizeRaw * level.priceRaw) / one, ZERO)
}

function totalBidShares(bids: BookLevel[], one: bigint): bigint {
  return bids.reduce((sum, level) => sum + bidCapacity(level, one), ZERO)
}

function fillBuy(asks: BookLevel[], wantQuote: bigint, one: bigint): Fill {
  let spent = ZERO
  let shares = ZERO
  let remaining = wantQuote

  for (const level of asks) {
    if (remaining <= ZERO) break
    const levelQuote = (level.sizeRaw * level.priceRaw) / one
    if (levelQuote <= ZERO) continue

    let takeShares: bigint
    let takeQuote: bigint
    if (levelQuote <= remaining) {
      takeShares = level.sizeRaw
      takeQuote = levelQuote
    } else {
      takeShares = min(level.sizeRaw, (remaining * one) / level.priceRaw)
      takeQuote = (takeShares * level.priceRaw) / one
    }
    if (takeShares <= ZERO || takeQuote <= ZERO) break

    spent += takeQuote
    shares += takeShares
    remaining -= takeQuote
  }

  return { quote: spent, shares, partial: remaining > ZERO }
}

function fillSellByShares(
  bids: BookLevel[],
  wantShares: bigint,
  holding: bigint,
  one: bigint,
): Fill {
  let sold = ZERO
  let proceeds = ZERO
  let remaining = min(wantShares, holding)

  for (const level of bids) {
    if (remaining <= ZERO) break
    const takeShares = min(remaining, bidCapacity(level, one))
    if (takeShares <= ZERO) continue
    const takeQuote = (takeShares * level.priceRaw) / one
    if (takeQuote <= ZERO) break

    sold += takeShares
    proceeds += takeQuote
    remaining -= takeShares
  }

  return { quote: proceeds, shares: sold, partial: remaining > ZERO }
}

function fillSellByQuote(
  bids: BookLevel[],
  wantQuote: bigint,
  holding: bigint,
  one: bigint,
): Fill {
  let sold = ZERO
  let proceeds = ZERO
  let remainingQuote = wantQuote
  let remainingShares = holding

  for (const level of bids) {
    if (remainingQuote <= ZERO || remainingShares <= ZERO) break
    let takeShares = (remainingQuote * one) / level.priceRaw
    takeShares = min(takeShares, bidCapacity(level, one))
    takeShares = min(takeShares, remainingShares)
    if (takeShares <= ZERO) break

    const takeQuote = (takeShares * level.priceRaw) / one
    if (takeQuote <= ZERO) break

    sold += takeShares
    proceeds += takeQuote
    remainingQuote -= takeQuote
    remainingShares -= takeShares
  }

  return { quote: proceeds, shares: sold, partial: remainingQuote > ZERO }
}

function avgPrice(quote: bigint, shares: bigint): string {
  if (shares <= ZERO) return '—'
  return (Number(quote) / Number(shares)).toFixed(4)
}

export function previewMarketOrder({
  slug,
  side,
  buy,
  sellUnit,
  amount,
  book,
  quoteDecimals,
  quoteLabel,
  quoteBalance,
  holding,
  tokenLabel,
  marketExists,
}: {
  slug: string
  side: 'yes' | 'no'
  buy: boolean
  sellUnit: SellUnit
  amount: string
  book: BookSide | null
  quoteDecimals: number
  quoteLabel: string
  quoteBalance: bigint
  holding: bigint
  tokenLabel: string
  marketExists: boolean | null
}): MarketOrderPreview {
  const none: MarketOrderPreview = {
    args: null,
    error: null,
    warning: null,
    maxQuote: null,
    maxShares: null,
    quoteRaw: null,
    sharesRaw: null,
    estQuote: '—',
    estShares: '—',
    avgPrice: '—',
    partial: false,
  }

  const fmtQuote = (raw: bigint) =>
    formatAmount(raw, quoteDecimals, Math.min(quoteDecimals, 2))
  const fmtShares = (raw: bigint) =>
    formatAmount(raw, quoteDecimals, Math.min(quoteDecimals, 2))

  if (marketExists === false) {
    return { ...none, error: 'Market is not live on-chain yet.' }
  }
  if (!book) {
    return { ...none, error: 'Order book is unavailable.' }
  }

  const one = 10n ** BigInt(quoteDecimals)

  if (buy) {
    if (book.asks.length === 0) {
      return {
        ...none,
        error: `No ${quoteLabel} asks on the book. Market buy unavailable.`,
      }
    }

    const raw = parseAmount(amount, quoteDecimals)
    const maxQuote = min(quoteBalance, totalAskQuote(book.asks, one))
    if (raw === null || raw <= ZERO) {
      return { ...none, maxQuote, error: 'Enter a valid amount.' }
    }
    if (raw > quoteBalance) {
      return {
        ...none,
        maxQuote,
        error: `Amount exceeds your available ${quoteLabel} balance.`,
      }
    }

    const fill = fillBuy(book.asks, raw, one)
    if (fill.shares <= ZERO || fill.quote <= ZERO) {
      return {
        ...none,
        maxQuote,
        error: `No ${quoteLabel} liquidity for this order.`,
      }
    }

    return {
      args: [slug, null, side, `-${raw}`],
      error: null,
      warning: fill.partial
        ? `Only ${fmtQuote(fill.quote)} of ${fmtQuote(raw)} ${quoteLabel} can fill with your balance and current asks. The rest will not fill.`
        : null,
      maxQuote,
      maxShares: null,
      quoteRaw: fill.quote,
      sharesRaw: fill.shares,
      estQuote: fmtQuote(fill.quote),
      estShares: fmtShares(fill.shares),
      avgPrice: avgPrice(fill.quote, fill.shares),
      partial: fill.partial,
    }
  }

  if (holding <= ZERO) {
    return { ...none, error: `You have no ${tokenLabel} to sell.` }
  }
  if (book.bids.length === 0) {
    return {
      ...none,
      error: `No ${quoteLabel} bids on the book. Market sell unavailable.`,
    }
  }

  const maxShares = min(holding, totalBidShares(book.bids, one))
  const maxQuote = fillSellByShares(book.bids, maxShares, holding, one).quote

  if (sellUnit === 'usdc') {
    const raw = parseAmount(amount, quoteDecimals)
    if (raw === null || raw <= ZERO) {
      return { ...none, maxQuote, maxShares, error: 'Enter a valid amount.' }
    }

    const fill = fillSellByQuote(book.bids, raw, holding, one)
    if (fill.shares <= ZERO || fill.quote <= ZERO) {
      return {
        ...none,
        maxQuote,
        maxShares,
        error: `No ${quoteLabel} liquidity for this order.`,
      }
    }

    return {
      args: [slug, null, side, `+${raw}`],
      error: null,
      warning: fill.partial
        ? `Only ${fmtQuote(fill.quote)} of ${fmtQuote(raw)} ${quoteLabel} can fill with your balance and current bids. The rest will not fill.`
        : null,
      maxQuote,
      maxShares,
      quoteRaw: fill.quote,
      sharesRaw: fill.shares,
      estQuote: fmtQuote(fill.quote),
      estShares: fmtShares(fill.shares),
      avgPrice: avgPrice(fill.quote, fill.shares),
      partial: fill.partial,
    }
  }

  const raw = parseAmount(amount, quoteDecimals)
  if (raw === null || raw <= ZERO) {
    return {
      ...none,
      maxQuote,
      maxShares,
      error: 'Enter a valid share amount.',
    }
  }
  if (raw > holding) {
    return {
      ...none,
      maxQuote,
      maxShares,
      error: `Amount exceeds your ${tokenLabel} balance.`,
    }
  }

  const fill = fillSellByShares(book.bids, raw, holding, one)
  if (fill.shares <= ZERO || fill.quote <= ZERO) {
    return {
      ...none,
      maxQuote,
      maxShares,
      error: `No ${quoteLabel} liquidity for this order.`,
    }
  }

  return {
    args: [slug, `-${raw}`, side, null],
    error: null,
    warning: fill.partial
      ? `Book depth only fills ${fmtShares(fill.shares)} of ${fmtShares(raw)} ${tokenLabel}. The rest will not fill.`
      : null,
    maxQuote,
    maxShares,
    quoteRaw: fill.quote,
    sharesRaw: fill.shares,
    estQuote: fmtQuote(fill.quote),
    estShares: fmtShares(fill.shares),
    avgPrice: avgPrice(fill.quote, fill.shares),
    partial: fill.partial,
  }
}
