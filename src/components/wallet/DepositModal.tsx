import { DepositRow } from '@/components/wallet/DepositRow'
import { Modal } from '@/components/ui/Modal'
import { isAddressLike } from '@/lib/wallet'
import type { DepositFactoryConfig } from '@/lib/deposit'

interface PredictedDeposit {
  config: DepositFactoryConfig
  address: string | null
}

interface DepositModalProps {
  open: boolean
  onClose: () => void
  predicted: PredictedDeposit[]
  deposits: Record<string, unknown>
  walletConnected: boolean
  mainnet: boolean
}

export function DepositModal({
  open,
  onClose,
  predicted,
  deposits,
  walletConnected,
  mainnet,
}: DepositModalProps) {
  const hasActivatedDeposits = Object.keys(deposits).length > 0

  return (
    <Modal open={open} onClose={onClose} title="Deposit">
      <p className="text-sm text-text">
        Choose a network, then copy its address or scan its QR code to deposit
        funds.
      </p>

      <section className="mt-5">
        <h3 className="text-sm font-semibold text-text-h">Deposit addresses</h3>
        {predicted.length === 0 ? (
          <p className="mt-2 text-sm text-text">
            {!walletConnected
              ? 'Connect a wallet to compute your deposit addresses.'
              : mainnet
                ? 'Mainnet deposit networks are not configured yet.'
                : 'No networks have been configured yet.'}
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-border">
            {predicted.map(({ config, address }) =>
              address ? (
                <DepositRow
                  key={config.chainId}
                  chainLabel={config.chainName}
                  value={address}
                  qrDefault
                />
              ) : null,
            )}
          </ul>
        )}
      </section>

      {hasActivatedDeposits && (
        <section className="mt-5 border-t border-border pt-5">
          <h3 className="text-sm font-semibold text-text-h">
            Activated deposit addresses
          </h3>
          <ul className="mt-2 divide-y divide-border">
            {Object.entries(deposits).map(([key, value]) => (
              <DepositRow
                key={key}
                chainLabel={key}
                value={typeof value === 'string' ? value : null}
                canQr={isAddressLike(value)}
              />
            ))}
          </ul>
        </section>
      )}
    </Modal>
  )
}
