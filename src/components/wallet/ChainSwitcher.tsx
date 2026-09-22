import { useState } from 'react'
import { useChainId, useChains, useSwitchChain } from 'wagmi'
import { useToast } from '@/components/ui/toast-context'
import { toErrorMessage } from '@/lib/wallet'
import { cn } from '@/lib/cn'

export function ChainSwitcher() {
  const chainId = useChainId()
  const chains = useChains()
  const { switchChainAsync } = useSwitchChain()
  const toast = useToast()
  const [open, setOpen] = useState(false)

  const current = chains.find((chain) => chain.id === chainId)

  const handleSwitch = (target: number) => {
    setOpen(false)
    switchChainAsync({
      chainId: target as (typeof chains)[number]['id'],
    }).catch((err) => {
      toast.push({ title: 'Failed to switch network', description: toErrorMessage(err), variant: 'error' })
    })
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 items-center gap-1.5 rounded-full border border-border bg-bg px-3 text-sm text-text-h transition-colors hover:border-accent-border"
      >
        <span className="size-2 rounded-full bg-emerald-500" aria-hidden="true" />
        {current?.name ?? 'Switch network'}
        <svg viewBox="0 0 24 24" fill="none" className="size-3.5 opacity-60">
          <path
            d="M6 9l6 6 6-6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-2 w-52 overflow-hidden rounded-xl border border-border bg-bg shadow-card">
            <p className="px-3 py-2 text-xs text-text">Switch network</p>
            {chains.map((chain) => {
              const active = chain.id === chainId
              return (
                <button
                  key={chain.id}
                  type="button"
                  onClick={() => handleSwitch(chain.id)}
                  className={cn(
                    'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-black/5 dark:hover:bg-white/10',
                    active ? 'text-accent' : 'text-text-h',
                  )}
                >
                  <span className="w-1.5 shrink-0">
                    {active && (
                      <svg viewBox="0 0 24 24" fill="none" className="size-3.5">
                        <path
                          d="M5 12l5 5L19 7"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </span>
                  <span className="flex-1">{chain.name}</span>
                  <span className="font-mono text-xs text-text">{chain.id}</span>
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}