import { QRCodeSVG } from 'qrcode.react'

interface QrCodeProps {
  value: string
  size?: number
}

export function QrCode({ value, size = 176 }: QrCodeProps) {
  return (
    <span
      className="inline-flex shrink-0 rounded-xl bg-white p-3 shadow-sm"
      aria-label="QR code"
    >
      <QRCodeSVG value={value} size={size} level="M" bgColor="#ffffff" fgColor="#000000" />
    </span>
  )
}