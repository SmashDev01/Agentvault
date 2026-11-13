
import { useState } from 'react'
import { connector } from './NearStatus'
import { Plus, Loader2 } from 'lucide-react'

const ACCOUNT_ID = 'agentvault-xzt520.testnet'
const OWNER_ID = 'smasj01.testnet'
const RPC_URL = 'https://rpc.testnet.near.org'
const YOCTO = 10n ** 24n

function toYocto(value: string): string {
  const parts = value.trim().split('.')
  if (!/^\d+$/.test(parts[0]) || parts.length > 2) {
    throw new Error('Enter a valid NEAR amount.')
  }

  const decimals = parts[1] || ''
  if (!/^\d*$/.test(decimals) || decimals.length > 24) {
    throw new Error('Maximum 24 decimal places allowed.')
  }

  return (
    BigInt(parts[0]) * YOCTO +
    BigInt((decimals + '0'.repeat(24)).slice(0, 24))
  ).toString()
}

async function readContract(method: string) {
  const response = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 'agentvault-submit',
      method: 'query',
      params: {
        request_type: 'call_function',
        finality: 'final',
        account_id: ACCOUNT_ID,
        method_name: method,
        args_base64: 'e30='
      }
    })
  })

  const data = await response.json()
  if (data.error) throw new Error(data.error.message)

  return JSON.parse(
    new TextDecoder().decode(new Uint8Array(data.result.result))
  )
}

export default function OnChainRequestForm() {
  const [amount, setAmount] = useState('1')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function submit() {
    setBusy(true)
    setMessage('')
    setError('')

    try {
      const wallet = await connector.wallet()
      const accounts = await wallet.getAccounts()
      const account = accounts?.[0]?.accountId

      if (account !== OWNER_ID) {
        throw new Error('Connect the smasj01.testnet wallet first.')
      }

      const yoctoAmount = toYocto(amount)

      if (BigInt(yoctoAmount) <= 0n) {
        throw new Error('Amount must be greater than zero.')
      }

      const policy = await readContract('get_policy')
      const spent = await readContract('get_daily_spend')

      if (BigInt(yoctoAmount) > BigInt(policy.per_transaction_limit)) {
        throw new Error('Request exceeds the transaction limit.')
      }

      if (BigInt(yoctoAmount) > BigInt(policy.daily_budget) - BigInt(spent)) {
        throw new Error('Not enough daily budget remaining.')
      }

      setMessage('Please confirm the transaction in your wallet...')

      await wallet.signAndSendTransaction({
        receiverId: ACCOUNT_ID,
        actions: [{
          type: 'FunctionCall',
          params: {
            methodName: 'submit_request',
            args: {
              recipient: ACCOUNT_ID,
              amount: yoctoAmount
            },
            gas: '100000000000000',
            deposit: '0'
          }
        }]
      })

      setMessage(
        'Transaction signing completed. Refresh the on-chain request history to check its status.'
      )
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Request submission failed.'
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="panel" style={{ marginBottom: 22 }}>
      <div className="panel-head">
        <div>
          <h2>Submit an on-chain request</h2>
          <p>Send a spending request to the deployed NEAR contract.</p>
        </div>
        <span className="live-pill"><i /> TESTNET</span>
      </div>

      <label style={{ display: 'block', marginBottom: 12 }}>
        Request amount (NEAR)
        <input
          type="number"
          min="0"
          max="5"
          step="0.01"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          disabled={busy}
          style={{ display: 'block', width: '100%', marginTop: 8 }}
        />
      </label>

      <p style={{ fontSize: 12, opacity: 0.7 }}>
        Recipient: {ACCOUNT_ID}
      </p>

      <button
        className="primary"
        onClick={() => void submit()}
        disabled={busy}
      >
        {busy ? <Loader2 size={16} /> : <Plus size={16} />}
        {busy ? 'Submitting...' : 'Submit NEAR request'}
      </button>

      {message && (
        <p className="chain-message" style={{ marginTop: 12 }}>
          {message}
        </p>
      )}

      {error && (
        <p className="chain-error" style={{ marginTop: 12 }}>
          {error}
        </p>
      )}

      <p style={{ fontSize: 11, opacity: 0.65, marginTop: 12 }}>
        Testnet accounting only. This contract does not transfer funds.
        Wallet transaction fees may apply.
      </p>
    </section>
  )
}
