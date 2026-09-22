export interface WalletChallenge {
  message?: string
  nonce?: string
  domain?: string
  uri?: string
  chainId?: number
  issuedAt?: string
  expiresAt?: string
}

export interface WalletMe {
  /** 后端返回的钱包用户主键 */
  user_key?: string
  /** 钱包登录地址 */
  wallet_address?: string
  /** 各链充值地址，key 为链标识/链 id，value 为地址 */
  deposits?: Record<string, string>
  [key: string]: unknown
}

export interface WalletVerifyBody {
  message: string
  signature: string
}

export interface WalletVerifyResponse {
  ok?: boolean
  user_key?: string
  [key: string]: unknown
}