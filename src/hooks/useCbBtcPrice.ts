import { useEffect, useRef, useState } from 'react'
import {
  CbBtcWS,
  cbBtcWsUrl,
  type CbBtcDegraded,
  type CbBtcFeedError,
  type CbBtcHello,
  type CbBtcRecord,
} from '@/lib/cbbtc'

export interface CbBtcFeed {
  url: string
  price: number | null
  connected: boolean
  record: CbBtcRecord | null
  hello: CbBtcHello | null
  degraded: CbBtcDegraded | null
  error: CbBtcFeedError | null
}

const EMPTY: CbBtcFeed = {
  url: '',
  price: null,
  connected: false,
  record: null,
  hello: null,
  degraded: null,
  error: null,
}

/**
 * 订阅 backend/ws.py 的 cbBTC 行情。enabled 变 false 时断开。
 * onRecord 在每条推送到达时同步调用（曲线入点走这里，避免多等一帧）。
 */
export function useCbBtcPrice(
  enabled: boolean,
  onRecord?: (record: CbBtcRecord) => void,
): CbBtcFeed {
  const url = cbBtcWsUrl()
  const [feed, setFeed] = useState<CbBtcFeed>(EMPTY)
  const onRecordRef = useRef(onRecord)

  useEffect(() => {
    onRecordRef.current = onRecord
  }, [onRecord])

  useEffect(() => {
    if (!enabled) return

    const ws = new CbBtcWS(url)
    ws.on('connected', () => setFeed((prev) => ({ ...prev, connected: true, error: null })))
    ws.on('disconnected', () => setFeed((prev) => ({ ...prev, connected: false })))
    ws.on('hello', (data) => setFeed((prev) => ({ ...prev, hello: data as CbBtcHello })))
    ws.on('price', (data) => {
      const record = data as CbBtcRecord
      setFeed((prev) => ({ ...prev, price: record.priceUsd, record }))
      onRecordRef.current?.(record)
    })
    ws.on('degraded', (data) => setFeed((prev) => ({ ...prev, degraded: data as CbBtcDegraded })))
    ws.on('error', (data) => setFeed((prev) => ({ ...prev, error: data as CbBtcFeedError })))
    ws.connect()

    return () => {
      ws.disconnect()
      setFeed(EMPTY)
    }
  }, [enabled, url])

  return enabled ? { ...feed, url } : EMPTY
}
