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

const connectors = projectId
  ? [
      injected({ target: 'metaMask' }),
      coinbaseWallet({ appName: 'predict' }),
      walletConnect({ projectId }),
    ]
  : [injected({ target: 'metaMask' }), coinbaseWallet({ appName: 'predict' })]

export const wagmiConfig = createConfig({
  chains,
  connectors,
  multiInjectedProviderDiscovery: false,
  transports: Object.fromEntries(
    chains.map((chain) => [chain.id, http()]),
  ) as Record<number, ReturnType<typeof http>>,
})