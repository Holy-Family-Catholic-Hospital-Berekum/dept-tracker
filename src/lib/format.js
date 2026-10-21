// Money is stored as integer pesewas (GH₵ 1.00 = 100) to avoid floating point drift.
export function toPesewas(value) {
  const n = Number.parseFloat(value)
  if (!Number.isFinite(n)) return NaN
  return Math.round(n * 100)
}

export function fromPesewas(p) {
  return (p ?? 0) / 100
}

export function formatMoney(p) {
  return `GH₵ ${fromPesewas(p).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// Local calendar date as YYYY-MM-DD; string comparison then orders dates correctly.
export function todayStr(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function addDays(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return todayStr(new Date(y, m - 1, d + days))
}

// Adds calendar months, clamping to the last day of the target month (31 Jan + 1 month → 28/29 Feb).
export function addMonths(dateStr, months) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const lastDay = new Date(y, m - 1 + months + 1, 0).getDate()
  return todayStr(new Date(y, m - 1 + months, Math.min(d, lastDay)))
}

// Next installment date after a payment: one schedule period after the current due date
// (not the payment date, so arrears stay visible), never past the final deadline.
// Mirrored by scheduledNextDue() in firestore.rules.
export function nextDueAfterPayment({ scheduleType, nextDueDate, finalDeadline }) {
  const next = {
    Weekly: () => addDays(nextDueDate, 7),
    'Bi-Weekly': () => addDays(nextDueDate, 14),
    Monthly: () => addMonths(nextDueDate, 1),
  }[scheduleType]?.() ?? nextDueDate
  return next > finalDeadline ? finalDeadline : next
}

export function daysBetween(fromStr, toStr) {
  const [y1, m1, d1] = fromStr.split('-').map(Number)
  const [y2, m2, d2] = toStr.split('-').map(Number)
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000)
}

export function formatTimestamp(ts) {
  if (!ts) return '—'
  const date = typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts)
  return `${todayStr(date)} ${date.toTimeString().slice(0, 8)}`
}

export const STATUS = {
  Cleared: 'bg-emerald-100 text-emerald-800',
  Active: 'bg-amber-100 text-amber-800',
  Overdue: 'bg-rose-100 text-rose-800',
  Defaulted: 'bg-rose-700 text-white',
}

export function balanceOf(agreement) {
  return agreement.totalBill - agreement.totalPaid
}

// Running balance right after a given ledger entry.
export function balanceAfterEntry(agreement, entry) {
  const paid = agreement.payments.filter((p) => p.seq <= entry.seq).reduce((sum, p) => sum + p.amount, 0)
  return agreement.totalBill - paid
}

// Cleared → paid in full; Defaulted → past the final deadline; Overdue → past the next installment.
export function agreementStatus(agreement, today = todayStr()) {
  if (balanceOf(agreement) <= 0) return 'Cleared'
  if (agreement.finalDeadline < today) return 'Defaulted'
  if (agreement.nextDueDate < today) return 'Overdue'
  return 'Active'
}
