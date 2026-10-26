import type { ReactNode } from 'react'
import { dynamicConfigured } from '@/lib/dynamic'
import { Header } from './Header'

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col">
      {!dynamicConfigured && (
        <div className="bg-amber-500/10 px-4 py-2 text-center text-xs text-amber-700 dark:text-amber-400">
          Dynamic 未配置：请在 <code>.env</code> 中设置{' '}
          <code>VITE_DYNAMIC_ENVIRONMENT_ID</code>（console.dynamic.xyz 获取）后重启
          dev server，登录与钱包功能已禁用。
        </div>
      )}
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