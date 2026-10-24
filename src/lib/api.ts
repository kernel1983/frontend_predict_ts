import type {
  WalletChallenge,
  WalletMe,
  WalletVerifyBody,
  WalletVerifyResponse,
} from '@/types/api'

export class ApiError extends Error {
  status: number
  body?: unknown

  constructor(status: number, message: string, body?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

const DEFAULT_API_BASE = 'http://127.0.0.1:5000'

/**
 * Keep the API on the same host as the page (port 5000) so the Flask session
 * cookie stays same-site regardless of whether the page is opened via
 * localhost or 127.0.0.1.
 */
function defaultApiBase(): string {
  if (typeof window !== 'undefined' && window.location.hostname) {
    return `${window.location.protocol}//${window.location.hostname}:5000`
  }
  return DEFAULT_API_BASE
}

/** Absolute origin of the backend API; override with VITE_API_BASE for other hosts. */
export function apiBase(): string {
  const override = import.meta.env.VITE_API_BASE
  const base = typeof override === 'string' && override !== '' ? override : defaultApiBase()
  return base.replace(/\/+$/, '')
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${apiBase()}/api${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })

  const text = await res.text()
  let data: unknown = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }
  }

  if (!res.ok) {
    const raw = data as Record<string, unknown> | string | null
    let message = `Request failed (${res.status})`
    if (typeof raw === 'string') message = raw
    else if (raw && typeof raw === 'object') {
      const candidate = raw.error ?? raw.message ?? raw.detail
      if (typeof candidate === 'string') message = candidate
    }
    throw new ApiError(res.status, message, data)
  }

  return data as T
}

export const api = {
  /** GET /api/auth/wallet/challenge */
  walletChallenge(address: string): Promise<WalletChallenge> {
    return request(`/auth/wallet/challenge?address=${encodeURIComponent(address)}`)
  },

  /** POST /api/auth/wallet/verify */
  walletVerify(body: WalletVerifyBody): Promise<WalletVerifyResponse> {
    return request('/auth/wallet/verify', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  },

  /** GET /api/auth/wallet/me（未登录返回 401） */
  walletMe(): Promise<WalletMe> {
    return request('/auth/wallet/me')
  },

  /** POST /api/auth/logout */
  logout(): Promise<unknown> {
    return request('/auth/logout', { method: 'POST' })
  },
}