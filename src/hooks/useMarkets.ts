import { useQuery } from '@tanstack/react-query'
import { fetchMarkets, supabaseConfigured } from '@/lib/supabase'

/** Open markets straight from Supabase (`markets` is RLS read-only for `anon`). */
export function useMarkets() {
  return useQuery({
    queryKey: ['markets', 'open'],
    queryFn: fetchMarkets,
    enabled: supabaseConfigured(),
    staleTime: 30_000,
  })
}
