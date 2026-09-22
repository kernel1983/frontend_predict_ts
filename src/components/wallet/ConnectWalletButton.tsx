import { WalletBadge } from './walletIcons'

interface ConnectWalletButtonProps {
  onClick: () => void
  label?: string
}

export function ConnectWalletButton({
  onClick,
  label = 'Connect Wallet',
}: ConnectWalletButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-center gap-3 rounded-xl bg-accent px-6 py-3.5 font-semibold text-white shadow-lg transition-opacity hover:opacity-90"
    >
      <WalletBadge name="wallet" className="bg-white/15" />
      {label}
    </button>
  )
}