import { useState } from 'react'
import { useConnect, useConnectors } from 'wagmi'
import { Modal } from '@/components/ui/Modal'
import { isUserRejected, toErrorMessage } from '@/lib/wallet'
import { NoWalletGuide } from './NoWalletGuide'
import { WalletOptionItem } from './WalletOptionItem'

interface WalletModalProps {
  open: boolean
  onClose: () => void
  onConnected: () => void
}

export function WalletModal({ open, onClose, onConnected }: WalletModalProps) {
  const connectors = useConnectors()
  const { mutateAsync: connectAsync } = useConnect()
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [prevOpen, setPrevOpen] = useState(open)
  if (prevOpen !== open) {
    setPrevOpen(open)
    if (open) {
      setPendingId(null)
      setError(null)
    }
  }

  const handleConnect = async (connector: (typeof connectors)[number]) => {
    setError(null)
    setPendingId(connector.id)
    try {
      await connectAsync({ connector })
      onConnected()
      onClose()
    } catch (err) {
      setError(
        isUserRejected(err) ? 'Connection cancelled' : toErrorMessage(err),
      )
    } finally {
      setPendingId(null)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Connect Wallet">
      {connectors.length === 0 ? (
        <NoWalletGuide />
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-text">
            Choose a wallet to connect. Signing in creates no on-chain
            transactions.
          </p>
          {connectors.map((connector) => (
            <WalletOptionItem
              key={connector.id}
              name={connector.name}
              pending={pendingId === connector.id}
              onClick={() => {
                void handleConnect(connector)
              }}
            />
          ))}
          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-500">
              <span className="flex-1">{error}</span>
              <button
                type="button"
                className="font-medium hover:underline"
                onClick={() => setError(null)}
              >
                Retry
              </button>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}