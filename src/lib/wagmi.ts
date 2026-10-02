import { createConfig, http } from 'wagmi'
import {
  arbitrum,
  base,
  baseSepolia,
  mainnet,
  optimism,
  polygon,
  sepolia,
} from 'wagmi/chains'
import { coinbaseWallet, injected, walletConnect } from 'wagmi/connectors'
import type { EIP1193Provider } from 'viem'

const chains = [
  mainnet,
  polygon,
  arbitrum,
  optimism,
  base,
  sepolia,
  baseSepolia,
] as const

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID

interface RabbyProvider extends EIP1193Provider {
  isRabby?: boolean
  providers?: RabbyProvider[]
}

function findRabbyProvider(win?: unknown): EIP1193Provider | undefined {
  const ethereum = (win as { ethereum?: RabbyProvider } | undefined)?.ethereum
  if (!ethereum) return undefined
  return (
    ethereum.providers?.find((provider) => provider?.isRabby) ??
    (ethereum.isRabby ? ethereum : undefined)
  )
}

const rabby = injected({
  target: {
    id: 'io.rabby',
    name: 'Rabby Wallet',
    provider: findRabbyProvider,
  },
})

const connectors = projectId
  ? [
      rabby,
      injected({ target: 'metaMask' }),
      coinbaseWallet({ appName: 'predict' }),
      walletConnect({ projectId }),
    ]
  : [rabby, injected({ target: 'metaMask' }), coinbaseWallet({ appName: 'predict' })]

export const wagmiConfig = createConfig({
  chains,
  connectors,
  multiInjectedProviderDiscovery: false,
  transports: Object.fromEntries(
    chains.map((chain) => [chain.id, http()]),
  ) as Record<number, ReturnType<typeof http>>,
})