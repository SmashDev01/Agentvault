
import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, Activity, ExternalLink } from 'lucide-react'

const ACCOUNT_ID = 'agentvault-xzt520.testnet'
const RPC_URL = 'https://rpc.testnet.near.org'

type ChainRequest = {
  id: number
  requester: string
  recipient: string
  amount: string
  status: 'Approved' | 'PendingApproval' | 'Rejected'
  created_at_ns: string
}

function nearAmount(value: string) {
  return (Number(BigInt(value)) / 1e24).toLocaleString('en-US', {
    maximumFractionDigits: 4
  }) + ' NEAR'
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
  if (payload.error) throw new Error(payload.error.message || 'Could not read requests.')

  const decoded = new TextDecoder().decode(
    new Uint8Array(payload.result.result)
  )

  return JSON.parse(decoded) as ChainRequest[]
}

export default function OnChainRequests() {
  const [requests, setRequests] = useState<ChainRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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

  return (
    <section className="panel chain-requests-panel">
      <div className="panel-head">
        <div>
          <h2>On-chain payment requests</h2>
          <p>Verified request history from your deployed NEAR contract.</p>
        </div>
        <span className="live-pill"><i /> BLOCKCHAIN</span>
      </div>

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
                  {new Date(Number(BigInt(request.created_at_ns) / 1000000n)).toLocaleString()}
                </small>
              </div>
              <div className="chain-request-right">
                <b>{nearAmount(request.amount)}</b>
                <span className={'pill ' + (
                  request.status === 'PendingApproval'
                    ? 'pending'
                    : request.status === 'Approved'
                      ? 'approved'
                      : 'rejected'
                )}>
                  {request.status === 'PendingApproval' ? 'Pending' : request.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="chain-requests-footer">
        <span>Read-only · NEAR testnet</span>
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
