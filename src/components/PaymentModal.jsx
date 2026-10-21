import { CircleCheck, Printer } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { usePrintReceipt } from '../context/PrintContext'
import { errorMessage, useToast } from '../context/ToastContext'
import { METHODS, PAYERS } from '../lib/constants'
import { recordPayment } from '../lib/db'
import { formatMoney, toPesewas, todayStr } from '../lib/format'
import Modal from './Modal'
import { btnSuccess, Field, inputCls } from './ui'

export default function PaymentModal({ agreement, onClose }) {
  const { profile, perms } = useAuth()
  const toast = useToast()
  const printReceipt = usePrintReceipt()
  const [f, setF] = useState({ amount: '', method: 'Cash', paidBy: 'Patient', payerName: '', paidOn: todayStr(), note: '', nextDueDate: '' })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(null)
  const set = (key) => (e) => setF((prev) => ({ ...prev, [key]: e.target.value }))

  const patient = agreement.patient
  const info = `Patient: ${patient?.name} (${agreement.patientId}) | Current Balance: ${formatMoney(agreement.balance)}`

  async function submit() {
    const amount = toPesewas(f.amount)
    if (!(amount > 0)) return toast('Please enter a valid payment amount.', 'error')
    if (amount > agreement.balance) return toast(`Amount exceeds the outstanding balance of ${formatMoney(agreement.balance)}.`, 'error')
    if (!f.paidOn || f.paidOn > todayStr()) return toast('Date paid cannot be in the future.', 'error')
    if (f.nextDueDate && f.nextDueDate > agreement.finalDeadline) {
      return toast(`New due date cannot be after the final deadline (${agreement.finalDeadline}).`, 'error')
    }

    setSaving(true)
    try {
      const payment = await recordPayment(profile, agreement.id, {
        amount,
        method: f.method,
        paidBy: f.paidBy,
        payerName: f.payerName.trim(),
        paidOn: f.paidOn,
        note: f.note.trim(),
        nextDueDate: perms.canEdit ? f.nextDueDate : '',
      })
      setSaved({ payment, balanceAfter: agreement.balance - amount })
      toast(`Payment of ${formatMoney(amount)} recorded. Receipt ${payment.receiptNo}.`)
    } catch (err) {
      toast(errorMessage(err), 'error')
    } finally {
      setSaving(false)
    }
  }

  if (saved) {
    return (
      <Modal
        title="Payment Recorded"
        subtitle={`Patient: ${patient?.name} (${agreement.patientId})`}
        onClose={onClose}
        footer={
          <>
            <button onClick={onClose} className="px-4 py-2 border rounded-lg text-xs font-medium">
              Done
            </button>
            <button
              onClick={() => printReceipt({ payment: saved.payment, agreement, balanceAfter: saved.balanceAfter, printedBy: profile.name })}
              className={`${btnSuccess} flex items-center gap-1.5`}
            >
              <Printer className="w-4 h-4" /> Print Receipt
            </button>
          </>
        }
      >
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-sm text-emerald-800">
          <CircleCheck className="w-6 h-6 text-emerald-600 shrink-0" />
          <div>
            <div className="font-semibold">{formatMoney(saved.payment.amount)} received via {saved.payment.method}</div>
            <div className="text-xs">
              Receipt {saved.payment.receiptNo} · Remaining balance {formatMoney(saved.balanceAfter)}
            </div>
          </div>
        </div>
      </Modal>
    )
  }

  return (
    <Modal
      title="Record Payment Received"
      subtitle={info}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="px-4 py-2 border rounded-lg text-xs font-medium">
            Cancel
          </button>
          <button onClick={submit} disabled={saving} className={btnSuccess}>
            {saving ? 'Saving…' : 'Apply Payment'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Amount Paid Now (GHS)" required>
            <input type="number" step="0.01" min="0.01" className={inputCls} value={f.amount} onChange={set('amount')} placeholder="0.00" autoFocus />
          </Field>
          <Field label="Date Paid" required>
            <input type="date" max={todayStr()} className={inputCls} value={f.paidOn} onChange={set('paidOn')} />
          </Field>
          <Field label="Payment Method">
            <select className={inputCls} value={f.method} onChange={set('method')}>
              {METHODS.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </Field>
          <Field label="Paid By">
            <select className={inputCls} value={f.paidBy} onChange={set('paidBy')}>
              {PAYERS.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </Field>
        </div>
        {f.paidBy !== 'Patient' && (
          <Field label="Payer Name">
            <input
              className={inputCls}
              value={f.payerName}
              onChange={set('payerName')}
              placeholder={f.paidBy === 'Guarantor' ? agreement.guarantor.name : 'Name of person who paid'}
            />
          </Field>
        )}
        <Field label="Note (Optional)">
          <input className={inputCls} value={f.note} onChange={set('note')} placeholder="e.g. MoMo ref 12345678" />
        </Field>
        {perms.canEdit && (
          <Field label={`New Due Date (Optional — currently ${agreement.nextDueDate})`}>
            <input type="date" max={agreement.finalDeadline} className={inputCls} value={f.nextDueDate} onChange={set('nextDueDate')} />
          </Field>
        )}
      </div>
    </Modal>
  )
}
