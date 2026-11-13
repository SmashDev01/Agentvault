
import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, Activity, ExternalLink, Check, X } from 'lucide-react'
import { connector } from './NearStatus'

const ACCOUNT_ID = 'agentvault-xzt520.testnet'
const OWNER_ID = 'smasj01.testnet'
const RPC_URL = 'https://rpc.testnet.near.org'

type ChainRequest = {
  id: number
  requester: string
  recipient: string
  amount: string
  status: 'Approved' | 'PendingApproval' | 'Rejected'
  created_at_ns: string
}

function nearValue(value: string) {
  return Number(BigInt(value)) / 1e24
}

function nearAmount(value: string) {
  return nearValue(value).toLocaleString('en-US', {
    maximumFractionDigits: 4
  }) + ' NEAR'
}

function usdAmount(value: string, price: number | null) {
  if (price === null) return 'USD rate unavailable'

  return (nearValue(value) * price).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2
  }) + ' USD'
}

async function readRequests(): Promise<ChainRequest[]> {
  const response = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 'agentvault-requests',
      method: 'query',
      params: {
        request_type: 'call_function',
        finality: 'final',
        account_id: ACCOUNT_ID,
        method_name: 'get_recent_requests',
        args_base64: 'e30='
      }
    })
  })

  if (!response.ok) throw new Error('NEAR RPC request failed.')

  const payload = await response.json()

  if (payload.error) {
    throw new Error(payload.error.message || 'Could not read requests.')
  }

  return JSON.parse(
    new TextDecoder().decode(
      new Uint8Array(payload.result.result)
    )
  ) as ChainRequest[]
}

export default function OnChainRequests() {
  const [requests, setRequests] = useState<ChainRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [nearUsd, setNearUsd] = useState<number | null>(null)
  const [owner, setOwner] = useState(false)
  const [actionId, setActionId] = useState<number | null>(null)
  const [message, setMessage] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const data = await readRequests()
      setRequests(data.reverse())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load requests.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    let active = true

    async function checkOwner() {
      try {
        const wallet = await connector.wallet()
        const accounts = await wallet.getAccounts()

        if (active) {
          setOwner(accounts?.[0]?.accountId === OWNER_ID)
        }
      } catch {
        if (active) setOwner(false)
      }
    }

    void checkOwner()

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true

    const loadPrice = async () => {
      try {
        const response = await fetch(
          'https://api.coingecko.com/api/v3/simple/price?ids=near&vs_currencies=usd'
        )

        if (!response.ok) throw new Error('Price service unavailable')

        const data = await response.json()
        const price = Number(data?.near?.usd)

        if (active && Number.isFinite(price) && price > 0) {
          setNearUsd(price)
        }
      } catch {
        // Keep the previous valid rate.
      }
    }

    void loadPrice()
    const timer = window.setInterval(loadPrice, 60000)

    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [])

  async function handleDecision(
    requestId: number,
    decision: 'approve_request' | 'reject_request'
  ) {
    setActionId(requestId)
    setMessage('')
    setError('')

    try {
      const wallet = await connector.wallet()
      const accounts = await wallet.getAccounts()
      const account = accounts?.[0]?.accountId

      if (account !== OWNER_ID) {
        throw new Error('Connect the smasj01.testnet owner wallet first.')
      }

      setMessage('Please confirm the action in Intear Wallet...')

      await wallet.signAndSendTransaction({
        receiverId: ACCOUNT_ID,
        actions: [{
          type: 'FunctionCall',
          params: {
            methodName: decision,
            args: { request_id: requestId },
            gas: '100000000000000',
            deposit: '0'
          }
        }]
      })

      setMessage(
        decision === 'approve_request'
          ? 'Approval transaction submitted. Refreshing request history...'
          : 'Rejection transaction submitted. Refreshing request history...'
      )

      await new Promise(resolve => setTimeout(resolve, 2500))
      await refresh()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Owner action failed.'
      )
    } finally {
      setActionId(null)
    }
  }

  return (
    <section className="panel chain-requests-panel">
      <div className="panel-head">
        <div>
          <h2>On-chain payment requests</h2>
          <p>Verified request history from your deployed NEAR contract.</p>
        </div>
        <span className="live-pill"><i /> BLOCKCHAIN</span>
      </div>

      {message && (
        <p className="chain-message">{message}</p>
      )}

      {loading && (
        <p className="chain-message">Loading requests from NEAR testnet…</p>
      )}

      {!loading && error && (
        <div className="chain-error">
          <span>{error}</span>
          <button onClick={() => void refresh()}>Retry</button>
        </div>
      )}

      {!loading && !error && requests.length === 0 && (
        <div className="chain-empty">
          <Activity size={25} />
          <b>No on-chain requests yet</b>
          <span>New requests submitted through the connected contract will appear here.</span>
        </div>
      )}

      {!loading && !error && requests.length > 0 && (
        <div className="chain-request-list">
          {requests.map(request => (
            <div className="chain-request-row" key={request.id}>
              <div className="chain-request-info">
                <b>{request.recipient}</b>
                <span>Request #{request.id} · {request.requester}</span>
                <small>
                  {new Date(
                    Number(BigInt(request.created_at_ns) / 1000000n)
                  ).toLocaleString()}
                </small>
              </div>

              <div className="chain-request-right">
                <b>{nearAmount(request.amount)}</b>
                <small className="currency-equivalent">
                  ≈ {usdAmount(request.amount, nearUsd)} USD
                </small>

                <span className={'pill ' + (
                  request.status === 'PendingApproval'
                    ? 'pending'
                    : request.status === 'Approved'
                      ? 'approved'
                      : 'rejected'
                )}>
                  {request.status === 'PendingApproval'
                    ? 'Pending'
                    : request.status}
                </span>

                {owner && request.status === 'PendingApproval' && (
                  <div style={{
                    display: 'flex',
                    gap: 8,
                    marginTop: 10,
                    flexWrap: 'wrap'
                  }}>
                    <button
                      className="primary"
                      disabled={actionId !== null}
                      onClick={() => void handleDecision(
                        request.id,
                        'approve_request'
                      )}
                    >
                      <Check size={14} />
                      {actionId === request.id ? 'Processing...' : 'Approve'}
                    </button>

                    <button
                      disabled={actionId !== null}
                      onClick={() => void handleDecision(
                        request.id,
                        'reject_request'
                      )}
                    >
                      <X size={14} />
                      Reject
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="chain-requests-footer">
        <span>NEAR testnet · USD is an estimate</span>

        <button onClick={() => void refresh()} disabled={loading}>
          <RefreshCw size={13} /> Refresh
        </button>

        <a
          href="https://testnet.nearblocks.io/address/agentvault-xzt520.testnet"
          target="_blank"
          rel="noreferrer"
        >
          Explorer <ExternalLink size={13} />
        </a>
      </div>
    </section>
  )
}
