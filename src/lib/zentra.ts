import { toHex, type Address, type Hex } from 'viem'
import {
  useChainModeStore,
  type ChainMode,
} from '@/store/chainMode'

export const USDC_DECIMALS = 6

/**
 * zen 合约地址 = 空地址占位（两个模式相同）。
 * 链上并没有真正的合约，gazer 只是监听发往该地址的 tx 并解析 input 里的 JSON。
 */
export const ZEN_CONTRACT: Address =
  '0x00000000000000000000000000000000007a656e'

export interface ZentraEnv {
  indexerUrl: string
  withdrawChainId: number
  withdrawChainName: string
  explorerBase: string
  /** 是否允许向 indexer 免费领取测试币 */
  mintEnabled: boolean
}

export const ZENTRA_ENVS: Record<ChainMode, ZentraEnv> = {
  testnet: {
    indexerUrl: 'https://testnet3.zentra.dev',
    withdrawChainId: 84532,
    withdrawChainName: 'Base Sepolia',
    explorerBase: 'https://sepolia.basescan.org',
    mintEnabled: true,
  },
  mainnet: {
    indexerUrl: '',
    withdrawChainId: 8453,
    withdrawChainName: 'Base',
    explorerBase: 'https://basescan.org',
    mintEnabled: false,
  },
}

/** indexer 未配置视为不可用 */
export function isEnvConfigured(env: ZentraEnv): boolean {
  return env.indexerUrl !== ''
}

/**
 * 查询 indexer 上某前缀的状态 value（原始值），未配置/出错抛错。
 * 返回字符串以保留大整数精度。
 */
export async function fetchRawState(prefix: string): Promise<string> {
  const env = ZENTRA_ENVS[useChainModeStore.getState().mode]
  if (!isEnvConfigured(env)) {
    throw new Error(`${env.withdrawChainName} is not configured yet.`)
  }
  const url = `${env.indexerUrl}/api/get_latest_state?prefix=${encodeURIComponent(prefix)}`
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Failed to fetch state (${res.status})`)
  }
  const text = await res.text()
  const data = JSON.parse(text, (_key, value) =>
    typeof value === 'number' && !Number.isSafeInteger(value) ? BigInt(value) : value,
  ) as { result?: unknown }
  let val = data?.result ?? null
  if (Array.isArray(val)) val = val[0] ?? null
  if (val === null || val === undefined) return '0'
  return String(val)
}

export interface PredictMarketProbe {
  slug: string
  /** best-effort 判断：探测到任何非空状态即视为已在链上创建 */
  marketExists: boolean
  foundPrefix: string | null
  orderbookExists: boolean
  orderbook: PredictOrderbook
  /** 逐前缀探测结果明细（调试用） */
  details: string
  error: string | null
}

/** 调试用：探测 slug 是否已在 indexer/链上创建，返回各查询原始结果 */
export async function fetchPredictMarketProbe(slug: string): Promise<PredictMarketProbe> {
  const env = ZENTRA_ENVS[useChainModeStore.getState().mode]
  const probe: PredictMarketProbe = {
    slug,
    marketExists: false,
    foundPrefix: null,
    orderbookExists: false,
    orderbook: { yes: null, no: null, yesBid: null, noBid: null },
    details: '',
    error: null,
  }
  if (!isEnvConfigured(env)) {
    probe.error = `${env.withdrawChainName} indexer is not configured yet.`
    return probe
  }

  try {
    const book = await fetchPredictOrderbook(slug)
    probe.orderbook = book
    probe.orderbookExists = book.yes !== null || book.no !== null
    probe.details += `predict_orderbook?slug= → ${JSON.stringify(book)}\n`
  } catch (err) {
    probe.details += `predict_orderbook?slug= → error ${toErrorMessageSafe(err)}\n`
  }

  // 市场创建后 indexer 会在 base-predict-{slug}_* 命名空间写入非空状态
  // （quote_token="USDC"，yes/no 的 buy_start/buy_new/sell_start/sell_new=1）
  const prefixes = [
    `base-predict-${slug}_quote_token`,
    `base-predict-${slug}_yes_buy_start`,
    `base-predict-${slug}_no_buy_start`,
    `base-predict-${slug}_yes_sell_start`,
    `base-predict-${slug}_no_sell_start`,
  ]
  for (const prefix of prefixes) {
    try {
      const res = await fetch(
        `${env.indexerUrl}/api/get_latest_state?prefix=${encodeURIComponent(prefix)}`,
      )
      const text = await res.text()
      const raw = (JSON.parse(text) as { result?: unknown }).result
      const serialized =
        raw === null || raw === undefined
          ? 'null'
          : String(Array.isArray(raw) ? JSON.stringify(raw) : raw)
      const empty =
        raw === null ||
        raw === undefined ||
        serialized === '' ||
        serialized === '0' ||
        serialized === '[]' ||
        (Array.isArray(raw) && (raw as unknown[]).length === 0)
      probe.details += `${prefix} → ${empty ? '∅' : serialized.slice(0, 120)}\n`
      if (!empty && probe.foundPrefix === null) {
        probe.marketExists = true
        probe.foundPrefix = prefix
      }
    } catch (err) {
      probe.details += `${prefix} → error ${toErrorMessageSafe(err)}\n`
    }
  }

  return probe
}

function toErrorMessageSafe(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err)
}

/** 查询 indexer 上某地址的 USDC 余额（rollup 内部状态） */
export async function fetchUsdcBalance(address: Address): Promise<bigint> {
  return BigInt(await fetchRawState(`base-USDC-balance:${address.toLowerCase()}`))
}

export interface PredictOrderbook {
  /** bestAsk：买入一档（吃单卖一）价格，美元 */
  yes: number | null
  no: number | null
  /** bestBid：卖出一档（吃单买一）价格，美元 */
  yesBid: number | null
  noBid: number | null
}

/** indexer 原始盘口一级：price 为 18 位小数单价（wei 风格），base 为 6 位小数数量（ask 负/bid 正），quote 为 6 位小数金额 */
export interface PredictOrderbookLevel {
  id?: number
  owner?: string
  base: string
  quote: string
  price: string
}

/** indexer 返回的原始订单簿：每侧 bestAsk/bestBid 为美元字符串或 null，asks/bids 为盘口级 */
export interface PredictOrderbookSide {
  bestAsk: string | null
  bestBid: string | null
  asks: PredictOrderbookLevel[]
  bids: PredictOrderbookLevel[]
}

export interface PredictOrderbookRaw {
  slug: string
  yes: PredictOrderbookSide
  no: PredictOrderbookSide
}

/** 查询 indexer 上某个 updown slug 的原始订单簿（调试用） */
export async function fetchPredictOrderbookRaw(slug: string): Promise<PredictOrderbookRaw | null> {
  const env = ZENTRA_ENVS[useChainModeStore.getState().mode]
  if (!isEnvConfigured(env)) {
    throw new Error(`${env.withdrawChainName} is not configured yet.`)
  }
  const url = `${env.indexerUrl}/api/predict_orderbook?slug=${encodeURIComponent(slug)}`
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Failed to fetch orderbook (${res.status})`)
  }
  const data = (await res.json()) as {
    slug?: string
    result?: { yes?: PredictOrderbookSide; no?: PredictOrderbookSide } | null
  }
  if (!data?.result?.yes || !data?.result?.no) return null
  return {
    slug: data.slug ?? slug,
    yes: data.result.yes,
    no: data.result.no,
  }
}

/** 查询 indexer 上某个 updown slug 的 YES/NO bestAsk（买入价）与 bestBid（卖出价），美元 */
export async function fetchPredictOrderbook(slug: string): Promise<PredictOrderbook> {
  const raw = await fetchPredictOrderbookRaw(slug)
  const px = (v: string | null | undefined) => {
    const n = Number(v)
    return Number.isFinite(n) && n > 0 ? n : null
  }
  return {
    yes: raw ? px(raw.yes.bestAsk) : null,
    no: raw ? px(raw.no.bestAsk) : null,
    yesBid: raw ? px(raw.yes.bestBid) : null,
    noBid: raw ? px(raw.no.bestBid) : null,
  }
}

/** 构造发往 zen 合约的 calldata：把 JSON 文本序列化为 utf-8 hex */
export function buildZenCallData(fn: string, args: unknown[]): Hex {
  return toHex(JSON.stringify({ p: 'zentest3', f: fn, a: args }))
}

/** 提现：桥接 USDC 到 base（burn rollup 余额，operator 在 L1 出金） */
export function buildBridgeOutgoingData(amount: bigint): Hex {
  return buildZenCallData('bridge_outgoing', ['USDC', amount.toString(), 'base'])
}

/** 免费铸造测试币：向 indexer 申请 amount 单位的模拟 USDC（仅 testnet） */
export function buildFreeMintData(amount: bigint): Hex {
  return buildZenCallData('token_mint_free', ['USDC', amount.toString()])
}

/** 将用户输入的十进制字符串解析为 6 位小数的原始整数，非法返回 null */
function parseDecimal6(input: string): bigint | null {
  const m = input.trim().match(/^(\d+)(?:\.(\d*))?$/)
  if (!m) return null
  let frac = (m[2] ?? '').slice(0, USDC_DECIMALS)
  frac = frac.padEnd(USDC_DECIMALS, '0')
  const whole = BigInt(m[1] || '0')
  return whole * 10n ** BigInt(USDC_DECIMALS) + (frac ? BigInt(frac) : 0n)
}

/** 将用户输入的 USDC 金额（字符串）解析为原始整数（6 位小数），非法返回 null */
export function parseUsdcAmount(input: string): bigint | null {
  return parseDecimal6(input)
}

/** 份额（YES/NO）余额同为 6 位小数，解析规则与 USDC 一致 */
export function parseShareAmount(input: string): bigint | null {
  return parseDecimal6(input)
}

/** 卖出单位：usdc = 输入想拿到的 USDC 金额；shares = 输入想卖出的份额 */
export type SellUnit = 'usdc' | 'shares'

/**
 * 美元单价 → 6 位定点整数。
 * 份额与 USDC 换算全走整数，避免 0.46 这类单价带来浮点误差。
 */
export function parsePriceMicros(price: number): bigint {
  return BigInt(Math.round(price * 10 ** USDC_DECIMALS))
}

/** predict_market_order 的实际入参：市价单只走 quote 腿，base 恒为 null */
export type MarketOrderArgs = [string, null, 'yes' | 'no', string]

export interface MarketOrderPreview {
  /** 真正会发上链的四个参数，null 表示当前输入不合法 */
  args: MarketOrderArgs | null
  error: string | null
  /** 当前输入下的金额上限（买入为 USDC 余额，卖出为按买一价可换回的 USDC） */
  maxUsdc: bigint | null
  /** 预计拿到的 USDC */
  estUsdc: string
  /** 预计卖出的份额 */
  estShares: string
}

const ONE = 10n ** BigInt(USDC_DECIMALS)

/**
 * 依据「买/卖 + 卖出单位」推导出市价单入参与预估，并做余额上限校验。
 *
 * 市价单只认 quote 腿：买为负（付 USDC），卖为正（收 USDC）。
 * 与 backend/testnet_rpc_market_order.py 一致，卖出无法直接用份额表达，
 * 因此 shares 单位会按当前 bestBid 换算成 USDC 金额（向下取整，
 * 保证盘口不变时卖出的份额不会多于用户输入）。
 */
export function previewMarketOrder({
  slug,
  side,
  buy,
  sellUnit,
  amount,
  bestAsk,
  bestBid,
  usdc,
  holding,
  tokenLabel,
}: {
  slug: string
  side: 'yes' | 'no'
  buy: boolean
  sellUnit: SellUnit
  amount: string
  bestAsk: number | null
  bestBid: number | null
  usdc: bigint
  holding: bigint
  tokenLabel: string
}): MarketOrderPreview {
  const none: MarketOrderPreview = {
    args: null,
    error: null,
    maxUsdc: null,
    estUsdc: '—',
    estShares: '—',
  }
  if (buy) {
    const raw = parseUsdcAmount(amount)
    if (raw === null || raw <= 0n) {
      return { ...none, error: 'Enter a valid amount.' }
    }
    if (raw > usdc) {
      return { ...none, error: 'Amount exceeds your available USDC balance.' }
    }
    return {
      args: [slug, null, side, `-${raw}`],
      error: null,
      maxUsdc: usdc,
      estUsdc: formatUsdc(raw, 2),
      estShares:
        bestAsk === null
          ? '—'
          : formatUsdc((raw * ONE) / parsePriceMicros(bestAsk), 2),
    }
  }

  if (holding <= 0n) {
    return { ...none, error: `You have no ${tokenLabel} to sell.` }
  }
  if (bestBid === null) {
    return { ...none, error: 'No best bid to price this sell against.' }
  }
  const bid = parsePriceMicros(bestBid)
  const bidText = formatUsdc(bid, 2)
  // 手上份额按当前买一价最多能换回多少 USDC
  const maxProceeds = (holding * bid) / ONE

  if (sellUnit === 'usdc') {
    const raw = parseUsdcAmount(amount)
    if (raw === null || raw <= 0n) {
      return { ...none, maxUsdc: maxProceeds, error: 'Enter a valid amount.' }
    }
    if (raw > maxProceeds) {
      return {
        ...none,
        maxUsdc: maxProceeds,
        error: `Amount exceeds what your ${formatUsdc(holding, 2)} ${tokenLabel} can fetch at ${bidText} (max ${formatUsdc(maxProceeds, 2)}).`,
      }
    }
    return {
      args: [slug, null, side, `+${raw}`],
      error: null,
      maxUsdc: maxProceeds,
      estUsdc: formatUsdc(raw, 2),
      estShares: formatUsdc((raw * ONE) / bid, 2),
    }
  }

  const raw = parseShareAmount(amount)
  if (raw === null || raw <= 0n) {
    return { ...none, maxUsdc: maxProceeds, error: 'Enter a valid share amount.' }
  }
  if (raw > holding) {
    return {
      ...none,
      maxUsdc: maxProceeds,
      error: `Amount exceeds your ${tokenLabel} balance.`,
    }
  }
  const quote = (raw * bid) / ONE
  if (quote <= 0n) {
    return { ...none, maxUsdc: maxProceeds, error: 'Amount is too small to sell.' }
  }
  return {
    args: [slug, null, side, `+${quote}`],
    error: null,
    maxUsdc: maxProceeds,
    estUsdc: formatUsdc(quote, 2),
    estShares: formatUsdc(raw, 2),
  }
}

/** 格式化原始 USDC 余额为可读文本，fractionDigits 控制小数位数 */
export function formatUsdc(raw: bigint, fractionDigits = USDC_DECIMALS): string {
  const decimals = USDC_DECIMALS
  const sign = raw < 0n ? '-' : ''
  const abs = (raw < 0n ? -raw : raw).toString().padStart(decimals + 1, '0')
  const whole = abs.slice(0, -decimals)
  let frac = abs.slice(-decimals)
  if (fractionDigits >= decimals) {
    frac = frac.replace(/0+$/, '')
  } else {
    frac = frac.slice(0, fractionDigits).replace(/0+$/, '')
  }
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return frac ? `${sign}${grouped}.${frac}` : sign + grouped
}