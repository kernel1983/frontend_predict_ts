import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Spinner } from '@/components/ui/Spinner'
import { ConnectWalletButton } from '@/components/wallet/ConnectWalletButton'
import { SignInCard } from '@/components/wallet/SignInCard'
import { useAccount, useDynamicContextSafe } from '@/lib/dynamic'
import { useSession } from '@/hooks/useSession'

export default function LoginPage() {
  const { user, status } = useSession()
  const { address, isConnected } = useAccount()
  const dyn = useDynamicContextSafe()
  const setShowAuthFlow = dyn?.setShowAuthFlow
  const [opening, setOpening] = useState(false)

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
              <ConnectWalletButton
                loading={opening}
                onClick={() => {
                  setOpening(true)
                  setShowAuthFlow?.(true)
                  window.setTimeout(() => setOpening(false), 1_000)
                }}
              />
            ) : (
              <SignInCard address={address!} key={address} />
            )}
          </div>

          <p className="mt-6 text-center text-xs text-text">
            By signing in you agree to the
            <span className="text-accent">Terms of Service</span> and
            <span className="text-accent">Privacy Policy</span>
          </p>

          {import.meta.env.DEV && (
            <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 font-mono text-xs text-amber-700 dark:text-amber-400">
              <div>setShowAuthFlow: {dyn?.setShowAuthFlow ? 'ok' : 'MISSING'}</div>
              <div>sdkHasLoaded: {String(dyn?.sdkHasLoaded ?? 'n/a')}</div>
              <div>
                projectSettings:{' '}
                {(dyn as unknown as { projectSettings?: unknown } | null)?.projectSettings
                  ? 'loaded'
                  : 'NOT LOADED'}
              </div>
              <div>showAuthFlow: {String(dyn?.showAuthFlow ?? 'n/a')}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
