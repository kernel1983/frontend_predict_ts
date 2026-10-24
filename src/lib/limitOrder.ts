import { formatAmount, parseAmount } from './amounts.ts'

export type LimitOrderArgs = [string, string, 'yes' | 'no', string]

export interface LimitOrderPreview {
  args: LimitOrderArgs | null
  error: string | null
  warning: string | null
  priceRaw: bigint | null
  baseRaw: bigint | null
  total: bigint | null
  maxQuote: bigint | null
  maxShares: bigint | null
  estQuote: string
  estShares: string
  avgPrice: string
  partial: boolean
}

const ZERO = 0n

export function previewLimitOrder({
  slug,
  side,
  buy,
  price,
  amount,
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
  price: string
  amount: string
  quoteDecimals: number
  quoteLabel: string
  quoteBalance: bigint
  holding: bigint
  tokenLabel: string
  marketExists: boolean | null
}): LimitOrderPreview {
  const none: LimitOrderPreview = {
    args: null,
    error: null,
    warning: null,
    priceRaw: null,
    baseRaw: null,
    total: null,
    maxQuote: null,
    maxShares: null,
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

  const scale = 10n ** BigInt(quoteDecimals)
  const priceRaw = parseAmount(price, quoteDecimals)
  if (priceRaw === null || priceRaw <= ZERO || priceRaw >= scale) {
    return {
      ...none,
      error: `Limit price must be greater than 0 and less than 1 ${quoteLabel}.`,
    }
  }

  const baseRaw = parseAmount(amount, quoteDecimals)
  if (baseRaw === null || baseRaw <= ZERO) {
    return {
      ...none,
      priceRaw,
      error: 'Enter a valid share amount.',
    }
  }

  const total = (baseRaw * priceRaw) / scale
  if (total <= ZERO) {
    return {
      ...none,
      priceRaw,
      baseRaw,
      error: 'Order value is too small.',
    }
  }

  if (buy) {
    const maxShares = (quoteBalance * scale) / priceRaw
    if (total > quoteBalance) {
      return {
        ...none,
        priceRaw,
        baseRaw,
        total,
        maxShares,
        error: `Order cost ${fmtQuote(total)} ${quoteLabel} exceeds your available balance.`,
      }
    }
    return {
      args: [slug, baseRaw.toString(), side, `-${total}`],
      error: null,
      warning: null,
      priceRaw,
      baseRaw,
      total,
      maxQuote: quoteBalance,
      maxShares,
      estQuote: fmtQuote(total),
      estShares: fmtShares(baseRaw),
      avgPrice: (Number(priceRaw) / Number(scale)).toFixed(4),
      partial: false,
    }
  }

  if (baseRaw > holding) {
    return {
      ...none,
      priceRaw,
      baseRaw,
      total,
      maxQuote: null,
      maxShares: holding,
      error: `Amount exceeds your ${tokenLabel} balance.`,
    }
  }

  return {
    args: [slug, `-${baseRaw}`, side, total.toString()],
    error: null,
    warning: null,
    priceRaw,
    baseRaw,
    total,
    maxQuote: null,
    maxShares: holding,
    estQuote: fmtQuote(total),
    estShares: fmtShares(baseRaw),
    avgPrice: (Number(priceRaw) / Number(scale)).toFixed(4),
    partial: false,
  }
}
