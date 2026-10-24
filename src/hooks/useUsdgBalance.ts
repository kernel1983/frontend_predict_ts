import { useQuery } from '@tanstack/react-query'
import { type Address } from 'viem'
import { ZENTRA_ENVS, fetchUsdgBalance, isEnvConfigured } from '@/lib/zentra'
import { useChainModeStore } from '@/store/chainMode'

export function useUsdgBalance(address?: Address | null) {
  const mode = useChainModeStore((s) => s.mode)
  const env = ZENTRA_ENVS[mode]
  return useQuery({
    queryKey: ['usdg-balance', mode, address?.toLowerCase() ?? ''],
    queryFn: () => (address ? fetchUsdgBalance(address) : Promise.resolve(0n)),
    enabled: Boolean(address) && isEnvConfigured(env),
    refetchInterval: 15_000,
    staleTime: 5_000,
  })
}
