import { useAccount } from 'wagmi'
import { AppLayout } from '@/components/layout/AppLayout'
import { Avatar } from '@/components/wallet/Avatar'
import { DepositRow } from '@/components/wallet/DepositRow'
import { useToast } from '@/components/ui/toast-context'
import { useSession } from '@/hooks/useSession'
import { depositFactories, getPredictedDepositAddress } from '@/lib/deposit'
import { copyToClipboard, isAddressLike, shortAddress } from '@/lib/wallet'

export default function HomePage() {
  const { user } = useSession()
  const { address, chain } = useAccount()
  const toast = useToast()

  const deposits = user?.deposits ?? {}

  const predicted = address
    ? depositFactories.map((config) => ({
        config,
        predicted: getPredictedDepositAddress(config.chainId, address),
      }))
    : []

  const handleCopy = async (text: string) => {
    try {
      await copyToClipboard(text)
      toast.push({ title: 'Address copied', variant: 'success' })
    } catch {
      toast.push({ title: 'Copy failed', variant: 'error' })
    }
  }

  return (
    <AppLayout>
      <h1 className="text-2xl font-semibold text-text-h">Account Overview</h1>
      <p className="mt-1 text-sm text-text">
        Your wallet identity and per-chain deposit addresses.
      </p>

      <section className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-border bg-bg p-5 shadow-card">
          <p className="text-xs text-text">Wallet User ID</p>
          <div className="mt-2 flex items-center gap-2">
            <p className="font-mono text-base text-text-h">
              {user?.user_key ?? '—'}
            </p>
            {address && <Avatar address={address} size={24} />}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-bg p-5 shadow-card">
          <p className="text-xs text-text">Connected Wallet</p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="truncate font-mono text-base text-text-h">
              {address ?? 'Not connected'}
            </p>
            {address && (
              <button
                type="button"
                onClick={() => {
                  void handleCopy(address)
                }}
                className="shrink-0 text-xs text-accent hover:underline"
              >
                {shortAddress(address)}
              </button>
            )}
          </div>
          {chain?.name && (
            <p className="mt-2 text-xs text-text">Network: {chain.name}</p>
          )}
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-border bg-bg p-5 shadow-card">
        <h2 className="text-base font-semibold text-text-h">Deposit Addresses (Predicted)</h2>
        <p className="mt-1 text-xs text-text">
          Each network's deposit address is computed from a factory contract
          via CREATE2. Scan the QR code with your wallet to send funds.
        </p>
        {predicted.length === 0 ? (
          <p className="mt-3 text-sm text-text">
            {address === null
              ? 'Connect a wallet to compute your deposit addresses.'
              : 'No networks have been configured yet.'}
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {predicted.map(({ config, predicted: item }) =>
              item ? (
                <DepositRow
                  key={config.chainId}
                  chainLabel={config.chainName}
                  value={item.address}
                  qrDefault
                />
              ) : null,
            )}
          </ul>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-border bg-bg p-5 shadow-card">
        <h2 className="text-base font-semibold text-text-h">Per-Chain Deposit Addresses</h2>
        {Object.keys(deposits).length === 0 ? (
          <p className="mt-3 text-sm text-text">
            No deposit addresses yet. They will appear once activated.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {Object.entries(deposits).map(([key, value]) => (
              <DepositRow
                key={key}
                chainLabel={key}
                value={typeof value === 'string' ? value : null}
                canQr={isAddressLike(value)}
              />
            ))}
          </ul>
        )}
      </section>
    </AppLayout>
  )
}