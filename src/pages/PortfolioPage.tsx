import { useState } from 'react'
import { useAccount } from 'wagmi'
import { AppLayout } from '@/components/layout/AppLayout'
import { DepositModal } from '@/components/wallet/DepositModal'
import { MintCard } from '@/components/wallet/MintCard'
import { WithdrawCard } from '@/components/wallet/WithdrawCard'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { useUsdcBalance } from '@/hooks/useUsdcBalance'
import { useSession } from '@/hooks/useSession'
import {
  computeDepositAddress,
  depositFactoriesByMode,
  type DepositFactoryConfig,
} from '@/lib/deposit'
import { formatUsdc } from '@/lib/zentra'
import { useChainModeStore } from '@/store/chainMode'

export default function PortfolioPage() {
  const { address } = useAccount()
  const { user } = useSession()
  const { mode } = useChainModeStore()
  const { data: balance, isLoading, error, refetch } = useUsdcBalance(address)
  const [depositOpen, setDepositOpen] = useState(false)
  const [withdrawOpen, setWithdrawOpen] = useState(false)

  const factories: DepositFactoryConfig[] = depositFactoriesByMode[mode]
  const predicted = address
    ? factories.map((config) => ({
        config,
        address: computeDepositAddress(config.factory, address, config.initCode),
      }))
    : []

  return (
    <AppLayout>
      <h1 className="text-2xl font-semibold text-text-h">Portfolio</h1>
      <p className="mt-1 text-sm text-text">Your available account balance.</p>

      <section className="mt-6 grid gap-5 lg:max-w-4xl lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-bg p-5 shadow-card">
          <p className="text-sm text-text">Available</p>
          <p className="mt-2 font-mono text-3xl font-semibold text-text-h">
            {isLoading ? '…' : error ? '—' : `${formatUsdc(balance ?? 0n, 2)} USDC`}
          </p>
          {error && (
            <p className="mt-2 text-sm text-red-500">
              Unable to load your balance right now.
            </p>
          )}
          <div className="mt-5 flex flex-wrap gap-3">
            <Button onClick={() => setDepositOpen(true)}>Deposit</Button>
            <Button variant="secondary" onClick={() => setWithdrawOpen(true)}>
              Withdraw
            </Button>
          </div>
        </div>

        {mode === 'testnet' && (
          <MintCard
            address={address}
            onMinted={() => {
              void refetch()
            }}
          />
        )}
      </section>

      <DepositModal
        open={depositOpen}
        onClose={() => setDepositOpen(false)}
        predicted={predicted}
        deposits={user?.deposits ?? {}}
        walletConnected={Boolean(address)}
        mainnet={mode === 'mainnet'}
      />

      <Modal
        open={withdrawOpen}
        onClose={() => setWithdrawOpen(false)}
        title="Withdraw"
      >
        <WithdrawCard address={address} />
      </Modal>
    </AppLayout>
  )
}
