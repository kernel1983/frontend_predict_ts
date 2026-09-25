import { useQuery } from '@tanstack/react-query'
import { fetchRawState } from '@/lib/zentra'

export interface PredictBalances {
  usdcRaw: string
  yesRaw: string
  noRaw: string
  loading: boolean
}

/** 轮询 UpDown 三份余额：USDC / YES / NO（indexer 原始字符串） */
export function usePredictBalances(
  address: string | undefined,
  slug: string,
  enabled: boolean,
  refreshKey: number,
): PredictBalances {
  const addr = address?.toLowerCase() ?? ''
  const fetchOne = (prefix: string) => (addr ? fetchRawState(prefix) : '0')

  const usdc = useQuery({
    queryKey: ['predict-balances', 'usdc', addr, refreshKey],
    queryFn: () => fetchOne(`base-USDC-balance:${addr}`),
    enabled: Boolean(addr) && enabled,
    refetchInterval: 5_000,
  })
  const yes = useQuery({
    queryKey: ['predict-balances', 'yes', addr, slug, refreshKey],
    queryFn: () => fetchOne(`predict-${slug}_yes_balance:${addr}`),
    enabled: Boolean(addr) && enabled,
    refetchInterval: 5_000,
  })
  const no = useQuery({
    queryKey: ['predict-balances', 'no', addr, slug, refreshKey],
    queryFn: () => fetchOne(`predict-${slug}_no_balance:${addr}`),
    enabled: Boolean(addr) && enabled,
    refetchInterval: 5_000,
  })

  return {
    usdcRaw: usdc.data ?? '0',
    yesRaw: yes.data ?? '0',
    noRaw: no.data ?? '0',
    loading: Boolean(addr) && enabled && (usdc.isLoading || yes.isLoading || no.isLoading),
  }
}