import { useState } from 'react'
import {
  useAccount,
  useChainId,
  useSendTransaction,
  useSwitchChain,
  useWaitForTransactionReceipt,
} from 'wagmi'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/toast-context'
import { isUserRejected, toErrorMessage } from '@/lib/wallet'
import {
  ZEN_CONTRACT,
  ZENTRA_ENVS,
  buildZenCallData,
  formatUsdc,
  isEnvConfigured,
  parseUsdcAmount,
} from '@/lib/zentra'
import { useChainModeStore } from '@/store/chainMode'
import { cn } from '@/lib/cn'

const QUICK_AMOUNTS = ['1', '5', '10']

const fmt = (raw: string) => formatUsdc(BigInt(raw || '0'), 2)

export function TradePanel({
  slug,
  usdcRaw,
  yesRaw,
  noRaw,
  enabled,
  onTraded,
}: {
  slug: string
  usdcRaw: string
  yesRaw: string
  noRaw: string
  enabled: boolean
  onTraded: () => void
}) {
  const mode = useChainModeStore((s) => s.mode)
  const env = ZENTRA_ENVS[mode]
  const configured = isEnvConfigured(env)
  const toast = useToast()

  const { address } = useAccount()
  const { sendTransactionAsync, isPending: submitting } = useSendTransaction()
  const { switchChainAsync } = useSwitchChain()
  const currentChainId = useChainId()

  const [side, setSide] = useState<'up' | 'down'>('up')
  const [amount, setAmount] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>()

  const { data: receipt } = useWaitForTransactionReceipt({
    hash: txHash,
    confirmations: 1,
  })

  const usdc = BigInt(usdcRaw || '0')

  const handleTrade = async () => {
    setFormError(null)
    if (!address || !configured || !enabled) return
    const raw = parseUsdcAmount(amount)
    if (raw === null || raw <= 0n) {
      setFormError('Enter a valid amount.')
      return
    }
    if (raw > usdc) {
      setFormError('Amount exceeds your available USDC balance.')
      return
    }
    const orderSide = side === 'up' ? 'yes' : 'no'
    try {
      if (currentChainId !== env.withdrawChainId) {
        await switchChainAsync({ chainId: env.withdrawChainId })
      }
      const hash = await sendTransactionAsync({
        chainId: env.withdrawChainId,
        to: ZEN_CONTRACT,
        value: 0n,
        data: buildZenCallData('predict_market_order', [slug, null, orderSide, `-${raw}`]),
      })
      setTxHash(hash)
      setAmount('')
      toast.push({
        title: side === 'up' ? 'YES order submitted' : 'NO order submitted',
        variant: 'success',
      })
    } catch (err) {
      if (!isUserRejected(err)) {
        setFormError(toErrorMessage(err))
      }
    }
  }

  const handleQuick = (v: string) => {
    setAmount(String(Number(v).toFixed(2)))
    setFormError(null)
  }

  const active = enabled && Boolean(address)

  return (
    <section className="rounded-2xl border border-border bg-bg p-5 shadow-card">
      <h2 className="text-base font-semibold text-text-h">Trade</h2>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setSide('up')}
          className={cn(
            'h-11 rounded-xl border text-sm font-semibold transition-colors',
            side === 'up'
              ? 'border-emerald-500 bg-emerald-500 text-white'
              : 'border-border bg-bg text-text-h hover:border-emerald-500/50',
          )}
        >
          ↑ UP
        </button>
        <button
          type="button"
          onClick={() => setSide('down')}
          className={cn(
            'h-11 rounded-xl border text-sm font-semibold transition-colors',
            side === 'down'
              ? 'border-red-500 bg-red-500 text-white'
              : 'border-border bg-bg text-text-h hover:border-red-500/50',
          )}
        >
          ↓ DOWN
        </button>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between">
          <label className="text-xs text-text" htmlFor="trade-amount">
            Amount (USDC)
          </label>
          <span className="text-xs text-text">
            Balance{' '}
            <span className="font-mono text-text-h">{usdcRaw ? fmt(usdcRaw) : '0.00'}</span>
          </span>
        </div>
        <input
          id="trade-amount"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0.0"
          value={amount}
          disabled={submitting || !!receipt || !configured || !enabled}
          onChange={(e) => {
            setAmount(e.target.value)
            setFormError(null)
          }}
          className="mt-1.5 h-11 w-full rounded-xl border border-border bg-bg px-3 font-mono text-sm text-text-h outline-none transition-colors focus:border-accent-border disabled:opacity-60"
        />
        <div className="mt-2 flex gap-2">
          {QUICK_AMOUNTS.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => handleQuick(q)}
              disabled={!enabled}
              className="flex-1 rounded-lg border border-border bg-bg py-1.5 text-sm text-text-h transition-colors hover:border-accent-border disabled:opacity-40"
            >
              ${q}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl border border-border bg-bg p-3 text-center">
        <div>
          <p className="text-xs text-text">Your YES</p>
          <p className="font-mono text-sm text-emerald-600 dark:text-emerald-400">
            {yesRaw ? fmt(yesRaw) : '0.00'}
          </p>
        </div>
        <div>
          <p className="text-xs text-text">Your NO</p>
          <p className="font-mono text-sm text-red-600 dark:text-red-400">
            {noRaw ? fmt(noRaw) : '0.00'}
          </p>
        </div>
      </div>

      {!configured && (
        <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
          {env.withdrawChainName} is not configured yet. The production indexer
          details are pending.
        </div>
      )}
      {!enabled && configured && (
        <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
          Trading is paused while viewing past rounds. Go to the current round
          to place orders.
        </div>
      )}
      {!address && configured && (
        <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
          Connect a wallet to trade.
        </div>
      )}

      {formError && (
        <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-500">
          {formError}
        </div>
      )}

      {txHash && !receipt && (
        <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
          Transaction submitted:{' '}
          <a
            href={`${env.explorerBase}/tx/${txHash}`}
            target="_blank"
            rel="noreferrer"
            className="font-mono underline"
          >
            {txHash.slice(0, 12)}…
          </a>{' '}
          Waiting for confirmation…
        </div>
      )}
      {receipt && (
        <div className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-600 dark:text-emerald-400">
          Order confirmed.{' '}
          <a
            href={`${env.explorerBase}/tx/${txHash}`}
            target="_blank"
            rel="noreferrer"
            className="font-mono underline"
          >
            {txHash?.slice(0, 12)}…
          </a>
        </div>
      )}

      <Button
        size="lg"
        className={cn(
          'mt-4 w-full',
          side === 'down' && '!bg-red-500 !hover:bg-red-500/90',
        )}
        loading={submitting}
        disabled={!configured || !active || !!receipt}
        onClick={() => {
          void handleTrade()
        }}
      >
        {receipt
          ? 'Order placed'
          : submitting
            ? 'Confirming…'
            : `Buy ${side === 'up' ? 'UP' : 'DOWN'}`}
      </Button>

      {receipt && (
        <button
          type="button"
          onClick={() => {
            setTxHash(undefined)
            onTraded()
            window.setTimeout(onTraded, 10_000)
          }}
          className="mt-3 block w-full text-center text-sm text-accent hover:underline"
        >
          Trade again / refresh holdings
        </button>
      )}
    </section>
  )
}