/** lightweight-charts 的点：秒级时间戳 + 价格 */
export interface PricePoint {
  time: number
  value: number
}

/** 图上保留最近多少秒（1 点/秒 → 10 分钟 ≈ 600 个点） */
export const WINDOW_SEC = 600
/** 兜底上限：万一同一秒塞进多个点，也不至于无限增长 */
export const MAX_POINTS = 4000

/** 行情源 + 曲线。key 变（切源/换 symbol）即整块重置，避免两个源的点混在一张图上 */
export interface PriceState {
  key: string
  price: number | null
  points: PricePoint[]
}

export function emptyPriceState(key: string): PriceState {
  return { key, price: null, points: [] }
}

/** 只保留最近 WINDOW_SEC 秒（同时留一个条数兜底） */
function trimWindow(points: PricePoint[], newest: number): PricePoint[] {
  const cutoff = newest - WINDOW_SEC
  let start = 0
  while (start < points.length && points[start].time < cutoff) start++
  const windowed = start > 0 ? points.slice(start) : points
  return windowed.length > MAX_POINTS ? windowed.slice(windowed.length - MAX_POINTS) : windowed
}

/**
 * 把一个价格并入曲线。曲线是连续的，不按分钟重置。
 *
 * - 同一秒来多条：覆盖最后一个点
 * - 时间戳落在最后一个点之前（base 推送带的是服务端时间戳，可能比本地补点慢几秒）：
 *   也覆盖最后一个点，价格照常更新；否则 lightweight-charts 会因时间非严格递增直接抛断言
 */
export function ingestPrice(
  prev: PriceState,
  key: string,
  value: number,
  atSec: number,
): PriceState {
  // 切源/换 symbol：旧源的点丢掉，从这条推送重新开始（别把第一条也丢了）
  const state = prev.key === key ? prev : emptyPriceState(key)
  const last = state.points[state.points.length - 1]
  const time = last && atSec <= last.time ? last.time : atSec
  const points =
    !last || time === last.time
      ? [...state.points.slice(0, -1), { time, value }]
      : [...state.points, { time, value }]
  return { ...state, price: value, points: trimWindow(points, time) }
}

/**
 * lightweight-charts 的 setData 要求时间严格递增。
 * 多个来源（本地秒级补点、服务端时间戳的推送）混在一起时统一兜底：
 * 丢掉非法值；同秒或倒序的点都并入最后一个点（保留更新的价格，时间不动），
 * 保证输出严格递增。
 */
export function ascOrderedPoints(points: PricePoint[]): PricePoint[] {
  const out: PricePoint[] = []
  for (const p of points) {
    if (!Number.isFinite(p.time) || !Number.isFinite(p.value)) continue
    const last = out[out.length - 1]
    if (!last || p.time > last.time) out.push(p)
    else out[out.length - 1] = { time: last.time, value: p.value }
  }
  return out
}
