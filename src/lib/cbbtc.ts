/**
 * backend/ws.py 的客户端封装：把 Base 上 cbBTC 的实时价格（Codex 订阅 Uniswap 池 Swap）
 * 推到浏览器。协议是每帧一个 JSON 文本：
 *
 *   server -> {"type": "hello",    pool, networkId, symbol, quote, ...}  连接时立刻来一帧
 *   server -> {"type": "price",    data: <record>}                        每次推送（连接时先补一帧最新的）
 *   server -> {"type": "degraded", code, message, transport}             codex ws 被拒后降级到轮询
 *   server -> {"type": "error",    code, message}                        上游挂了
 *   client -> {"type": "ping"}  -> server replies {"type": "pong"}
 *
 * 服务端默认只监听 127.0.0.1:8765，浏览器同机直连即可；跨机时用 VITE_CBBTC_WS_URL 覆盖
 * （启动服务时也要加 --host 0.0.0.0 --origins）。
 */
const DEFAULT_CBBTC_WS_URL = 'ws://127.0.0.1:8765'
const CBBTC_HEARTBEAT_INTERVAL = 25_000
const CBBTC_RECONNECT_BASE_DELAY = 1_000
const CBBTC_RECONNECT_MAX_DELAY = 30_000
/** 服务端每 25s 推 ping（也回 pong），这么久一帧都没来就当作连接已死，重连 */
const CBBTC_STALL_TIMEOUT = 90_000

export interface CbBtcRecord {
  ts: number
  sourceTimestamp: number | null
  symbol: string
  quote: string
  priceUsd: number
  tickChangePct: number | null
  priceChange24: number | null
  blockNumber: number | null
  blockChange: number | null
  pool: string
  networkId: number
  /** 上游传输：codex-ws 或 poll */
  mode: string
}

export interface CbBtcHello {
  pool: string
  networkId: number
  symbol: string
  quote: string
  serverTime: number
  clients: number
  droppedForSlowClients: number
  connected: boolean
  messages: number
  reconnects: number
  lastPushAgeSec: number | null
}

export interface CbBtcDegraded {
  code: string
  message: string
  transport: string
  intervalSec: number | null
}

export interface CbBtcFeedError {
  code: string
  message: string
}

type CbBtcEvent = 'price' | 'hello' | 'degraded' | 'error' | 'connected' | 'disconnected'
type CbBtcListener = (data: unknown) => void

export function cbBtcWsUrl(): string {
  const override = import.meta.env.VITE_CBBTC_WS_URL
  return typeof override === 'string' && override !== '' ? override : DEFAULT_CBBTC_WS_URL
}

const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : Number.parseFloat(String(v))
  return Number.isFinite(n) ? n : null
}

const int = (v: unknown): number | null => num(v)

function parseRecord(raw: unknown): CbBtcRecord | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const priceUsd = num(r.priceUsd)
  if (priceUsd === null) return null
  return {
    ts: int(r.ts) ?? Math.floor(Date.now() / 1000),
    sourceTimestamp: int(r.sourceTimestamp),
    symbol: typeof r.symbol === 'string' ? r.symbol : 'cbBTC',
    quote: typeof r.quote === 'string' ? r.quote : 'USD',
    priceUsd,
    tickChangePct: num(r.tickChangePct),
    priceChange24: num(r.priceChange24),
    blockNumber: int(r.blockNumber),
    blockChange: int(r.blockChange),
    pool: typeof r.pool === 'string' ? r.pool : '',
    networkId: int(r.networkId) ?? 0,
    mode: typeof r.mode === 'string' ? r.mode : '',
  }
}

function parseHello(raw: Record<string, unknown>): CbBtcHello {
  return {
    pool: typeof raw.pool === 'string' ? raw.pool : '',
    networkId: int(raw.networkId) ?? 0,
    symbol: typeof raw.symbol === 'string' ? raw.symbol : 'cbBTC',
    quote: typeof raw.quote === 'string' ? raw.quote : 'USD',
    serverTime: int(raw.serverTime) ?? Math.floor(Date.now() / 1000),
    clients: int(raw.clients) ?? 0,
    droppedForSlowClients: int(raw.droppedForSlowClients) ?? 0,
    connected: raw.connected === true,
    messages: int(raw.messages) ?? 0,
    reconnects: int(raw.reconnects) ?? 0,
    lastPushAgeSec: num(raw.lastPushAgeSec),
  }
}

export class CbBtcWS {
  private ws: WebSocket | null = null
  private readonly url: string
  private listeners: Record<CbBtcEvent, CbBtcListener[]> = {
    price: [],
    hello: [],
    degraded: [],
    error: [],
    connected: [],
    disconnected: [],
  }
  private lastRecord: CbBtcRecord | null = null
  private reconnectDelay = CBBTC_RECONNECT_BASE_DELAY
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private stallTimer: ReturnType<typeof setTimeout> | null = null
  private connected = false
  private intentionalClose = false

  constructor(url: string) {
    this.url = url
  }

  on(event: CbBtcEvent, callback: CbBtcListener): void {
    this.listeners[event].push(callback)
  }

  private emit(event: CbBtcEvent, data: unknown): void {
    this.listeners[event].forEach((cb) => {
      try {
        cb(data)
      } catch (e) {
        console.error('cbBTC WS listener error:', e)
      }
    })
  }

  connect(): void {
    if (this.ws) return
    this.intentionalClose = false

    try {
      this.ws = new WebSocket(this.url)
    } catch (e) {
      console.error('cbBTC WS connect failed:', e)
      this.scheduleReconnect()
      return
    }

    this.ws.onopen = () => {
      this.connected = true
      this.reconnectDelay = CBBTC_RECONNECT_BASE_DELAY
      this.startHeartbeat()
      this.emit('connected', { url: this.url })
    }

    this.ws.onmessage = (event: MessageEvent<string>) => {
      this.touchStallWatchdog()
      try {
        this.handleMessage(JSON.parse(event.data))
      } catch (e) {
        console.error('cbBTC WS parse error:', e)
      }
    }

    this.ws.onerror = (err) => {
      console.error('cbBTC WS error:', err)
    }

    this.ws.onclose = (event) => {
      this.connected = false
      this.stopTimers()
      this.emit('disconnected', { code: event.code, reason: event.reason })
      if (!this.intentionalClose) {
        this.emit('error', {
          code: `WS_CLOSED_${event.code}`,
          message: event.reason || `connection closed (${event.code})`,
        } satisfies CbBtcFeedError)
        this.scheduleReconnect()
      }
    }
  }

  disconnect(): void {
    this.intentionalClose = true
    this.stopTimers()
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

  getUrl(): string {
    return this.url
  }

  getLastRecord(): CbBtcRecord | null {
    return this.lastRecord
  }

  isConnected(): boolean {
    return this.connected
  }

  private send(msg: unknown): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg))
    }
  }

  private startHeartbeat(): void {
    this.stopTimers()
    this.heartbeatTimer = setInterval(() => {
      this.send({ type: 'ping' })
    }, CBBTC_HEARTBEAT_INTERVAL)
    this.touchStallWatchdog()
  }

  private stopTimers(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
    if (this.stallTimer) {
      clearTimeout(this.stallTimer)
      this.stallTimer = null
    }
  }

  /** 行情本身很稀疏，但服务端每 25s 会回 pong，所以这么久没帧就重连 */
  private touchStallWatchdog(): void {
    if (this.stallTimer) clearTimeout(this.stallTimer)
    this.stallTimer = setTimeout(() => {
      console.warn('cbBTC WS stalled, reconnecting')
      this.reconnect()
    }, CBBTC_STALL_TIMEOUT)
  }

  private reconnect(): void {
    const socket = this.ws
    this.ws = null
    this.stopTimers()
    if (socket) {
      socket.onopen = null
      socket.onclose = null
      socket.onmessage = null
      socket.onerror = null
      try {
        socket.close()
      } catch {
        // ignore
      }
    }
    this.scheduleReconnect()
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, CBBTC_RECONNECT_MAX_DELAY)
      this.connect()
    }, this.reconnectDelay)
  }

  private handleMessage(msg: Record<string, unknown>): void {
    if (!msg || typeof msg.type !== 'string') return

    switch (msg.type) {
      case 'hello':
        this.emit('hello', parseHello(msg))
        break
      case 'price': {
        const record = parseRecord(msg.data)
        if (!record) return
        this.lastRecord = record
        this.emit('price', record)
        break
      }
      case 'degraded':
        this.emit('degraded', {
          code: String(msg.code ?? 'DEGRADED'),
          message: String(msg.message ?? ''),
          transport: String(msg.transport ?? ''),
          intervalSec: num(msg.intervalSec),
        } satisfies CbBtcDegraded)
        break
      case 'error':
        this.emit('error', {
          code: String(msg.code ?? 'UPSTREAM_ERROR'),
          message: String(msg.message ?? 'upstream error'),
        } satisfies CbBtcFeedError)
        break
      case 'pong':
        break
      default:
        break
    }
  }
}
