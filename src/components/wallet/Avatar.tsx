import { accountColor } from '@/lib/wallet'

export function Avatar({ address, size = 28 }: { address: string; size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold text-white"
      style={{
        width: size,
        height: size,
        background: accountColor(address),
        fontSize: Math.round(size * 0.38),
      }}
      aria-hidden="true"
    >
      {address.slice(2, 4).toUpperCase()}
    </span>
  )
}