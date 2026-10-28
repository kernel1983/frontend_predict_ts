import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAccount, useDynamicWallet, useSendTransaction } from '@/lib/dynamic'
import { useToast } from '@/components/ui/toast-context'
import { ensureWalletChain, isUserRejected, toErrorMessage } from '@/lib/wallet'
import { ZEN_CONTRACT, buildZenCallData } from '@/lib/zentra'

export function NewChessGameModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [opponentAddress, setOpponentAddress] = useState('')
  const [createMode, setCreateMode] = useState<'direct' | 'opponent'>('direct')
  const { address } = useAccount()
  const wallet = useDynamicWallet()
  const { sendTransactionAsync, isPending } = useSendTransaction()
  const toast = useToast()
  const [error, setError] = useState<string | null>(null)
  const [createdGameId, setCreatedGameId] = useState<string | null>(null)
  const [waitingForEvent, setWaitingForEvent] = useState(false)

  const createGame = async () => {
    setError(null)
    if (!address) {
      setError('Connect a wallet first.')
      return
    }
    try {
      const walletOrProvider = wallet ?? (typeof window !== 'undefined' ? (window as { ethereum?: unknown }).ethereum : null)
      await ensureWalletChain(walletOrProvider as never, {
        chainId: 31337,
        chainName: 'Local Zentra',
        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
        rpcUrls: ['http://127.0.0.1:8545'],
      })
      const data = buildZenCallData('chess_create_game', createMode === 'opponent' ? [opponentAddress.trim()] : [])
      const hash = await sendTransactionAsync({
        chainId: 31337,
        account: address,
        to: ZEN_CONTRACT,
        value: 0n,
        data,
        gas: 210000n,
        gasPrice: 1000000000n,
      })
      toast.push({ title: 'Chess game creation submitted', description: hash.slice(0, 12), variant: 'success' })
      const findGameId = (value: unknown): string | null => {
        if (Array.isArray(value)) {
          for (const item of value) {
            const found = findGameId(item)
            if (found) return found
          }
          return null
        }
        if (!value || typeof value !== 'object') return null
        const record = value as Record<string, unknown>
        for (const key of ['game_id', 'gameId', 'chess_game_id', 'game']) {
          const candidate = record[key]
          if (typeof candidate === 'string' || typeof candidate === 'number') return String(candidate)
        }
        for (const key of ['args', 'arguments', 'a']) {
          const args = record[key]
          if (Array.isArray(args) && (typeof args[0] === 'string' || typeof args[0] === 'number')) return String(args[0])
        }
        for (const child of Object.values(record)) {
          const found = findGameId(child)
          if (found) return found
        }
        return null
      }
      setWaitingForEvent(true)
      let gameId: string | null = null
      for (let attempt = 0; attempt < 30 && !gameId; attempt += 1) {
        try {
          const txhash = hash.startsWith('0x') ? hash.slice(2) : hash
          const eventsResponse = await fetch(`http://127.0.0.1:8545/api/events?txhash=${encodeURIComponent(txhash)}`)
          if (eventsResponse.ok) gameId = findGameId(await eventsResponse.json())
        } catch {
          // The event indexer may briefly be unavailable while the tx is mined.
        }
        if (!gameId && attempt < 29) await new Promise((resolve) => window.setTimeout(resolve, 2_000))
      }
      setWaitingForEvent(false)
      if (!gameId) throw new Error('Game created, but the creation event did not include a game id.')
      setCreatedGameId(gameId)
      toast.push({ title: 'Chess game created', description: `Game ${gameId}`, variant: 'success' })
    } catch (reason) {
      if (!isUserRejected(reason)) setError(toErrorMessage(reason))
    }
  }
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-accent-border bg-bg p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-text-h">New chess game</h3>
            <p className="mt-1 text-sm text-text">Choose how you want to start.</p>
          </div>
          <button type="button" onClick={onClose} className="text-sm text-text hover:text-text-h">✕</button>
        </div>
        <div className="mt-4 grid gap-3">
          <button type="button" onClick={() => setCreateMode('direct')} className={`w-full rounded-xl border p-4 text-left transition-colors ${createMode === 'direct' ? 'border-accent bg-accent-bg' : 'border-border hover:border-accent-border'}`}>
            <span className="block font-semibold text-text-h">Create directly</span>
            <span className="mt-1 block text-xs text-text">Wait for any opponent to join.</span>
          </button>
          <div onClick={() => setCreateMode('opponent')} className={`w-full rounded-xl border p-4 text-left transition-colors ${createMode === 'opponent' ? 'border-accent bg-accent-bg' : 'border-border hover:border-accent-border'}`}>
            <span className="block font-semibold text-text-h">Create with opponent</span>
            {createMode === 'opponent' && <input value={opponentAddress} onChange={(event) => setOpponentAddress(event.target.value)} onClick={(event) => event.stopPropagation()} placeholder="0x… opponent address" className="mt-2 h-10 w-full rounded-lg border border-border bg-bg px-3 font-mono text-xs text-text-h" />}
          </div>
        </div>
        {error && <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-500">{error}</p>}
        {createdGameId && <Link to={`/chess/${createdGameId}`} onClick={onClose} className="mt-3 block rounded-lg bg-accent-bg px-3 py-2 text-center text-sm font-semibold text-accent">Go to game {createdGameId} →</Link>}
        <button type="button" disabled={isPending || waitingForEvent || (createMode === 'opponent' && !opponentAddress.trim())} onClick={() => void createGame()} className="mt-4 w-full rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">{isPending ? 'Waiting for signature…' : waitingForEvent ? 'Waiting for game event…' : 'Create game'}</button>
      </div>
    </div>
  )
}
