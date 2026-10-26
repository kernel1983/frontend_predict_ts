import type { Chain } from 'viem'
import {
  arbitrum,
  base,
  baseSepolia,
  mainnet,
  optimism,
  polygon,
  sepolia,
} from 'viem/chains'
import type { GenericNetwork } from '@dynamic-labs/types'
import { mergeNetworks } from '@dynamic-labs/sdk-react-core'

/** Robinhood Chain Testnet（zentra 调试用，viem 未内置） */
export const robinhoodTestnet: Chain = {
  id: 46630,
  name: 'Robinhood Chain Testnet',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.testnet.chain.robinhood.com'] },
  },
  blockExplorers: {
    default: {
      name: 'Explorer',
      url: 'https://explorer.testnet.chain.robinhood.com',
    },
  },
}

/** 应用支持的全部 EVM 链（wagmi 时代的链表 + 调试链） */
export const appChains: readonly Chain[] = [
  mainnet,
  polygon,
  arbitrum,
  optimism,
  base,
  sepolia,
  baseSepolia,
  robinhoodTestnet,
]

export function findAppChain(chainId: number | undefined): Chain | undefined {
  if (chainId === undefined || Number.isNaN(chainId)) return undefined
  return appChains.find((chain) => chain.id === chainId)
}

/** viem Chain → Dynamic 网络配置 */
export function toEvmNetwork(chain: Chain): GenericNetwork {
  return {
    name: chain.name,
    chainId: chain.id,
    networkId: chain.id,
    isTestnet: chain.testnet ?? chain.id !== mainnet.id,
    iconUrls: [],
    nativeCurrency: {
      name: chain.nativeCurrency.name,
      symbol: chain.nativeCurrency.symbol,
      decimals: chain.nativeCurrency.decimals,
    },
    rpcUrls: [...chain.rpcUrls.default.http],
    blockExplorerUrls: chain.blockExplorers
      ? [chain.blockExplorers.default.url]
      : [],
    vanityName: chain.name,
  }
}

/**
 * Dynamic 侧的网络列表：应用链优先，dashboard 配置兜底。
 * 模块级常量（overrides 回调必须稳定引用）。
 */
export const evmNetworksOverride = (
  dashboardNetworks: GenericNetwork[],
): GenericNetwork[] => mergeNetworks(appChains.map(toEvmNetwork), dashboardNetworks)
