import { useQuery } from '@tanstack/react-query'
import { fetchAssetCtxs } from '@/lib/hyperliquid'

/** Latest mid price + 24h change for every Hyperliquid perp. */
export function useAssetCtxs() {
  return useQuery({
    queryKey: ['hyperliquid', 'asset-ctxs'],
    queryFn: fetchAssetCtxs,
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: false,
  })
}
