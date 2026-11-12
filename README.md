# AgentVault

AgentVault is a policy firewall for AI-agent spending. An agent can propose a payment, but a separate deterministic policy engine checks it before it can be approved.

## MVP features
- Per-transaction spending cap
- Daily spending budget
- Recipient allowlist
- Policy expiry
- Human approval threshold
- Payment request queue and activity status
- Deterministic policy evaluation module

## Run locally
```bash
npm install
npm run dev
```

## Build
```bash
npm run build
```

## Important demo limitation
This version is a front-end sandbox. It simulates requests and approval state in browser memory. It does **not** connect a wallet, submit NEAR transactions, or move real funds. Production enforcement must happen in a trusted backend and/or smart contract; never rely on UI checks or an LLM to enforce spending limits.
