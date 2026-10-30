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
import { estimateFeesPerGas, estimateGas } from 'viem/actions'
import { baseSepolia } from 'viem/chains'
import {
  useAccount as useWagmiAccount,
  useDisconnect as useWagmiDisconnect,
  useSendTransaction as useWagmiSendTransaction,
  useSignMessage as useWagmiSignMessage,
  useSwitchChain as useWagmiSwitchChain,
} from 'wagmi'
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
    type?: 'legacy' | 'eip1559'
    value?: bigint
    data?: `0x${string}`
    gas?: bigint
    nonce?: number
    maxFeePerGas?: bigint
    maxPriorityFeePerGas?: bigint
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

/** 登录方式：Google（Dynamic embedded wallet）或钱包（wagmi） */
export type LoginType = 'google' | 'wallet' | null

export function useLoginType(): LoginType {
  const dynWallet = useDynamicWallet()
  const wagmi = useWagmiAccount()
  if (dynWallet) return 'google'
  if (wagmi.isConnected) return 'wallet'
  return null
}

export function useActiveAddress(): `0x${string}` | undefined {
  return useAccount().address
}

export function useAccount(): WagmiAccount {
  const dynWallet = useDynamicWallet()
  const dynCtx = useDynamicContextSafe()
  const wagmi = useWagmiAccount()

  if (dynWallet) {
    const network = dynCtx?.network
    const chainId =
      typeof network === 'number'
        ? network
        : network != null
          ? parseNetworkId(network)
          : undefined
    return {
      address: dynWallet.address as `0x${string}`,
      isConnected: true,
      chainId: Number.isNaN(chainId as number) ? undefined : chainId,
      chain: findAppChain(chainId),
      connector: { id: dynWallet.connector.name, name: dynWallet.connector.name },
    }
  }

  return {
    address: wagmi.address,
    isConnected: wagmi.isConnected,
    chainId: wagmi.chainId,
    chain: wagmi.chain as Chain | undefined,
    connector: wagmi.connector
      ? { id: wagmi.connector.id, name: wagmi.connector.name }
      : null,
  }
}

export function useChains(): readonly Chain[] {
  return appChains
}

export function useChainId(): number | undefined {
  return useAccount().chainId
}

export function useDisconnect() {
  const dynWallet = useDynamicWallet()
  const dynCtx = useDynamicContextSafe()
  const wagmiDisconnect = useWagmiDisconnect()

  const disconnectAsync = useCallback(async () => {
    if (dynWallet) {
      const handleLogOut = dynCtx?.handleLogOut
      if (!handleLogOut) throw notConfiguredError()
      await handleLogOut()
      return
    }
    await wagmiDisconnect.disconnectAsync()
  }, [dynWallet, dynCtx, wagmiDisconnect])

  return { disconnect: disconnectAsync, disconnectAsync }
}

function notConfiguredError(): Error {
  return new Error(
    'Dynamic is not configured: set VITE_DYNAMIC_ENVIRONMENT_ID in .env',
  )
}

export function useSignMessage() {
  const dynWallet = useDynamicWallet()
  const wagmiSign = useWagmiSignMessage()
  const [isPending, setPending] = useState(false)

  const signMessageAsync = useCallback(
    async ({ message }: { message: string }): Promise<`0x${string}`> => {
      if (dynWallet) {
        if (!dynamicConfigured) throw notConfiguredError()
        setPending(true)
        try {
          const signature = await dynWallet.signMessage(message)
          if (!signature) throw new Error('Signature request was not completed.')
          return signature as `0x${string}`
        } finally {
          setPending(false)
        }
      }
      setPending(true)
      try {
        const signature = await wagmiSign.signMessageAsync({ message })
        return signature as `0x${string}`
      } finally {
        setPending(false)
      }
    },
    [dynWallet, wagmiSign],
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

  return {
    signMessage,
    signMessageAsync,
    isPending: isPending || wagmiSign.isPending,
  }
}

export interface SendTransactionParams {
  chainId?: number
  account?: string
  to: `0x${string}`
  value?: bigint
  data?: `0x${string}`
  gas?: bigint
  nonce?: number
  maxFeePerGas?: bigint
  maxPriorityFeePerGas?: bigint
}

export function useSendTransaction() {
  const dynWallet = useDynamicWallet()
  const wagmiSend = useWagmiSendTransaction()
  const [isPending, setPending] = useState(false)

  // Dynamic 的 Legacy signer 会严格检查交易对象的属性名；不要把值为
  // undefined 的 EIP-1559 字段也传进去，否则会被误判为混合交易类型。
  const buildTransaction = (params: SendTransactionParams) => ({
    to: params.to,
    value: params.value ?? 0n,
    //...(params.maxFeePerGas !== undefined || params.maxPriorityFeePerGas !== undefined
    //  ? { type: 'eip1559' as const }
    //  : {}),
    ...(params.data !== undefined ? { data: params.data } : {}),
    ...(params.gas !== undefined ? { gas: params.gas } : {}),
    ...(params.nonce !== undefined ? { nonce: params.nonce } : {}),
    ...(params.maxFeePerGas !== undefined
      ? { maxFeePerGas: params.maxFeePerGas }
      : {}),
    ...(params.maxPriorityFeePerGas !== undefined
      ? { maxPriorityFeePerGas: params.maxPriorityFeePerGas }
      : {}),
  })

  const sendTransactionAsync = useCallback(
    async (params: SendTransactionParams): Promise<`0x${string}`> => {
      if (dynWallet) {
        if (!dynamicConfigured) throw notConfiguredError()
        setPending(true)
        try {
          const chainId = params.chainId ?? currentChainId()
          const publicClient = publicClientFor(chainId)
          const fees = await estimateFeesPerGas(publicClient)
          const gas =
            params.gas ??
            (await estimateGas(publicClient, {
              account: dynWallet.address as `0x${string}`,
              to: params.to,
              value: params.value ?? 0n,
              data: params.data,
            }))
          const transaction = buildTransaction({
            ...params,
            chainId,
            gas,
            maxFeePerGas: params.maxFeePerGas ?? fees.maxFeePerGas,
            maxPriorityFeePerGas:
              params.maxPriorityFeePerGas ?? fees.maxPriorityFeePerGas,
          })
          const walletClient = await dynWallet.getWalletClient(
            String(chainId),
          )
	  console.log(transaction);
          const hash = await walletClient.sendTransaction(transaction as any)
          if (!hash) throw new Error('Transaction was not submitted.')
          return hash
        } finally {
          setPending(false)
        }
      }
      setPending(true)
      try {
        const hash = await wagmiSend.sendTransactionAsync({
          ...buildTransaction(params),
          chainId: params.chainId,
          account: params.account as `0x${string}` | undefined,
        } as any)
        if (!hash) throw new Error('Transaction was not submitted.')
        return hash as `0x${string}`
      } finally {
        setPending(false)
      }
    },
    [dynWallet, wagmiSend],
  )

  const sendTransaction = useCallback(
    (params: SendTransactionParams) => sendTransactionAsync(params),
    [sendTransactionAsync],
  )

  return {
    sendTransaction,
    sendTransactionAsync,
    isPending: isPending || wagmiSend.isPending,
  }
}

export function useSwitchChain() {
  const dynWallet = useDynamicWallet()
  const wagmiSwitch = useWagmiSwitchChain()
  const switchChainAsync = useCallback(
    async ({ chainId }: { chainId: number }) => {
      if (dynWallet) {
        if (!dynamicConfigured) throw notConfiguredError()
        await dynWallet.switchNetwork(chainId)
        return
      }
      await wagmiSwitch.switchChainAsync({ chainId })
    },
    [dynWallet, wagmiSwitch],
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
