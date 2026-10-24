import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL ?? '').replace(/\/+$/, '')
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

export const supabase =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : (null as any)

export function supabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)
}

/** Row shape of the public `markets` table (see backend/supabase_schema.sql). */
export interface MarketRow {
  id: string
  slug: string
  token: string
  market_type: string
  title: string | null
  description: string | null
  start_price: number | null
  start_at: string | null
  expires_at: string | null
  interval_seconds: number | null
  end_price: number | null
  outcome: string | null
  onchain_status: string | null
  onchain_tx: string | null
  status: string
  created_at: string
}

/** Read open markets straight from Supabase (RLS exposes the table read-only to `anon`). */
export async function fetchMarkets(): Promise<MarketRow[]> {
  if (!supabaseConfigured()) {
    throw new Error('Supabase 未配置：请设置 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY')
  }

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/markets?select=*&status=eq.open&order=created_at.asc`,
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    },
  )

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`加载 markets 失败 (${res.status})${detail ? `: ${detail}` : ''}`)
  }

  const data: unknown = await res.json()
  if (!Array.isArray(data)) return []
  return data as MarketRow[]
}
