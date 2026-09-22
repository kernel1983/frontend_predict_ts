import { cn } from '@/lib/cn'
import { Spinner } from '@/components/ui/Spinner'
import { WalletBadge } from './walletIcons'

interface WalletOptionItemProps {
  name: string
  pending: boolean
  onClick: () => void
}

export function WalletOptionItem({ name, pending, onClick }: WalletOptionItemProps) {
  return (
    <button
      type="button"
      disabled={pending}
      onClick={onClick}
      className={cn(
        'group flex w-full items-center gap-3 rounded-xl border border-border bg-bg px-4 py-3 text-left transition-colors',
        'hover:border-accent-border hover:bg-accent-bg',
        'disabled:pointer-events-none disabled:opacity-70',
      )}
    >
      <WalletBadge name={name} />
      <span className="flex-1">
        <span className="block font-medium text-text-h">{name}</span>
        <span className="block text-xs text-text">Browser wallet recommended</span>
      </span>
      {pending ? (
        <Spinner className="size-4 text-accent" />
      ) : (
        <span className="font-medium text-accent transition-transform group-hover:translate-x-0.5">
          Connect
        </span>
      )}
    </button>
  )
}