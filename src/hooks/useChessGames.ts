import { useQuery } from '@tanstack/react-query'
import { fetchChessGames, supabaseConfigured, type ChessGameStatus } from '@/lib/supabase'

/** Chess games straight from Supabase, filtered by status (`chess_active` / `chess_waiting_for_opponent`). */
export function useChessGames(status: ChessGameStatus = 'chess_active') {
  return useQuery({
    queryKey: ['chess_games', status],
    queryFn: () => fetchChessGames(status),
    enabled: supabaseConfigured(),
    staleTime: 10_000,
    refetchInterval: 15_000,
  })
}
