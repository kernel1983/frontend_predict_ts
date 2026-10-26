import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { cn } from '@/lib/cn'
import { useChainModeStore } from '@/store/chainMode'

type Outcome = 'white' | 'draw' | 'black'

interface ChessState {
  chess_board: string[][]
  chess_turn: 'w' | 'b'
  chess_status: string
  chess_result: string | null
}

interface ChessHistoryEntry {
  block_number: number
  value: ChessState
}

const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
const ranks = [8, 7, 6, 5, 4, 3, 2, 1]
const pieceGlyphs: Record<string, string> = {
  K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙',
  k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟',
}
const outcomes: { value: Outcome; title: string; detail: string; odds: string }[] = [
  { value: 'white', title: 'White wins', detail: '白方获胜', odds: '2.10×' },
  { value: 'draw', title: 'Draw', detail: '和棋', odds: '3.25×' },
  { value: 'black', title: 'Black wins', detail: '黑方获胜', odds: '2.42×' },
]

export default function ChessDebugPage() {
  const { gameId = '1' } = useParams()
  const { mode } = useChainModeStore()
  const [selection, setSelection] = useState<Outcome>('white')
  const [submitted, setSubmitted] = useState(false)
  const [history, setHistory] = useState<ChessHistoryEntry[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadChessHistory = useCallback(async () => {
    try {
      const prefix = `chess-chess_state:${gameId}`
      const response = await fetch(`http://127.0.0.1:8545/api/query_recent_state?prefix=${encodeURIComponent(prefix)}`)
      if (!response.ok) throw new Error(`Node returned ${response.status}`)
      const payload: { result?: ChessHistoryEntry[] } = await response.json()
      const entries = (payload.result ?? []).filter((entry) => Array.isArray(entry.value?.chess_board))
      if (entries.length === 0) {
        throw new Error(`Game "${gameId}" was not found on the local chain`)
      }
      setHistory(entries)
      setHistoryIndex((index) => index < 0 || index === history.length - 1 ? entries.length - 1 : Math.min(index, entries.length - 1))
      setError(null)
    } catch (reason) {
      setHistory([])
      setHistoryIndex(-1)
      setError(reason instanceof Error ? reason.message : 'Could not load chess state')
    } finally {
      setLoading(false)
    }
  }, [gameId, history.length])

  useEffect(() => {
    setLoading(true)
    void loadChessHistory()
    const refresh = window.setInterval(() => void loadChessHistory(), 5_000)
    return () => window.clearInterval(refresh)
  }, [loadChessHistory])

  const activeEntry = history[historyIndex]
  const state = activeEntry?.value
  const turnLabel = state?.chess_turn === 'w' ? 'White to move' : 'Black to move'

  return (
    <AppLayout>
      <Link to="/" className="text-sm text-accent hover:underline">← Back to markets</Link>
      <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-accent-border bg-accent-bg px-2.5 py-1 text-xs font-medium text-accent">DEBUG · {mode.toUpperCase()}</span>
            <span className="text-xs text-text">Demo market · no settlement</span>
          </div>
          <h1 className="mt-3 text-2xl font-semibold text-text-h">Chess match prediction</h1>
          <p className="mt-1 text-sm text-text">On-chain state for {gameId} · choose the result you expect.</p>
        </div>
        <div className="rounded-xl border border-border bg-bg px-4 py-3 text-right shadow-card">
          <p className="text-xs text-text">Position</p>
          <p className="mt-0.5 font-mono text-sm font-medium text-text-h">{loading ? 'Loading…' : state?.chess_status ?? 'Unavailable'}</p>
        </div>
      </div>
      <div className="mt-7 grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section aria-label="Chessboard" className="mx-auto w-full max-w-[620px]">
          <div className="overflow-hidden rounded-2xl border-8 border-[#3d2d25] bg-[#3d2d25] shadow-card"><div className="grid grid-cols-8">
            {ranks.flatMap((rank, rankIndex) => files.map((file, fileIndex) => {
              const square = `${file}${rank}`
              const dark = (rankIndex + fileIndex) % 2 === 1
              const piece = state?.chess_board?.[rankIndex]?.[fileIndex]
              const glyph = piece ? pieceGlyphs[piece] : undefined
              return <div key={square} className={cn('relative flex aspect-square items-center justify-center select-none', dark ? 'bg-[#b58863]' : 'bg-[#f0d9b5]')}>
                {glyph && <span aria-label={`${piece} on ${square}`} className={cn('relative z-10 text-[clamp(1.7rem,6vw,4.2rem)] leading-none drop-shadow-[0_1px_1px_rgba(0,0,0,0.35)]', piece && piece === piece.toUpperCase() ? 'text-[#fffdf6]' : 'text-[#1c1917]')}>{glyph}</span>}
                {fileIndex === 0 && <span className="absolute left-1 top-0.5 text-[10px] font-bold text-[#6b4934]">{rank}</span>}
                {rankIndex === 7 && <span className="absolute bottom-0 right-1 text-[10px] font-bold text-[#6b4934]">{file}</span>}
              </div>
            }))}
          </div></div>
          {error ? <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-500"><span>Local chain unavailable: {error}</span><button type="button" onClick={() => void loadChessHistory()} className="shrink-0 font-medium underline">Retry</button></div> : <>
            <p className="mt-3 text-center text-xs text-text">{turnLabel} · {state?.chess_result ?? 'Game in progress'} · block {activeEntry?.block_number ?? '—'}</p>
            <div className="mt-3 flex items-center justify-center gap-2">
              <button type="button" disabled={historyIndex <= 0} onClick={() => setHistoryIndex((index) => index - 1)} className="rounded-lg border border-border px-3 py-1.5 text-xs text-text transition-colors enabled:hover:border-accent-border disabled:cursor-not-allowed disabled:opacity-40">← Previous</button>
              <span className="min-w-20 text-center text-xs text-text">{history.length === 0 ? '—' : `${historyIndex + 1} / ${history.length}`}</span>
              <button type="button" disabled={historyIndex >= history.length - 1} onClick={() => setHistoryIndex((index) => index + 1)} className="rounded-lg border border-border px-3 py-1.5 text-xs text-text transition-colors enabled:hover:border-accent-border disabled:cursor-not-allowed disabled:opacity-40">Next →</button>
              <button type="button" onClick={() => setHistoryIndex(history.length - 1)} className="rounded-lg px-2 py-1.5 text-xs text-accent hover:bg-accent-bg">Latest</button>
            </div>
          </>}
        </section>
        <aside className="rounded-2xl border border-border bg-bg p-5 shadow-card">
          <h2 className="text-lg font-semibold text-text-h">Predict the result</h2><p className="mt-1 text-sm text-text">Select one possible game outcome.</p>
          <div className="mt-4 space-y-2">{outcomes.map((outcome) => {
            const selected = selection === outcome.value
            return <button key={outcome.value} type="button" onClick={() => { setSelection(outcome.value); setSubmitted(false) }} className={cn('flex w-full items-center justify-between rounded-xl border p-3 text-left transition-colors', selected ? 'border-accent bg-accent-bg' : 'border-border hover:border-accent-border')}><span><span className="block font-medium text-text-h">{outcome.title}</span><span className="text-xs text-text">{outcome.detail}</span></span><span className="font-mono text-sm font-medium text-text-h">{outcome.odds}</span></button>
          })}</div>
          <button type="button" onClick={() => setSubmitted(true)} className="mt-5 w-full rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90">Place debug prediction</button>
          {submitted && <p role="status" className="mt-3 rounded-lg bg-accent-bg px-3 py-2 text-sm text-accent">Debug selection saved: {outcomes.find((outcome) => outcome.value === selection)?.title}</p>}
        </aside>
      </div>
    </AppLayout>
  )
}
