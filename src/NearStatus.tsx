import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, ShieldCheck, ExternalLink } from 'lucide-react'

const ACCOUNT_ID = 'agentvault-xzt520.testnet'
const RPC_URL = 'https://rpc.testnet.near.org'

type ChainPolicy = {
  per_transaction_limit: string
  daily_budget: string
  approval_threshold: string
  expires_at_ns: string
  allowed_recipients: string[]
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

  if (!response.ok) throw new Error('NEAR RPC request failed.')

  const payload = await response.json()

  if (payload.error) {
    throw new Error(payload.error.message || 'NEAR RPC returned an error.')
  }

  const decoded = new TextDecoder().decode(
    new Uint8Array(payload.result.result)
  )

  return JSON.parse(decoded) as T
}

function nearAmount(yocto: string) {
  return (Number(BigInt(yocto)) / 1e24).toLocaleString('en-US', {
    maximumFractionDigits: 4
  }) + ' NEAR'
}

export default function NearStatus() {
  const [policy, setPolicy] = useState<ChainPolicy | null>(null)
  const [dailySpend, setDailySpend] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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

  useEffect(() => {
    void refresh()
  }, [refresh])

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
          <p>Live policy read directly from your deployed contract.</p>
        </div>
        <span className="live-pill"><i /> ON-CHAIN</span>
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

      {loading && (
        <p className="chain-message">
          Reading policy from NEAR testnet…
        </p>
      )}

      {!loading && error && (
        <div className="chain-error">
          <span>{error}</span>
          <button onClick={() => void refresh()}>Retry</button>
        </div>
      )}

      {!loading && policy && (
        <>
          <div className="chain-grid">
            <div>
              <small>PER-TRANSACTION LIMIT</small>
              <b>{nearAmount(policy.per_transaction_limit)}</b>
            </div>
            <div>
              <small>DAILY BUDGET</small>
              <b>{nearAmount(policy.daily_budget)}</b>
            </div>
            <div>
              <small>HUMAN APPROVAL ABOVE</small>
              <b>{nearAmount(policy.approval_threshold)}</b>
            </div>
            <div>
              <small>SPENT TODAY</small>
              <b>{nearAmount(dailySpend ?? '0')}</b>
            </div>
          </div>

          <div className="chain-footer">
            <span>Policy expires: {expiry}</span>
            <button onClick={() => void refresh()} disabled={loading}>
              <RefreshCw size={13} /> Refresh
            </button>
          </div>

          <div className="chain-recipients">
            <small>ON-CHAIN ALLOWED RECIPIENTS</small>
            {policy.allowed_recipients.map((recipient) => (
              <span key={recipient}>{recipient}</span>
            ))}
          </div>

          <p className="chain-disclaimer">
            Read-only testnet connection. No funds are transferred by this dashboard.
          </p>
        </>
      )}
    </section>
  )
                                     }
