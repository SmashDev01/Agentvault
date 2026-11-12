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
  status: 'pending' | 'approved' | 'rejected'
}
export type Decision = { allowed: boolean; needsApproval: boolean; reasons: string[] }

export function evaluatePayment(policy: Policy, request: PaymentRequest): Decision {
  const reasons: string[] = []
  if (Date.now() > new Date(policy.expiresAt).getTime()) reasons.push('Policy has expired')
  if (request.amount <= 0) reasons.push('Payment amount must be greater than zero')
  if (request.amount > policy.perTransactionLimit) reasons.push('Exceeds per-transaction limit')
  if (policy.spentToday + request.amount > policy.dailyBudget) reasons.push('Would exceed daily spending budget')
  if (!policy.allowedRecipients.map(x => x.toLowerCase()).includes(request.recipient.toLowerCase())) {
    reasons.push('Recipient is not on the allowlist')
  }
  const needsApproval = reasons.length === 0 && request.amount >= policy.approvalThreshold
  return { allowed: reasons.length === 0, needsApproval, reasons }
}
