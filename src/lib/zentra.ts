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
}

export const ZENTRA_ENVS: Record<ChainMode, ZentraEnv> = {
  testnet: {
    indexerUrl: 'https://testnet3.zentra.dev',
    withdrawChainId: 84532,
    withdrawChainName: 'Base Sepolia',
    explorerBase: 'https://sepolia.basescan.org',
  },
  mainnet: {
    indexerUrl: '',
    withdrawChainId: 8453,
    withdrawChainName: 'Base',
    explorerBase: 'https://basescan.org',
  },
}

/** indexer 未配置视为不可用 */
export function isEnvConfigured(env: ZentraEnv): boolean {
  return env.indexerUrl !== ''
}

/**
 * 查询 indexer 上某地址的 USDC 余额（rollup 内部状态）。
 * 状态 key：base-USDC-balance:<addr>；返回原始整数（6 位小数）。
 */
export async function fetchUsdcBalance(address: Address): Promise<bigint> {
  const env = ZENTRA_ENVS[useChainModeStore.getState().mode]
  if (!isEnvConfigured(env)) {
    throw new Error(`${env.withdrawChainName} is not configured yet.`)
  }
  const url = `${env.indexerUrl}/api/get_latest_state?prefix=${encodeURIComponent(
    `base-USDC-balance:${address.toLowerCase()}`,
  )}`
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Failed to fetch USDC balance (${res.status})`)
  }
  const text = await res.text()
  const match = text.match(/"result"\s*:\s*null|"result"\s*:\s*(-?\d+)/)
  if (!match || match[0].includes('null')) return 0n
  return BigInt(match[1])
}

/** 构造发往 zen 合约的 calldata：把 JSON 文本序列化为 utf-8 hex */
export function buildZenCallData(fn: string, args: unknown[]): Hex {
  return toHex(JSON.stringify({ p: 'zentest3', f: fn, a: args }))
}

/** 提现：桥接 USDC 到 base（burn rollup 余额，operator 在 L1 出金） */
export function buildBridgeOutgoingData(amount: bigint): Hex {
  return buildZenCallData('bridge_outgoing', ['USDC', amount.toString(), 'base'])
}

/** 将用户输入的 USDC 金额（字符串）解析为原始整数（6 位小数），非法返回 null */
export function parseUsdcAmount(input: string): bigint | null {
  const m = input.trim().match(/^(\d+)(?:\.(\d*))?$/)
  if (!m) return null
  let frac = (m[2] ?? '').slice(0, USDC_DECIMALS)
  frac = frac.padEnd(USDC_DECIMALS, '0')
  const whole = BigInt(m[1] || '0')
  return whole * 10n ** BigInt(USDC_DECIMALS) + (frac ? BigInt(frac) : 0n)
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