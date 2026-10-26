import { WalletBadge } from './walletIcons'
import { Spinner } from '@/components/ui/Spinner'

interface ConnectWalletButtonProps {
  onClick: () => void
  label?: string
  loading?: boolean
}

export function ConnectWalletButton({
  onClick,
  label = 'Sign in',
  loading = false,
}: ConnectWalletButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="flex w-full items-center justify-center gap-3 rounded-xl bg-accent px-6 py-3.5 font-semibold text-white shadow-lg transition-opacity hover:opacity-90 disabled:opacity-70"
    >
      {loading ? (
        <Spinner className="size-5 text-white" />
      ) : (
        <WalletBadge name="wallet" className="bg-white/15" />
      )}
      {label}
    </button>
  )
}
