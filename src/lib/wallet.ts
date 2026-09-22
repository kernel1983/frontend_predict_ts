export function shortAddress(address: string, size = 4): string {
  if (address.length <= 2 + size * 2) return address
  return `${address.slice(0, 2 + size)}…${address.slice(-size)}`
}

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/

export function isAddressLike(value: unknown): value is string {
  return typeof value === 'string' && ADDRESS_RE.test(value)
}

export function accountColor(address: string): string {
  const hex = address.slice(2, 10)
  const n = Number.parseInt(hex, 16) || 0
  return `hsl(${n % 360} 65% 45%)`
}

export function isUserRejected(error: unknown): boolean {
  const name = (error as { name?: string } | null)?.name ?? ''
  const message = (error as { message?: string } | null)?.message ?? ''
  return (
    name.includes('UserRejectedRequestError') ||
    message.includes('rejected') ||
    message.includes('declined')
  )
}

export function isWalletNotRegistered(error: unknown): boolean {
  const message = (error as { message?: string } | null)?.message ?? ''
  const lower = message.toLowerCase()
  return (
    lower.includes('not registered') ||
    lower.includes('unregistered') ||
    lower.includes('未注册')
  )
}

export function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return 'Something went wrong. Please try again.'
}

export async function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }
  const ta = document.createElement('textarea')
  ta.value = text
  ta.style.position = 'fixed'
  ta.style.opacity = '0'
  document.body.appendChild(ta)
  ta.select()
  try {
    document.execCommand('copy')
  } finally {
    document.body.removeChild(ta)
  }
}