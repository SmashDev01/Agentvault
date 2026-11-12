
import { useMemo, useState } from 'react'
import {
  ShieldCheck, Wallet, Activity, Settings2, Plus, ArrowUpRight,
  LockKeyhole, Check, X, AlertTriangle, Bot, ChevronRight, Menu
} from 'lucide-react'
import { evaluatePayment, type Policy, type PaymentRequest } from './policy'
import NearStatus from './NearStatus'

const initialPolicy: Policy = {
  perTransactionLimit: 250,
  dailyBudget: 1000,
  spentToday: 320,
  approvalThreshold: 100,
  allowedRecipients: ['OpenAI API', 'Render Cloud', 'Supabase'],
  expiresAt: '2026-12-31T23:59:00'
}

const seed: PaymentRequest[] = [
  { id: 'AV-1048', recipient: 'OpenAI API', amount: 48, purpose: 'Model inference credits', createdAt: '2 min ago', status: 'pending' },
  { id: 'AV-1047', recipient: 'Unknown Wallet', amount: 180, purpose: 'External service payment', createdAt: '18 min ago', status: 'pending' },
  { id: 'AV-1046', recipient: 'Render Cloud', amount: 125, purpose: 'Monthly hosting', createdAt: '1 hr ago', status: 'pending' },
]

const money = (n: number) => '$' + n.toLocaleString('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})

export default function App() {
  const [policy, setPolicy] = useState(initialPolicy)
  const [requests, setRequests] = useState(seed)
  const [recipient, setRecipient] = useState('OpenAI API')
  const [amount, setAmount] = useState('75')
  const [purpose, setPurpose] = useState('Agent service payment')
  const [notice, setNotice] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)

  const spentPercent = Math.min(100, policy.spentToday / policy.dailyBudget * 100)
  const pending = requests.filter(r => r.status === 'pending')
  const usage = useMemo(() => money(policy.dailyBudget - policy.spentToday), [policy])

  function navigateTo(target: string) {
    setMenuOpen(false)

    if (target === 'agents' || target === 'settings') {
      setNotice(target === 'agents'
        ? 'Agent management is coming soon.'
        : 'Settings are coming soon.')
      return
    }

    document.getElementById(target)?.scrollIntoView({ behavior: 'smooth' })
  }

  function createRequest() {
    const value = Number(amount)

    if (!Number.isFinite(value) || value <= 0) {
      setNotice('Enter a valid payment amount.')
      return
    }

    const request: PaymentRequest = {
      id: 'AV-' + (1049 + requests.length - 3),
      recipient,
      amount: value,
      purpose,
      createdAt: 'Just now',
      status: 'pending'
    }

    const decision = evaluatePayment(policy, request)
    setRequests(prev => [request, ...prev])

    setNotice(decision.allowed
      ? (decision.needsApproval
        ? 'Request created — human approval required.'
        : 'Request created and passed policy checks.')
      : 'Request created but blocked by policy: ' + decision.reasons.join('; '))
  }

  function decide(id: string, status: 'approved' | 'rejected') {
    const target = requests.find(r => r.id === id)
    if (!target) return

    const decision = evaluatePayment(policy, target)

    if (status === 'approved' && !decision.allowed) {
      setNotice('Cannot approve: ' + decision.reasons.join('; '))
      return
    }

    setRequests(prev => prev.map(r =>
      r.id === id ? { ...r, status } : r
    ))

    if (status === 'approved') {
      setPolicy(p => ({
        ...p,
        spentToday: p.spentToday + target.amount
      }))
    }

    setNotice(status === 'approved'
      ? 'Payment marked approved in this demo.'
      : 'Payment rejected.')
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><ShieldCheck size={21} /></div>
          <span>agent<span className="brand-accent">vault</span></span>
        </div>

        <div className="workspace">
          <div className="workspace-icon">AV</div>
          <div>
            <b>Personal workspace</b>
            <small>Free sandbox</small>
          </div>
          <ChevronRight size={15} />
        </div>

        <div className="nav-label">WORKSPACE</div>
        <a className="nav-item active" onClick={() => navigateTo('overview')}>
          <Activity size={17} /> Overview
        </a>
        <a className="nav-item" onClick={() => navigateTo('payment-requests')}>
          <Wallet size={17} /> Payment requests
          <span className="nav-count">{pending.length}</span>
        </a>
        <a className="nav-item" onClick={() => navigateTo('policies')}>
          <ShieldCheck size={17} /> Policies
        </a>
        <a className="nav-item" onClick={() => navigateTo('agents')}>
          <Bot size={17} /> Agents
        </a>

        <div className="nav-label lower">PREFERENCES</div>
        <a className="nav-item" onClick={() => navigateTo('settings')}>
          <Settings2 size={17} /> Settings
        </a>

        <div className="sidebar-bottom">
          <div className="secure">
            <LockKeyhole size={15} />
            <span>Policy engine active</span>
            <i />
          </div>
          <small>AGENTVAULT SANDBOX · v0.1</small>
        </div>
      </aside>

      <main className="main">
        <header className="topbar" id="overview">
          <div className="crumb">Workspace <span>/</span> Overview</div>

          <div className="top-right">
            <span className="environment"><i /> TEST ENVIRONMENT</span>
            <div className="avatar">S</div>
            <button
              className="mobile-menu-button"
              aria-label="Open navigation menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(open => !open)}
            >
              {menuOpen ? <X size={23} /> : <Menu size={23} />}
            </button>
          </div>

          {menuOpen && (
            <div className="mobile-menu">
              <div className="mobile-menu-heading">WORKSPACE</div>
              <button onClick={() => navigateTo('overview')}>
                <Activity size={18} /> Overview
              </button>
              <button onClick={() => navigateTo('payment-requests')}>
                <Wallet size={18} /> Payment requests
                <span>{pending.length}</span>
              </button>
              <button onClick={() => navigateTo('policies')}>
                <ShieldCheck size={18} /> Policies
              </button>
              <button onClick={() => navigateTo('agents')}>
                <Bot size={18} /> Agents
              </button>
              <div className="mobile-menu-heading">PREFERENCES</div>
              <button onClick={() => navigateTo('settings')}>
                <Settings2 size={18} /> Settings
              </button>
            </div>
          )}
        </header>

        <section className="page-heading">
          <div>
            <div className="eyebrow">PAYMENT CONTROL CENTER</div>
            <h1>Good to see you.</h1>
            <p>Monitor agent spending and keep every payment within policy.</p>
          </div>
          <button
            className="primary"
            onClick={() => document.getElementById('request-form')?.scrollIntoView({ behavior: 'smooth' })}
          >
            <Plus size={17} /> New payment request
          </button>
        </section>

        {/* Live NEAR blockchain connection */}
        <NearStatus />

        {notice && (
          <div className="notice" onClick={() => setNotice('')}>
            {notice}<X size={15} />
          </div>
        )}

        <section className="stats">
          <div className="stat-card">
            <div className="stat-top">
              <span>DAILY SPEND</span>
              <span className="stat-icon purple"><Wallet size={17} /></span>
            </div>
            <strong>{money(policy.spentToday)}</strong>
            <small>of {money(policy.dailyBudget)} daily budget</small>
            <div className="progress">
              <i style={{ width: spentPercent + '%' }} />
            </div>
            <div className="stat-foot">
              {Math.round(spentPercent)}% used <b>{usage} remaining</b>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-top">
              <span>PENDING APPROVALS</span>
              <span className="stat-icon amber"><AlertTriangle size={17} /></span>
            </div>
            <strong>{pending.length.toString().padStart(2, '0')}</strong>
            <small>Requests awaiting your review</small>
            <div className="stat-link" onClick={() => navigateTo('payment-requests')}>
              Review queue <ArrowUpRight size={14} />
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-top">
              <span>POLICY STATUS</span>
              <span className="stat-icon green"><ShieldCheck size={17} /></span>
            </div>
            <strong className="status-good">Protected</strong>
            <small>All spending rules enforced</small>
            <div className="stat-link" onClick={() => navigateTo('policies')}>
              View active policy <ArrowUpRight size={14} />
            </div>
          </div>
        </section>

        <section className="content-grid">
          <div className="panel requests-panel" id="payment-requests">
            <div className="panel-head">
              <div>
                <h2>Payment requests</h2>
                <p>Review activity initiated by your agents.</p>
              </div>
              <span className="live-pill"><i /> LIVE DEMO</span>
            </div>

            {requests.length === 0 ? (
              <div className="empty">No payment requests yet.</div>
            ) : (
              <div className="request-list">
                {requests.map(r => {
                  const d = evaluatePayment(policy, r)

                  return (
                    <div className="request-row" key={r.id}>
                      <div className="request-symbol"><Bot size={18} /></div>
                      <div className="request-info">
                        <b>{r.recipient}</b>
                        <span>{r.purpose} · {r.createdAt}</span>
                        <small>{r.id}</small>
                      </div>
                      <div className="request-right">
                        <b>{money(r.amount)}</b>
                        <span className={'pill ' + (r.status === 'pending' ? 'pending' : r.status)}>
                          {r.status}
                        </span>
                      </div>

                      {r.status === 'pending' && (
                        <div className="request-actions">
                          <button title="Approve" onClick={() => decide(r.id, 'approved')}>
                            <Check size={15} />
                          </button>
                          <button title="Reject" onClick={() => decide(r.id, 'rejected')}>
                            <X size={15} />
                          </button>
                        </div>
                      )}

                      {r.status === 'pending' && !d.allowed && (
                        <div className="policy-warning">{d.reasons[0]}</div>
                      )}
                      {r.status === 'pending' && d.needsApproval && d.allowed && (
                        <div className="policy-warning approval">
                          Within policy · human approval required
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="panel policy-panel" id="policies">
            <div className="panel-head">
              <div>
                <h2>Active policy</h2>
                <p>Your agent's spending boundaries.</p>
              </div>
              <span className="shield-mini"><ShieldCheck size={18} /></span>
            </div>

            <div className="policy-item">
              <span>Per-transaction limit</span>
              <b>{money(policy.perTransactionLimit)}</b>
            </div>
            <div className="policy-item">
              <span>Daily spending budget</span>
              <b>{money(policy.dailyBudget)}</b>
            </div>
            <div className="policy-item">
              <span>Human approval above</span>
              <b>{money(policy.approvalThreshold)}</b>
            </div>
            <div className="policy-item">
              <span>Approved recipients</span>
              <b>{policy.allowedRecipients.length} services</b>
            </div>

            <div className="allowlist">
              {policy.allowedRecipients.map(x => (
                <span key={x}><Check size={12} />{x}</span>
              ))}
            </div>

            <button
              className="secondary full"
              onClick={() => setPolicy(p => ({
                ...p,
                approvalThreshold: p.approvalThreshold === 100 ? 150 : 100
              }))}
            >
              Adjust approval threshold <ArrowUpRight size={14} />
            </button>
          </div>
        </section>

        <section className="panel create-panel" id="request-form">
          <div className="panel-head">
            <div>
              <h2>Simulate an agent payment</h2>
              <p>Submit a request and let the independent policy engine evaluate it.</p>
            </div>
            <span className="demo-tag">SANDBOX</span>
          </div>

          <div className="form-grid">
            <label>
              Recipient
              <select value={recipient} onChange={e => setRecipient(e.target.value)}>
                <option>OpenAI API</option>
                <option>Render Cloud</option>
                <option>Supabase</option>
                <option>Unknown Wallet</option>
              </select>
            </label>

            <label>
              Amount (USD)
              <input
                type="number"
                min="1"
                value={amount}
                onChange={e => setAmount(e.target.value)}
              />
            </label>

            <label className="purpose-field">
              Payment purpose
              <input value={purpose} onChange={e => setPurpose(e.target.value)} />
            </label>

            <button className="primary submit" onClick={createRequest}>
              <Plus size={16} /> Evaluate request
            </button>
          </div>
        </section>

        <footer>
          <span>AGENTVAULT <b>·</b> POLICY-FIRST AGENT PAYMENTS</span>
          <span><LockKeyhole size={12} /> Demo only — no real funds are moved</span>
        </footer>
      </main>
    </div>
  )
}
