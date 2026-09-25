export function formatLocal(date: Date): string {
  const p = (n: number, w = 2) => String(n).padStart(w, '0')
  const tz = -date.getTimezoneOffset()
  const sign = tz >= 0 ? '+' : '-'
  const abs = Math.abs(tz)
  const tzName = `UTC${sign}${p(Math.floor(abs / 60))}:${p(abs % 60)}`
  return (
    `${p(date.getMonth() + 1)}/${p(date.getDate())}/${date.getFullYear()} ` +
    `${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())} (${tzName})`
  )
}

export function formatRange(startSec: number, endSec: number): string {
  return `${formatLocal(new Date(startSec * 1000))} → ${formatLocal(new Date(endSec * 1000))}`
}