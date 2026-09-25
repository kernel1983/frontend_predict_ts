const HL_WS_URL = 'wss://api.hyperliquid.xyz/ws'
const HL_HEARTBEAT_INTERVAL = 25000
const HL_RECONNECT_BASE_DELAY = 1000
const HL_RECONNECT_MAX_DELAY = 30000

export const HL_COINS: Record<string, string> = {
  btc: 'BTC',
  eth: 'ETH',
  sol: 'SOL',
  hype: 'HYPE',
}

export function hlCoinFor(symbol: string): string | null {
  return HL_COINS[symbol.toLowerCase()] ?? null
}

export interface HlCandle {
  t: number
  o: number
  h: number
  l: number
  c: number
  v: number
}

export async function fetchCandleSnapshot(
  coin: string,
  startMs: number,
  endMs: number,
): Promise<HlCandle[]> {
  const resp = await fetch('https://api.hyperliquid.xyz/info', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'candleSnapshot',
      req: { coin, interval: '1m', startTime: startMs, endTime: endMs },
    }),
  })
  if (!resp.ok) throw new Error(`Hyperliquid candleSnapshot failed (${resp.status})`)
  const data = (await resp.json()) as Array<Record<string, unknown>>
  if (!Array.isArray(data)) return []
  return data
    .map((c) => ({
      t: Number(c.t),
      o: Number(c.o),
      h: Number(c.h),
      l: Number(c.l),
      c: Number(c.c),
      v: Number(c.v),
    }))
    .filter((c) => Number.isFinite(c.t) && Number.isFinite(c.o) && Number.isFinite(c.c))
}

export interface HlPriceData {
  price: number
  size: number
  side: string | null
  time: number
}

export interface HlCandlePoint {
  key: string
  candle: {
    time: number
    open: number
    high: number
    low: number
    close: number
    volume: number
  }
}

type HlListener = (data: unknown) => void

export interface HlSubscription {
  method: string
  subscription: { type: string; coin?: string; interval?: string }
}

export class HyperliquidWS {
  private ws: WebSocket | null = null
  private listeners: Record<string, HlListener[]> = {
    price: [],
    candle: [],
    connected: [],
    disconnected: [],
  }
  private lastPrice: number | null = null
  private reconnectDelay = HL_RECONNECT_BASE_DELAY
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private activeSubscriptions: HlSubscription[] = []
  private connected = false
  private intentionalClose = false

  on(event: 'price' | 'candle' | 'connected' | 'disconnected', callback: HlListener): void {
    this.listeners[event].push(callback)
  }

  off(event: 'price' | 'candle' | 'connected' | 'disconnected', callback: HlListener): void {
    this.listeners[event] = this.listeners[event].filter((cb) => cb !== callback)
  }

  private emit(event: string, data: unknown): void {
    ;(this.listeners[event] || []).forEach((cb) => {
      try {
        cb(data)
      } catch (e) {
        console.error('HL WS listener error:', e)
      }
    })
  }

  connect(): void {
    if (this.ws) return
    this.intentionalClose = false

    try {
      this.ws = new WebSocket(HL_WS_URL)
    } catch (e) {
      console.error('HL WS connect failed:', e)
      this.scheduleReconnect()
      return
    }

    this.ws.onopen = () => {
      this.connected = true
      this.reconnectDelay = HL_RECONNECT_BASE_DELAY
      this.startHeartbeat()
      this.emit('connected', true)
      this.resubscribe()
    }

    this.ws.onmessage = (event: MessageEvent<string>) => {
      try {
        const msg = JSON.parse(event.data)
        this.handleMessage(msg)
      } catch (e) {
        console.error('HL WS parse error:', e)
      }
    }

    this.ws.onerror = (err) => {
      console.error('HL WS error:', err)
    }

    this.ws.onclose = () => {
      this.connected = false
      this.stopHeartbeat()
      this.emit('disconnected', true)
      if (!this.intentionalClose) {
        this.scheduleReconnect()
      }
    }
  }

  disconnect(): void {
    this.intentionalClose = true
    this.stopHeartbeat()
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.ws) {
      this.ws.onopen = null
      this.ws.onclose = null
      this.ws.onmessage = null
      this.ws.onerror = null
      try {
        this.ws.close()
      } catch {
        // ignore
      }
      this.ws = null
    }
    this.connected = false
  }

  private send(msg: unknown): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg))
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat()
    this.heartbeatTimer = setInterval(() => {
      this.send({ method: 'ping' })
    }, HL_HEARTBEAT_INTERVAL)
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, HL_RECONNECT_MAX_DELAY)
      this.connect()
    }, this.reconnectDelay)
  }

  private ensureSubscribed(sub: HlSubscription): void {
    const exists = this.activeSubscriptions.some(
      (s) => JSON.stringify(s) === JSON.stringify(sub),
    )
    if (exists) return
    this.activeSubscriptions.push(sub)
    this.send(sub)
  }

  subscribeTrades(coin = 'BTC'): void {
    this.ensureSubscribed({
      method: 'subscribe',
      subscription: { type: 'trades', coin },
    })
  }

  subscribeCandle(coin = 'BTC', interval = '1m'): void {
    this.ensureSubscribed({
      method: 'subscribe',
      subscription: { type: 'candle', coin, interval },
    })
  }

  unsubscribe(subscription: HlSubscription['subscription']): void {
    this.send({ method: 'unsubscribe', subscription })
    this.activeSubscriptions = this.activeSubscriptions.filter(
      (s) => JSON.stringify(s.subscription) !== JSON.stringify(subscription),
    )
  }

  private resubscribe(): void {
    this.activeSubscriptions.forEach((sub) => this.send(sub))
  }

  private handleMessage(msg: Record<string, unknown>): void {
    if (!msg || !msg.channel) return

    if (msg.channel === 'trades' && Array.isArray(msg.data)) {
      for (const trade of msg.data as Array<Record<string, unknown>>) {
        const price = Number.parseFloat(String(trade.px))
        if (!Number.isNaN(price)) {
          this.lastPrice = price
          this.emit('price', {
            price,
            size: Number.parseFloat(String(trade.sz)) || 0,
            side: (trade.side as string | null) ?? null,
            time: Number(trade.time),
          } satisfies HlPriceData)
        }
      }
    }

    if (msg.channel === 'allMids' && msg.data) {
      const mids = msg.data as Record<string, string>
      const btcMid = mids.BTC ?? mids['BTC']
      if (btcMid) {
        const price = Number.parseFloat(btcMid)
        if (!Number.isNaN(price)) {
          this.lastPrice = price
          this.emit('price', { price, size: 0, side: null, time: Date.now() } satisfies HlPriceData)
        }
      }
    }

    if (msg.channel === 'candle' && msg.data) {
      const c = msg.data as Record<string, unknown>
      const key = `${c.coin}:${c.interval}`
      const candle = {
        time: Math.floor(Number(c.t) / 1000),
        open: Number.parseFloat(String(c.o)),
        high: Number.parseFloat(String(c.h)),
        low: Number.parseFloat(String(c.l)),
        close: Number.parseFloat(String(c.c)),
        volume: Number.parseFloat(String(c.v)),
      }
      this.emit('candle', { key, candle } satisfies HlCandlePoint)
    }

    if (msg.channel === 'subscriptionResponse') {
      console.log('HL WS subscription confirmed:', msg.data)
    }

    if (msg.channel === 'error') {
      console.error('HL WS subscription error:', msg.data)
    }
  }

  getLastPrice(): number | null {
    return this.lastPrice
  }

  isConnected(): boolean {
    return this.connected
  }
}