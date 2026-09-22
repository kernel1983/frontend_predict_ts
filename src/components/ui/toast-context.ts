import { createContext, useContext } from 'react'
import type { ToastVariant } from './Toast'

export interface ToastInput {
  title: string
  description?: string
  variant?: ToastVariant
}

export interface ToastContextValue {
  push(input: ToastInput): void
}

export const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>')
  return ctx
}