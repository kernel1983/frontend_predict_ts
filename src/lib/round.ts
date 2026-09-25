import { UPDOWN_INTERVAL_SECONDS, type UpdownInterval } from '@/lib/market'

export type RoundState = 'active' | 'settling' | 'resolved'

export interface RoundInfo {
  id: number
  start: number
  end: number
  remaining: number
  progress: number
  state: RoundState
  isCurrent: boolean
}

export function roundId(tsSec: number, interval: UpdownInterval): number {
  return Math.floor(tsSec / UPDOWN_INTERVAL_SECONDS[interval])
}

export function roundStartOf(roundId: number, interval: UpdownInterval): number {
  return roundId * UPDOWN_INTERVAL_SECONDS[interval]
}

export function roundEndOf(roundId: number, interval: UpdownInterval): number {
  return (roundId + 1) * UPDOWN_INTERVAL_SECONDS[interval]
}

function roundStateOf(
  id: number,
  interval: UpdownInterval,
  now: number,
  hasResult?: boolean,
): RoundState {
  const currentId = roundId(now, interval)
  if (id < currentId) return hasResult ? 'resolved' : 'settling'
  if (id === currentId && roundEndOf(id, interval) <= now) return 'settling'
  return 'active'
}

/** 基于 epoch 秒计算轮次信息，hasResult 用于区分已结算/结算中历史轮 */
export function describeRound(
  startSec: number,
  interval: UpdownInterval,
  now: number,
  hasResult?: boolean,
): RoundInfo {
  const id = roundId(startSec, interval)
  const start = roundStartOf(id, interval)
  const end = roundEndOf(id, interval)
  const currentId = roundId(now, interval)
  return {
    id,
    start,
    end,
    remaining: Math.max(0, end - now),
    progress: Math.min(1, Math.max(0, (now - start) / UPDOWN_INTERVAL_SECONDS[interval])),
    state: roundStateOf(id, interval, now, hasResult),
    isCurrent: id === currentId,
  }
}

/** 周期起点（epoch 秒）→ 当前轮若属历史且未结算则视为 settling */
export function roundHasResult(startSec: number, interval: UpdownInterval, now: number): boolean {
  const currentId = roundId(now, interval)
  return roundId(startSec, interval) < currentId
}