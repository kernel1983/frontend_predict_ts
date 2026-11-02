import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Spinner } from '@/components/ui/Spinner'
import { ConnectWalletButton } from '@/components/wallet/ConnectWalletButton'
import { SignInCard } from '@/components/wallet/SignInCard'
import { WalletModal } from '@/components/wallet/WalletModal'
import { useAccount, useDynamicContextSafe } from '@/lib/dynamic'
import { useAccount as useWagmiAccount, useDisconnect as useWagmiDisconnect } from 'wagmi'
import { useSession } from '@/hooks/useSession'
import { clearAuthStorage } from '@/lib/wallet'

export default function LoginPage() {
  const { user, status } = useSession()
  const { address, isConnected } = useAccount()
  const dyn = useDynamicContextSafe()
  const setShowAuthFlow = dyn?.setShowAuthFlow
  const wagmiAccount = useWagmiAccount()
  const { disconnectAsync: wagmiDisconnect } = useWagmiDisconnect()
  const [opening, setOpening] = useState(false)
  const [walletModalOpen, setWalletModalOpen] = useState(false)

  if (status === 'loading') {
    return (
      <div className="flex min-h-svh items-center justify-center text-accent">
        <Spinner className="size-8" />
      </div>
    )
  }

  if (user) {
    return <Navigate to="/" replace />
  }

  const phase = isConnected && address ? 'signin' : 'connect'

  const handleGoogle = () => {
    setOpening(true)
    if (wagmiAccount.isConnected) void wagmiDisconnect().catch(() => {})
    setShowAuthFlow?.(true)
    window.setTimeout(() => setOpening(false), 1_000)
  }

  const handleWalletConnected = () => {
    // 互斥：登出 Dynamic
    void dyn?.handleLogOut?.().catch(() => {})
  }

  const handleReset = () => {
    clearAuthStorage()
    window.location.reload()
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-bg px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-center gap-2 text-xl font-semibold text-text-h">
          <span className="flex size-8 items-center justify-center rounded-lg bg-accent text-base font-bold text-white">
            P
          </span>
          predict
        </div>

        <div className="rounded-2xl border border-border bg-bg p-6 shadow-card">
          <h1 className="text-xl font-semibold text-text-h">Sign in to predict</h1>
          <p className="mb-6 mt-1.5 text-sm text-text">
            Continue with Google or a Web3 wallet — new accounts get a wallet
            created automatically.
          </p>

          <div className="min-h-40">
            {phase === 'connect' ? (
              <div className="space-y-3">
                <ConnectWalletButton
                  loading={opening}
                  label="Continue with Google"
                  onClick={handleGoogle}
                />
                <ConnectWalletButton
                  label="Connect wallet"
                  onClick={() => setWalletModalOpen(true)}
                />
              </div>
            ) : (
              <SignInCard address={address!} key={address} />
            )}
          </div>

          <p className="mt-6 text-center text-xs text-text">
            By signing in you agree to the{' '}
            <span className="text-accent">Terms of Service</span> and{' '}
            <span className="text-accent">Privacy Policy</span>
          </p>

          <button
            type="button"
            onClick={handleReset}
            className="mt-4 block w-full text-center text-xs text-text underline hover:text-text-h"
          >
            Can't sign in or out? Reset local state
          </button>
        </div>
      </div>

      <WalletModal
        open={walletModalOpen}
        onClose={() => setWalletModalOpen(false)}
        onConnected={handleWalletConnected}
      />
    </div>
  )
}
