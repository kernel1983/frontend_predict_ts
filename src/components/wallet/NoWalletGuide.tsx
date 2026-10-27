const DOWNLOAD_URLS: { name: string; href: string }[] = [
  { name: 'Rabby Wallet', href: 'https://rabby.io/' },
  { name: 'MetaMask', href: 'https://metamask.io/download/' },
  { name: 'WalletConnect', href: 'https://walletconnect.com/network' },
  { name: 'Coinbase Wallet', href: 'https://www.coinbase.com/wallet' },
]

export function NoWalletGuide() {
  return (
    <div className="space-y-4 text-center">
      <p className="text-sm text-text">
        No wallet browser extension detected. Install any of the following
        wallets, then refresh the page.
      </p>
      <ul className="flex flex-col gap-2">
        {DOWNLOAD_URLS.map((item) => (
          <li key={item.name}>
            <a
              href={item.href}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between rounded-xl border border-border px-4 py-3 text-sm font-medium text-text-h transition-colors hover:border-accent-border"
            >
              {item.name}
              <svg viewBox="0 0 24 24" fill="none" className="size-4 text-text">
                <path
                  d="M7 17 L17 7 M9 7h8v8"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </a>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="text-sm text-accent hover:underline"
        onClick={() => window.location.reload()}
      >
        Wallet installed, re-check
      </button>
    </div>
  )
}
