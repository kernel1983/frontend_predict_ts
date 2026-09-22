import type { ReactNode } from 'react'
import { Header } from './Header'

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col">
      <Header />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        {children}
      </main>
      <footer className="border-t border-border py-6 text-center text-xs text-text">
        powered by predict · Participate at your own risk
      </footer>
    </div>
  )
}