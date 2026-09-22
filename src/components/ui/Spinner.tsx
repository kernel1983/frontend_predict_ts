import type { SVGProps } from 'react'
import { cn } from '@/lib/cn'

export function Spinner({ className, ...rest }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={cn('size-5 animate-spin', className)}
      role="status"
      aria-hidden="true"
      {...rest}
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
        className="opacity-25"
      />
      <path
        fill="currentColor"
        d="M4 12a8 8 0 0 1 8-8v3a5 5 0 0 0-5 5H4z"
        className="opacity-80"
      />
    </svg>
  )
}