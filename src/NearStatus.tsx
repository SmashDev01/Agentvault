
import { useCallback, useEffect, useState } from 'react'
import { NearConnector } from '@hot-labs/near-connect'
import SignClient from '@walletconnect/sign-client'
import {
  RefreshCw,
  ShieldCheck,
  ExternalLink,
  Wallet,
  LogOut
} from 'lucide-react'

const ACCOUNT_ID = 'agentvault-xzt520.testnet'
const RPC_URL = 'https://rpc.testnet.near.org'
const REOWN_PROJECT_ID = '9d0ddacb457a7cef532b476119d80f6f'

const walletConnect = SignClient.init({
  projectId: REOWN_PROJECT_ID,
  metadata: {
    name: 'AgentVault',
    description: 'Secure spending policies for AI agents on NEAR',
    url: 'https://agentvault-lac.vercel.app',
    icons: ['https://agentvault-lac.vercel.app/favicon.ico']
  }
})

const connector = new NearConnector({
  network: 'testnet',
  features: { testnet: true },
  footerBranding: null,
  walletConnect
})

type ChainPolicy = {
  per_transaction_limit: string
  daily_budget: string
  approval_threshold: string
  expires_at_ns: string
  allowed_recipients: string[]
}

type SignInEvent = {
  accounts: Array<{ accountId: string }>
}

async function viewMethod<T>(methodName: string): Promise<T> {
  const response = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 'agentvault-read',
      method: 'query',
      params: {
        request_type: 'call_function',
        finality: 'final',
        account_id: ACCOUNT_ID,
        method_name: methodName,
        args_base64: 'e30='
      }
    })
  })

  if (!response.ok) {
    throw new Error('NEAR RPC request failed.')
  }

  const payload = await response.json()

  if (payload.error) {
    throw new Error(
      payload.error.message || 'NEAR RPC returned an error.'
    )
  }

  const decoded = new TextDecoder().decode(
    new Uint8Array(payload.result.result)
  )

  return JSON.parse(decoded) as T
}

function nearValue(yocto: string) {
  return Number(BigInt(yocto)) / 1e24
}

function nearAmount(yocto: string) {
  return nearValue(yocto).toLocaleString('en-US', {
    maximumFractionDigits: 4
  }) + ' NEAR'
}

function usdAmount(yocto: string, price: number | null) {
  if (price === null) return 'USD rate unavailable'

  return (nearValue(yocto) * price).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2
  })
}

export default function NearStatus() {
  const [policy, setPolicy] = useState<ChainPolicy | null>(null)
  const [dailySpend, setDailySpend] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [walletAccount, setWalletAccount] = useState('')
  const [walletLoading, setWalletLoading] = useState(false)
  const [walletError, setWalletError] = useState('')
  const [nearUsd, setNearUsd] = useState<number | null>(null)
  const [priceUpdatedAt, setPriceUpdatedAt] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const [nextPolicy, spend] = await Promise.all([
        viewMethod<ChainPolicy>('get_policy'),
        viewMethod<string>('get_daily_spend')
      ])

      setPolicy(nextPolicy)
      setDailySpend(spend)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not read the NEAR contract.'
      )
    } finally {
      setLoading(false)
    }
  }, [])

  const syncWallet = useCallback(async (
    attempts = 1,
    finishLoading = false
  ) => {
    for (let i = 0; i < attempts; i++) {
      try {
        const wallet = await connector.wallet()
        const accounts = await wallet.getAccounts()

        if (accounts?.length && accounts[0]?.accountId) {
          setWalletAccount(accounts[0].accountId)
          setWalletError('')
          setWalletLoading(false)
          return true
        }
      } catch {
        // Wallet may still be restoring its mobile session.
      }

      if (i < attempts - 1) {
        await new Promise(resolve => setTimeout(resolve, 700))
      }
    }

    if (finishLoading) {
      setWalletLoading(false)
      setWalletError(
        'Wallet approval was not detected. Please try connecting again.'
      )
    }

    return false
  }, [])

  // Load live NEAR/USD market price.
  useEffect(() => {
    let active = true

    const loadPrice = async () => {
      try {
        const response = await fetch(
          'https://api.coingecko.com/api/v3/simple/price?ids=near&vs_currencies=usd'
        )

        if (!response.ok) {
          throw new Error('Price service unavailable')
        }

        const data = await response.json()
        const price = Number(data?.near?.usd)

        if (active && Number.isFinite(price) && price > 0) {
          setNearUsd(price)
          setPriceUpdatedAt(new Date().toLocaleTimeString())
        }
      } catch {
        // Keep the previous valid price if refresh fails.
      }
    }

    void loadPrice()
    const timer = window.setInterval(loadPrice, 60000)

    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    let active = true

    const handleSignIn = (event: SignInEvent) => {
      if (active && event.accounts?.length) {
        setWalletAccount(event.accounts[0].accountId)
        setWalletError('')
        setWalletLoading(false)
      }
    }

    const handleSignOut = () => {
      if (active) {
        setWalletAccount('')
        setWalletLoading(false)
        setWalletError('')
      }
    }

    const handleReturnToBrowser = () => {
      if (
        active &&
        document.visibilityState === 'visible'
      ) {
        void syncWallet(5, true)
      }
    }

    connector.on('wallet:signIn', handleSignIn)
    connector.on('wallet:signOut', handleSignOut)

    void syncWallet(2, false)

    window.addEventListener('focus', handleReturnToBrowser)
    document.addEventListener(
      'visibilitychange',
      handleReturnToBrowser
    )

    return () => {
      active = false
      window.removeEventListener('focus', handleReturnToBrowser)
      document.removeEventListener(
        'visibilitychange',
        handleReturnToBrowser
      )
    }
  }, [syncWallet])

  async function connectWallet() {
    setWalletLoading(true)
    setWalletError('')

    try {
      await connector.connect()

      const connected = await syncWallet(8, false)

      if (!connected) {
        setWalletLoading(false)
        setWalletError(
          'Connection was not confirmed. Please try again or select another NEAR wallet.'
        )
      }
    } catch (err) {
      setWalletError(
        err instanceof Error
          ? err.message
          : 'Wallet connection failed. Please try again.'
      )
      setWalletLoading(false)
    }
  }

  async function disconnectWallet() {
    setWalletLoading(true)
    setWalletError('')

    try {
      const wallet = await connector.wallet()
      await wallet.signOut()
      setWalletAccount('')
    } catch (err) {
      setWalletError(
        err instanceof Error
          ? err.message
          : 'Could not disconnect wallet.'
      )
    } finally {
      setWalletLoading(false)
    }
  }

  const expiry = policy
    ? new Date(
        Number(BigInt(policy.expires_at_ns) / 1000000n)
      ).toLocaleString()
    : ''

  return (
    <section className="panel chain-panel">
      <div className="panel-head">
        <div>
          <h2>NEAR testnet connection</h2>
          <p>
            Live policy read directly from your deployed contract.
          </p>
        </div>
        <span className="live-pill">
          <i /> ON-CHAIN
        </span>
      </div>

      <div className="chain-account">
        <ShieldCheck size={17} />
        <span>{ACCOUNT_ID}</span>
        <a
          href="https://testnet.nearblocks.io/address/agentvault-xzt520.testnet"
          target="_blank"
          rel="noreferrer"
          aria-label="View account on NEARBlocks"
        >
          <ExternalLink size={14} />
        </a>
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        margin: '16px 0'
      }}>
        <div style={{ minWidth: 0 }}>
          <small style={{
            display: 'block',
            opacity: 0.65,
            marginBottom: 5
          }}>
            WALLET STATUS
          </small>

          <b style={{ overflowWrap: 'anywhere' }}>
            {walletAccount || 'No wallet connected'}
          </b>

          {!walletAccount && (
            <small style={{
              display: 'block',
              opacity: 0.65,
              marginTop: 5
            }}>
              NEAR wallets and supported WalletConnect wallets
            </small>
          )}
        </div>

        <button
          onClick={() => void (
            walletAccount
              ? disconnectWallet()
              : connectWallet()
          )}
          disabled={walletLoading}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: '10px 14px',
            borderRadius: 10,
            border: '1px solid rgba(140,120,255,.35)',
            background: 'rgba(120,95,255,.14)',
            color: 'inherit',
            fontWeight: 700,
            cursor: walletLoading ? 'wait' : 'pointer'
          }}
        >
          {walletAccount
            ? <LogOut size={15} />
            : <Wallet size={15} />
          }

          {walletLoading
            ? 'Checking wallet…'
            : walletAccount
              ? 'Disconnect'
              : 'Choose NEAR Wallet'
          }
        </button>
      </div>

      {walletError && (
        <p className="chain-error">{walletError}</p>
      )}

      {loading && (
        <p className="chain-message">
          Reading policy from NEAR testnet…
        </p>
      )}

      {!loading && error && (
        <div className="chain-error">
          <span>{error}</span>
          <button onClick={() => void refresh()}>
            Retry
          </button>
        </div>
      )}

      {!loading && policy && (
        <>
          <div className="chain-grid">
            <div>
              <small>PER-TRANSACTION LIMIT</small>
              <b>{nearAmount(policy.per_transaction_limit)}</b>
              <small className="currency-equivalent">
                ≈ {usdAmount(policy.per_transaction_limit, nearUsd)} USD
              </small>
            </div>

            <div>
              <small>DAILY BUDGET</small>
              <b>{nearAmount(policy.daily_budget)}</b>
              <small className="currency-equivalent">
                ≈ {usdAmount(policy.daily_budget, nearUsd)} USD
              </small>
            </div>

            <div>
              <small>HUMAN APPROVAL ABOVE</small>
              <b>{nearAmount(policy.approval_threshold)}</b>
              <small className="currency-equivalent">
                ≈ {usdAmount(policy.approval_threshold, nearUsd)} USD
              </small>
            </div>

            <div>
              <small>SPENT TODAY</small>
              <b>{nearAmount(dailySpend ?? '0')}</b>
              <small className="currency-equivalent">
                ≈ {usdAmount(dailySpend ?? '0', nearUsd)} USD
              </small>
            </div>
          </div>

          <div className="chain-footer">
            <span>
              Policy expires: {expiry}
              <br />
              NEAR/USD: {nearUsd === null
                ? 'Loading price…'
                : `$${nearUsd.toLocaleString('en-US')}`}
              {priceUpdatedAt && ` · Updated ${priceUpdatedAt}`}
            </span>

            <button
              onClick={() => void refresh()}
              disabled={loading}
            >
              <RefreshCw size={13} /> Refresh
            </button>
          </div>

          <div className="chain-recipients">
            <small>ON-CHAIN ALLOWED RECIPIENTS</small>
            {policy.allowed_recipients.map(recipient => (
              <span key={recipient}>{recipient}</span>
            ))}
          </div>

          <p className="chain-disclaimer">
            USD values are estimates using the live market rate.
            NEAR remains the currency used for on-chain policy enforcement.
            Wallet connection does not transfer funds.
          </p>
        </>
      )}
    </section>
  )
}
