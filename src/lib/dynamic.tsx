import { useCallback, useEffect, useState, type ReactNode } from 'react'
import {
  DynamicContextProvider,
  useDynamicContext,
} from '@dynamic-labs/sdk-react-core'
import { EthereumWalletConnectors, isEthereumWallet } from '@dynamic-labs/ethereum'
import {
  createPublicClient,
  http,
  type Chain,
  type Hash,
  type TransactionReceipt,
} from 'viem'
import { waitForTransactionReceipt as viemWaitForTransactionReceipt } from 'viem/actions'
import { baseSepolia } from 'viem/chains'
import { evmNetworksOverride, appChains, findAppChain } from '@/lib/chains'
import { useChainModeStore } from '@/store/chainMode'
import { ZENTRA_ENVS } from '@/lib/zentra'

const environmentId = import.meta.env.VITE_DYNAMIC_ENVIRONMENT_ID as
  | string
  | undefined

/** 是否已配置 Dynamic（未配置时页面正常渲染，钱包功能禁用） */
export const dynamicConfigured = Boolean(environmentId && environmentId.trim())

/** viem wallet client 的最小结构（避免 Dynamic 内部 viem 副本的类型冲突） */
export interface MinimalWalletClient {
  sendTransaction(params: {
    to: `0x${string}`
    value?: bigint
    data?: `0x${string}`
  }): Promise<`0x${string}` | undefined>
}

/** 与 wagmi 兼容的最小钱包接口（Dynamic EthereumWallet 的结构化子集） */
export interface SignerWallet {
  address: string
  getNetwork(): Promise<string | number | undefined>
  isConnected(): Promise<boolean>
  signMessage(message: string): Promise<string | undefined>
  switchNetwork(networkChainId: number | string): Promise<void>
  getWalletClient(chainId?: string): Promise<MinimalWalletClient>
  connector: { name: string; supportsNetworkSwitching(): boolean }
}

/** Dynamic provider 设置（overrides 回调必须为稳定引用） */
export function DynamicProviders({ children }: { children: ReactNode }) {
  // 未配置 environmentId 时跳过 Provider，避免 SDK 报错白屏
  if (!dynamicConfigured) return <>{children}</>
  return (
    <DynamicContextProvider
      settings={{
        environmentId: environmentId!.trim(),
        walletConnectors: [EthereumWalletConnectors],
        overrides: {
          evmNetworks: evmNetworksOverride,
        },
      }}
    >
      {children}
    </DynamicContextProvider>
  )
}

/**
 * useDynamicContext 的容错版：无 Provider 时返回 null（hook 调用顺序不变）。
 */
export function useDynamicContextSafe() {
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks -- 无 Provider 时该 hook 会抛错，try/catch 是刻意的降级手段
    return useDynamicContext()
  } catch {
    return null
  }
}

function parseNetworkId(value: string | number): number {
  if (typeof value === 'number') return value
  const text = value.trim()
  if (text.toLowerCase().startsWith('0x')) {
    return Number.parseInt(text, 16)
  }
  return Number.parseInt(text, 10)
}

/** 当前 EVM 主钱包（Google 登录创建的 embedded wallet 或浏览器钱包） */
export function useDynamicWallet(): SignerWallet | null {
  const context = useDynamicContextSafe()
  const primaryWallet = context?.primaryWallet
  if (primaryWallet && isEthereumWallet(primaryWallet)) {
    return primaryWallet as unknown as SignerWallet
  }
  return null
}

export interface WagmiAccount {
  address: `0x${string}` | undefined
  isConnected: boolean
  chainId: number | undefined
  chain: Chain | undefined
  connector: { id: string; name: string } | null
}

export function useAccount(): WagmiAccount {
  const wallet = useDynamicWallet()
  const { network } = useDynamicContextSafe() ?? { network: undefined }
  const chainId =
    typeof network === 'number'
      ? network
      : network != null
        ? parseNetworkId(network)
        : undefined
  return {
    address: wallet?.address as `0x${string}` | undefined,
    isConnected: Boolean(wallet),
    chainId: Number.isNaN(chainId as number) ? undefined : chainId,
    chain: findAppChain(chainId),
    connector: wallet ? { id: wallet.connector.name, name: wallet.connector.name } : null,
  }
}

export function useChains(): readonly Chain[] {
  return appChains
}

export function useChainId(): number | undefined {
  return useAccount().chainId
}

export function useDisconnect() {
  const { handleLogOut } = useDynamicContextSafe() ?? {}
  const disconnectAsync = useCallback(async () => {
    if (!handleLogOut) throw notConfiguredError()
    await handleLogOut()
  }, [handleLogOut])
  return { disconnect: disconnectAsync, disconnectAsync }
}

function notConfiguredError(): Error {
  return new Error(
    'Dynamic is not configured: set VITE_DYNAMIC_ENVIRONMENT_ID in .env',
  )
}

export function useSignMessage() {
  const wallet = useDynamicWallet()
  const [isPending, setPending] = useState(false)

  const signMessageAsync = useCallback(
    async ({ message }: { message: string }): Promise<`0x${string}`> => {
      if (!dynamicConfigured) throw notConfiguredError()
      if (!wallet) throw new Error('Connect a wallet to sign.')
      setPending(true)
      try {
        const signature = await wallet.signMessage(message)
        if (!signature) throw new Error('Signature request was not completed.')
        return signature as `0x${string}`
      } finally {
        setPending(false)
      }
    },
    [wallet],
  )

  const signMessage = useCallback(
    async (args: { message: string }) => {
      try {
        return await signMessageAsync(args)
      } catch {
        return undefined
      }
    },
    [signMessageAsync],
  )

  return { signMessage, signMessageAsync, isPending }
}

export interface SendTransactionParams {
  chainId?: number
  account?: string
  to: `0x${string}`
  value?: bigint
  data?: `0x${string}`
}

export function useSendTransaction() {
  const wallet = useDynamicWallet()
  const [isPending, setPending] = useState(false)

  const sendTransactionAsync = useCallback(
    async (params: SendTransactionParams): Promise<`0x${string}`> => {
      if (!dynamicConfigured) throw notConfiguredError()
      if (!wallet) throw new Error('Connect a wallet first.')
      setPending(true)
      try {
        const walletClient = await wallet.getWalletClient(
          params.chainId != null ? String(params.chainId) : undefined,
        )
        const hash = await walletClient.sendTransaction({
          to: params.to,
          value: params.value ?? 0n,
          data: params.data,
        })
        if (!hash) throw new Error('Transaction was not submitted.')
        return hash
      } finally {
        setPending(false)
      }
    },
    [wallet],
  )

  const sendTransaction = useCallback(
    async (params: SendTransactionParams) => {
      try {
        return await sendTransactionAsync(params)
      } catch {
        return undefined
      }
    },
    [sendTransactionAsync],
  )

  return { sendTransaction, sendTransactionAsync, isPending }
}

export function useSwitchChain() {
  const wallet = useDynamicWallet()
  const switchChainAsync = useCallback(
    async ({ chainId }: { chainId: number }) => {
      if (!dynamicConfigured) throw notConfiguredError()
      if (!wallet) throw new Error('Connect a wallet first.')
      await wallet.switchNetwork(chainId)
    },
    [wallet],
  )
  const switchChain = useCallback(
    async (args: { chainId: number }) => {
      try {
        await switchChainAsync(args)
      } catch {
        // 静默失败，与 wagmi 的非 async 版本行为一致
      }
    },
    [switchChainAsync],
  )
  return { switchChain, switchChainAsync }
}

function publicClientFor(chainId: number) {
  const chain = findAppChain(chainId) ?? baseSepolia
  return createPublicClient({ chain, transport: http() })
}

function currentChainId(): number {
  const mode = useChainModeStore.getState().mode
  return ZENTRA_ENVS[mode].withdrawChainId
}

export interface WaitForReceiptParams {
  chainId?: number
  hash: Hash
  confirmations?: number
}

export function waitForReceipt(
  params: WaitForReceiptParams,
): Promise<TransactionReceipt> {
  return viemWaitForTransactionReceipt(publicClientFor(params.chainId ?? currentChainId()), {
    hash: params.hash,
    confirmations: params.confirmations ?? 1,
  })
}

export function useWaitForTransactionReceipt(params: {
  hash?: Hash | undefined
  confirmations?: number
  chainId?: number
}) {
  const { hash, confirmations = 1, chainId } = params
  const [data, setData] = useState<TransactionReceipt | undefined>(undefined)
  const [error, setError] = useState<Error | null>(null)
  const [isLoading, setLoading] = useState(false)

  useEffect(() => {
    if (!hash) {
      setData(undefined)
      setError(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    setData(undefined)
    waitForReceipt({ chainId, hash, confirmations })
      .then((receipt) => {
        if (!cancelled) setData(receipt)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err : new Error(String(err)))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [hash, confirmations, chainId])

  return {
    data,
    error,
    isLoading,
    isSuccess: Boolean(data),
    isError: Boolean(error),
  }
}
