import { useEffect, useRef, useState } from 'react'
import { HyperliquidWS } from '@/lib/hyperliquid'

/**
 * 订阅 Hyperliquid 实时行情。每次 symbol 或 enabled 变化重建连接。
 * candle 事件也会更新 close（1m 收盘）为当前价。
 */
export function useHyperliquidPrice(
  coin: string | null,
  enabled: boolean,
): { price: number | null; connected: boolean } {
  const wsRef = useRef<HyperliquidWS | null>(null)
  const [price, setPrice] = useState<number | null>(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    if (!coin || !enabled) {
      return
    }

    const ws = new HyperliquidWS()
    wsRef.current = ws
    ws.on('price', (data) => {
      setPrice((data as { price: number }).price)
    })
    ws.on('candle', (data) => {
      setPrice((data as { candle: { close: number } }).candle.close)
    })
    ws.on('connected', () => setConnected(true))
    ws.on('disconnected', () => setConnected(false))
    ws.connect()
    ws.subscribeTrades(coin)
    ws.subscribeCandle(coin, '1m')

    return () => {
      ws.disconnect()
      wsRef.current = null
    }
  }, [coin, enabled])

  return { price, connected }
}