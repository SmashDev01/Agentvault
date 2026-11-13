
export type Policy = {
  perTransactionLimit: number
  dailyBudget: number
  spentToday: number
  approvalThreshold: number
  allowedRecipients: string[]
  expiresAt: string
}

export type PaymentRequest = {
  id: string
  recipient: string
  amount: number
  purpose: string
  createdAt: string
  status: 'pending' | 'approved' | 'rejected' | 'blocked'
}

export type Decision = {
  allowed: boolean
  needsApproval: boolean
  reasons: string[]
}

export function evaluatePayment(
  policy: Policy,
  request: PaymentRequest
): Decision {
  const reasons: string[] = []

  const expiry = new Date(policy.expiresAt).getTime()

  if (!Number.isFinite(expiry) || Date.now() > expiry) {
    reasons.push('Policy has expired or has an invalid expiry date')
  }

  if (!Number.isFinite(request.amount) || request.amount <= 0) {
    reasons.push('Payment amount must be greater than zero')
  }

  if (
    !Number.isFinite(policy.perTransactionLimit) ||
    request.amount > policy.perTransactionLimit
  ) {
    reasons.push('Exceeds per-transaction limit')
  }

  if (
    !Number.isFinite(policy.dailyBudget) ||
    !Number.isFinite(policy.spentToday) ||
    policy.spentToday + request.amount > policy.dailyBudget
  ) {
    reasons.push('Would exceed daily spending budget')
  }

  const allowedRecipients = policy.allowedRecipients.map(
    recipient => recipient.trim().toLowerCase()
  )

  if (!allowedRecipients.includes(request.recipient.trim().toLowerCase())) {
    reasons.push('Recipient is not on the allowlist')
  }

  // Match the NEAR contract's demonstrated threshold rule:
  // only amounts strictly greater than the threshold need approval.
  const needsApproval =
    reasons.length === 0 &&
    request.amount > policy.approvalThreshold

  return {
    allowed: reasons.length === 0,
    needsApproval,
    reasons
  }
}
