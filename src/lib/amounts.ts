export const DEFAULT_DECIMALS = 6

export function parseAmount(input: string, decimals: number): bigint | null {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) return null
  const m = input.trim().match(/^(\d+)(?:\.(\d*))?$/)
  if (!m) return null
  const frac = (m[2] ?? '').slice(0, decimals).padEnd(decimals, '0')
  const whole = BigInt(m[1] || '0')
  return whole * 10n ** BigInt(decimals) + (frac ? BigInt(frac) : 0n)
}

export function formatAmount(
  raw: bigint,
  decimals: number,
  fractionDigits = decimals,
): string {
  if (!Number.isInteger(decimals) || decimals < 0) return '0'
  const sign = raw < 0n ? '-' : ''
  const abs = (raw < 0n ? -raw : raw).toString()
  if (decimals === 0) {
    const grouped = abs.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    return sign + grouped
  }
  const padded = abs.padStart(decimals + 1, '0')
  const whole = padded.slice(0, -decimals) || '0'
  let frac = padded.slice(-decimals)
  if (fractionDigits >= decimals) {
    frac = frac.replace(/0+$/, '')
  } else {
    frac = frac.slice(0, Math.max(0, fractionDigits)).replace(/0+$/, '')
  }
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return frac ? `${sign}${grouped}.${frac}` : sign + grouped
}

export function formatAmountInput(
  raw: bigint,
  decimals: number,
  fractionDigits = decimals,
): string {
  return formatAmount(raw, decimals, fractionDigits).replace(/,/g, '')
}
