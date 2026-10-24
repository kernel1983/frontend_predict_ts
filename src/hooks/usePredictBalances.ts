import { useQuery } from '@tanstack/react-query'
import { fetchRawState } from '@/lib/zentra'
import type { QuoteToken } from '@/lib/market'

export interface PredictBalances {
  quoteRaw: string
  yesRaw: string
  noRaw: string
  loading: boolean
}

/** 轮询 UpDown 三份余额：报价币 / YES / NO（indexer 原始字符串） */
export function usePredictBalances(
  address: string | undefined,
  slug: string,
  enabled: boolean,
  refreshKey: number,
  quoteToken: QuoteToken = 'USDC',
): PredictBalances {
  const addr = address?.toLowerCase() ?? ''
  const fetchOne = (prefix: string) => (addr ? fetchRawState(prefix) : '0')

  const quote = useQuery({
    queryKey: ['predict-balances', 'quote', quoteToken, addr, refreshKey],
    queryFn: () => fetchOne(`base-${quoteToken}-balance:${addr}`),
    enabled: Boolean(addr) && enabled,
    refetchInterval: 5_000,
  })
  const yes = useQuery({
    queryKey: ['predict-balances', 'yes', addr, slug, refreshKey],
    queryFn: () => fetchOne(`base-predict-${slug}_yes_balance:${addr}`),
    enabled: Boolean(addr) && enabled,
    refetchInterval: 5_000,
  })
  const no = useQuery({
    queryKey: ['predict-balances', 'no', addr, slug, refreshKey],
    queryFn: () => fetchOne(`base-predict-${slug}_no_balance:${addr}`),
    enabled: Boolean(addr) && enabled,
    refetchInterval: 5_000,
  })

  return {
    quoteRaw: quote.data ?? '0',
    yesRaw: yes.data ?? '0',
    noRaw: no.data ?? '0',
    loading:
      Boolean(addr) &&
      enabled &&
      (quote.isLoading || yes.isLoading || no.isLoading),
  }
}