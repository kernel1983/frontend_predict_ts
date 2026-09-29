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
  previewMarketOrder,
  type SellUnit,
} from '@/lib/zentra'
import { useChainModeStore } from '@/store/chainMode'
import { cn } from '@/lib/cn'

const BUY_QUICK = ['1', '5', '10']
const SELL_QUICK_USDC = ['0.25', '0.5', '1']
const SELL_QUICK_SHARES = ['25', '50', '100']

const fmt = (raw: string) => formatUsdc(BigInt(raw || '0'), 2)

/** 价格以「分」表示：0.5 → 50¢，缺报价显示 — */
const fmtCents = (n: number | null) => (n === null ? '—' : `${Math.round(n * 100)}¢`)

export function TradePanel({
  slug,
  usdcRaw,
  yesRaw,
  noRaw,
  upAsk,
  downAsk,
  upBid,
  downBid,
  enabled,
  onTraded,
}: {
  slug: string
  usdcRaw: string
  yesRaw: string
  noRaw: string
  upAsk: number | null
  downAsk: number | null
  upBid: number | null
  downBid: number | null
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

  const [tab, setTab] = useState<'buy' | 'sell'>('buy')
  const [sellUnit, setSellUnit] = useState<SellUnit>('usdc')
  const [side, setSide] = useState<'up' | 'down'>('up')
  const [amount, setAmount] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>()

  const { data: receipt } = useWaitForTransactionReceipt({
    hash: txHash,
    confirmations: 1,
  })

  const usdc = BigInt(usdcRaw || '0')
  const holding = BigInt(side === 'up' ? yesRaw || '0' : noRaw || '0')
  const isBuy = tab === 'buy'
  // 买入吃 bestAsk，卖出吃 bestBid
  const sideAsk = side === 'up' ? upAsk : downAsk
  const sideBid = side === 'up' ? upBid : downBid
  const sidePrice = isBuy ? sideAsk : sideBid
  const orderSide = side === 'up' ? 'yes' : 'no'
  const quickAmounts = isBuy
    ? BUY_QUICK
    : sellUnit === 'usdc'
      ? SELL_QUICK_USDC
      : SELL_QUICK_SHARES
  const label = side === 'up' ? 'UP' : 'DOWN'
  const tokenLabel = side === 'up' ? 'YES' : 'NO'

  // 校验 + 预估 + 最终入参同源：预览行展示的就是链上会签的那份
  const preview = previewMarketOrder({
    slug,
    side: orderSide,
    buy: isBuy,
    sellUnit,
    amount,
    bestAsk: sideAsk,
    bestBid: sideBid,
    usdc,
    holding,
    tokenLabel,
  })
  const amountTouched = amount.trim() !== ''
  const liveError = amountTouched ? preview.error : null
  const amountInvalid = amountTouched && preview.args === null

  const handleTrade = async () => {
    setFormError(null)
    if (!address || !configured || !enabled) return
    if (!preview.args) {
      setFormError(preview.error ?? 'Enter a valid amount.')
      return
    }
    try {
      if (currentChainId !== env.withdrawChainId) {
        await switchChainAsync({ chainId: env.withdrawChainId })
      }
      const hash = await sendTransactionAsync({
        chainId: env.withdrawChainId,
        to: ZEN_CONTRACT,
        value: 0n,
        data: buildZenCallData('predict_market_order', preview.args),
      })
      setTxHash(hash)
      setAmount('')
      toast.push({
        title: `${isBuy ? 'Buy' : 'Sell'} ${label} order submitted`,
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

  const handleMax = () => {
    if (isBuy) {
      setAmount(formatUsdc(usdc, 2))
    } else if (sellUnit === 'usdc') {
      setAmount(preview.maxUsdc === null ? '' : formatUsdc(preview.maxUsdc, 2))
    } else {
      setAmount(formatUsdc(holding, 2))
    }
    setFormError(null)
  }

  const switchTab = (next: 'buy' | 'sell') => {
    if (next === tab) return
    setTab(next)
    setAmount('')
    setFormError(null)
  }

  const active = enabled && Boolean(address)

  return (
    <section className="rounded-2xl border border-border bg-bg p-5 shadow-card">
      <h2 className="text-base font-semibold text-text-h">Trade</h2>

      <div className="mt-3 flex items-center gap-4 border-b border-border">
        {(['buy', 'sell'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => switchTab(t)}
            className={cn(
              '-mb-px border-b-2 pb-1.5 text-xs font-semibold uppercase tracking-wide transition-colors',
              tab === t
                ? t === 'buy'
                  ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                  : 'border-red-500 text-red-600 dark:text-red-400'
                : 'border-transparent text-text hover:text-text-h',
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setSide('up')}
          className={cn(
            'flex h-11 items-center justify-center gap-1.5 rounded-xl border px-2 text-sm font-semibold transition-colors',
            side === 'up'
              ? 'border-emerald-500 bg-emerald-500 text-white'
              : 'border-border bg-bg text-text-h hover:border-emerald-500/50',
          )}
        >
          <span>↑ UP</span>
          <span
            className={cn(
              'font-mono text-xs font-medium',
              side === 'up' ? 'text-white/80' : 'text-text',
            )}
          >
            {fmtCents(isBuy ? upAsk : upBid)}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setSide('down')}
          className={cn(
            'flex h-11 items-center justify-center gap-1.5 rounded-xl border px-2 text-sm font-semibold transition-colors',
            side === 'down'
              ? 'border-red-500 bg-red-500 text-white'
              : 'border-border bg-bg text-text-h hover:border-red-500/50',
          )}
        >
          <span>↓ DOWN</span>
          <span
            className={cn(
              'font-mono text-xs font-medium',
              side === 'down' ? 'text-white/80' : 'text-text',
            )}
          >
            {fmtCents(isBuy ? downAsk : downBid)}
          </span>
        </button>
      </div>

      <p className="mt-2 text-center text-[11px] text-text">
        {isBuy ? 'Best ask' : 'Best bid'}
        {sidePrice === null ? ' — no orders' : ''}
      </p>

      <div className="mt-3">
        <div className="flex items-center justify-between">
          <label className="text-xs text-text" htmlFor="trade-amount">
            {isBuy
              ? 'Amount (USDC)'
              : sellUnit === 'usdc'
                ? 'Amount (USDC to receive)'
                : `Shares (${tokenLabel})`}
          </label>
          <span className="text-xs text-text">
            {isBuy ? 'Balance' : 'Available'}{' '}
            <span className="font-mono text-text-h">
              {isBuy
                ? usdcRaw
                  ? fmt(usdcRaw)
                  : '0.00'
                : formatUsdc(holding, 2)}
            </span>
          </span>
        </div>
        {!isBuy && (
          <div className="mt-1.5 flex gap-1 rounded-lg border border-border bg-bg p-0.5">
            {(['usdc', 'shares'] as const).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => {
                  setSellUnit(u)
                  setAmount('')
                  setFormError(null)
                }}
                className={cn(
                  'flex-1 rounded-md px-2 py-1 text-xs font-semibold transition-colors',
                  sellUnit === u
                    ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                    : 'text-text hover:text-text-h',
                )}
              >
                {u === 'usdc' ? 'By USDC' : 'By shares'}
              </button>
            ))}
          </div>
        )}
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
          {quickAmounts.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => handleQuick(q)}
              disabled={!enabled}
              className="flex-1 rounded-lg border border-border bg-bg py-1.5 text-sm text-text-h transition-colors hover:border-accent-border disabled:opacity-40"
            >
              {!isBuy && sellUnit === 'shares' ? q : `$${q}`}
            </button>
          ))}
          <button
            type="button"
            onClick={handleMax}
            disabled={!enabled}
            className="flex-1 rounded-lg border border-border bg-bg py-1.5 text-sm text-text-h transition-colors hover:border-accent-border disabled:opacity-40"
          >
            Max
          </button>
        </div>
        {amountTouched && (
          <p
            className={cn(
              'mt-2 text-center text-[11px]',
              liveError ? 'text-red-500' : 'text-text',
            )}
          >
            {liveError ??
              (isBuy
                ? `Spend ${preview.estUsdc} USDC ≈ ${preview.estShares} ${tokenLabel}`
                : `Receive ≈ ${preview.estUsdc} USDC (${preview.estShares} ${tokenLabel})`)}
          </p>
        )}
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
        disabled={!configured || !active || !!receipt || amountInvalid}
        onClick={() => {
          void handleTrade()
        }}
      >
        {receipt
          ? 'Order placed'
          : submitting
            ? 'Confirming…'
            : `${isBuy ? 'Buy' : 'Sell'} ${label}${sidePrice !== null ? ` ${fmtCents(sidePrice)}` : ''}`}
      </Button>

      <p className="mt-3 break-all text-center font-mono text-[10px] leading-relaxed text-text">
        predict_market_order{' '}
        <span className={cn(amountInvalid && 'text-red-500')}>
          {JSON.stringify(preview.args ?? [slug, null, orderSide, '—'])}
        </span>
      </p>

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