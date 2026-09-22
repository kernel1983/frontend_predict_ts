import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/cn'
import { ToastContext, type ToastInput } from './toast-context'

export type ToastVariant = 'success' | 'error' | 'info'

interface ToastItem extends ToastInput {
  id: number
  variant: ToastVariant
}

const variantIcon: Record<ToastVariant, ReactNode> = {
  success: (
    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500">
      <svg viewBox="0 0 24 24" fill="none" className="size-3.5">
        <path
          d="M5 12l5 5L19 7"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  ),
  error: (
    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-red-500/15 text-red-500">
      <svg viewBox="0 0 24 24" fill="none" className="size-3.5">
        <path
          d="M18 6 L6 18 M6 6 L18 18"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
    </span>
  ),
  info: (
    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-accent-bg text-accent">
      <svg viewBox="0 0 24 24" fill="none" className="size-3.5">
        <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="2" />
        <path
          d="M12 11v5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle cx="12" cy="8.2" r="1.1" fill="currentColor" />
      </svg>
    </span>
  ),
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const idRef = useRef(0)

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const push = useCallback(
    (input: ToastInput) => {
      const id = ++idRef.current
      setItems((prev) => [...prev, { ...input, id, variant: input.variant ?? 'info' }])
      window.setTimeout(() => dismiss(id), 4000)
    },
    [dismiss],
  )

  const value = useMemo(() => ({ push }), [push])

  return (
    <ToastContext.Provider value={value}>
      {children}
      {createPortal(
        <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-full max-w-sm flex-col gap-2 p-2">
          {items.map((item) => (
            <div
              key={item.id}
              role="status"
              className={cn(
                'pointer-events-auto flex items-start gap-3 rounded-xl border border-border bg-bg p-3 shadow-card',
                'animate-[toast-in_0.2s_ease-out]',
              )}
            >
              {variantIcon[item.variant]}
              <div className="flex-1">
                <p className="text-sm font-medium text-text-h">{item.title}</p>
                {item.description && (
                  <p className="mt-0.5 text-xs text-text">{item.description}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismiss(item.id)}
                aria-label="Close"
                className="text-text hover:text-text-h"
              >
                <svg viewBox="0 0 24 24" fill="none" className="size-4">
                  <path
                    d="M6 6 L18 18 M18 6 L6 18"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  )
}