export interface BookLevel {
  price: number
  priceRaw: bigint
  size: number
  sizeRaw: bigint
  quote: number
  quoteRaw: bigint
}

export interface BookSide {
  bestAsk: number | null
  bestBid: number | null
  asks: BookLevel[]
  bids: BookLevel[]
}

export interface PredictBook {
  yes: BookSide
  no: BookSide
}

export interface RawBookLevel {
  id?: number
  owner?: string
  base: string
  quote: string
  price: string
}

export interface RawBookSide {
  bestAsk?: string | null
  bestBid?: string | null
  asks?: RawBookLevel[]
  bids?: RawBookLevel[]
}

export interface RawPredictBook {
  yes?: RawBookSide
  no?: RawBookSide
}

function toRaw(value: string | number | null | undefined): bigint {
  if (value === null || value === undefined) return 0n
  if (typeof value === 'bigint') return value
  if (typeof value === 'number') {
    return Number.isFinite(value) ? BigInt(Math.trunc(value)) : 0n
  }
  try {
    return BigInt(value)
  } catch {
    const n = Number(value)
    return Number.isFinite(n) ? BigInt(Math.trunc(n)) : 0n
  }
}

function normalizeSide(raw: RawBookSide | undefined, quoteDecimals: number): BookSide {
  const decimals = Number.isInteger(quoteDecimals) && quoteDecimals >= 0 ? quoteDecimals : 6
  const scale = 10 ** decimals

  const level = (l: RawBookLevel): BookLevel | null => {
    const sizeRaw = toRaw(l.base)
    const quoteRaw = toRaw(l.quote)
    const sizeAbs = sizeRaw < 0n ? -sizeRaw : sizeRaw
    const quoteAbs = quoteRaw < 0n ? -quoteRaw : quoteRaw
    let priceRaw = toRaw(l.price)
    if (priceRaw <= 0n) {
      const n = Number(l.price)
      if (!Number.isFinite(n) || n <= 0) return null
      priceRaw = BigInt(Math.round(n * scale))
    }
    if (priceRaw <= 0n || sizeAbs <= 0n) return null
    const size = Number(sizeAbs) / scale
    const price = Number(priceRaw) / scale
    const quote = Number(quoteAbs) / scale
    if (!Number.isFinite(size) || size <= 0) return null
    if (!Number.isFinite(price) || price <= 0) return null
    return { price, priceRaw, size, sizeRaw: sizeAbs, quote, quoteRaw: quoteAbs }
  }

  const asks = (raw?.asks ?? [])
    .map((l) => level(l))
    .filter((l): l is BookLevel => l !== null)
    .sort((a, b) => (a.priceRaw < b.priceRaw ? -1 : a.priceRaw > b.priceRaw ? 1 : 0))

  const bids = (raw?.bids ?? [])
    .map((l) => level(l))
    .filter((l): l is BookLevel => l !== null)
    .sort((a, b) => (a.priceRaw > b.priceRaw ? -1 : a.priceRaw < b.priceRaw ? 1 : 0))

  return {
    asks,
    bids,
    bestAsk: asks[0]?.price ?? null,
    bestBid: bids[0]?.price ?? null,
  }
}

export function normalizePredictBook(
  raw: RawPredictBook | null | undefined,
  quoteDecimals: number,
): PredictBook {
  return {
    yes: normalizeSide(raw?.yes, quoteDecimals),
    no: normalizeSide(raw?.no, quoteDecimals),
  }
}
