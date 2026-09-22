import { cn } from '@/lib/cn'

interface BrandEntry {
  bg: string
  label: string
}

function pickBrand(name: string): BrandEntry {
  const n = name.toLowerCase()
  if (n.includes('meta')) return { bg: '#f6851b', label: 'M' }
  if (n.includes('coinbase')) return { bg: '#0052ff', label: 'C' }
  if (n.includes('walletconnect')) return { bg: '#3b99fc', label: 'WC' }
  if (n.includes('trust')) return { bg: '#0500ff', label: 'T' }
  if (n.includes('rabby')) return { bg: '#8697ed', label: 'R' }
  if (n.includes('okx')) return { bg: '#4f9cf9', label: 'O' }
  return { bg: '#6b6375', label: 'W' }
}

export function WalletBadge({ name, className }: { name: string; className?: string }) {
  const brand = pickBrand(name)
  return (
    <span
      className={cn('flex size-9 shrink-0 items-center justify-center rounded-xl font-bold text-white', className)}
      style={{ background: brand.bg }}
      aria-hidden="true"
    >
      {brand.label}
    </span>
  )
}