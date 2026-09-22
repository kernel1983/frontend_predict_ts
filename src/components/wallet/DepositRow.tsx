import { useState } from 'react'
import { cn } from '@/lib/cn'
import { useToast } from '@/components/ui/toast-context'
import { QrCode } from '@/components/ui/QrCode'
import { copyToClipboard, isAddressLike, shortAddress } from '@/lib/wallet'

interface DepositRowProps {
  chainLabel: string
  /** 地址文本；为 null 时显示“待配置” */
  value: string | null
  /** 是否为合法地址，可生成二维码 */
  canQr?: boolean
  /** 默认展开二维码 */
  qrDefault?: boolean
}

export function DepositRow({
  chainLabel,
  value,
  canQr = true,
  qrDefault = false,
}: DepositRowProps) {
  const toast = useToast()
  const [showQr, setShowQr] = useState(qrDefault)

  const qrReady = canQr && value !== null && isAddressLike(value)

  const handleCopy = async () => {
    if (!value) return
    try {
      await copyToClipboard(value)
      toast.push({ title: 'Address copied', variant: 'success' })
    } catch {
      toast.push({ title: 'Copy failed', variant: 'error' })
    }
  }

  return (
    <li className="py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-text-h">{chainLabel}</span>
        <span className="flex min-w-0 items-center gap-2">
          {value ? (
            <>
              <code className="truncate text-sm text-text">{value}</code>
              <button
                type="button"
                onClick={() => {
                  void handleCopy()
                }}
                className="shrink-0 text-xs text-accent hover:underline"
              >
                {shortAddress(value)}
              </button>
              {qrReady && (
                <button
                  type="button"
                  onClick={() => setShowQr((v) => !v)}
                  className={cn(
                    'shrink-0 rounded-lg border px-2 py-1 text-xs transition-colors',
                    showQr
                      ? 'border-accent-border bg-accent-bg text-accent'
                      : 'border-border text-text hover:border-accent-border hover:text-text-h',
                  )}
                >
QR code
                  </button>
              )}
            </>
          ) : (
            <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs text-text">
              Not configured
            </span>
          )}
        </span>
      </div>

      {qrReady && showQr && (
        <div className="mt-3 flex items-start gap-4 rounded-xl border border-border bg-bg p-4">
          <QrCode value={value} size={176} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-text-h">Scan to deposit</p>
            <p className="mt-1 break-all font-mono text-xs text-text">{value}</p>
            <p className="mt-3 text-xs text-text">
              Scan the QR code with your wallet app to send funds to this
              deposit address.
            </p>
          </div>
        </div>
      )}
    </li>
  )
}