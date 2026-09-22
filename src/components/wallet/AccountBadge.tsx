import { cn } from '@/lib/cn'
import { shortAddress } from '@/lib/wallet'
import { Avatar } from './Avatar'

export function AccountBadge({
  address,
  className,
}: {
  address: string
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full border border-border bg-bg py-1.5 pl-1.5 pr-3',
        className,
      )}
    >
      <Avatar address={address} size={22} />
      <span className="font-mono text-sm text-text-h">{shortAddress(address)}</span>
    </span>
  )
}