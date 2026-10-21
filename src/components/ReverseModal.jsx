import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { errorMessage, useToast } from '../context/ToastContext'
import { reversePayment } from '../lib/db'
import { formatMoney } from '../lib/format'
import Modal from './Modal'
import { Field, inputCls } from './ui'

export default function ReverseModal({ payment, onClose }) {
  const { profile } = useAuth()
  const toast = useToast()
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit() {
    if (reason.trim().length < 5) return toast('Please give a reason for the reversal (at least 5 characters).', 'error')
    setSaving(true)
    try {
      await reversePayment(profile, payment.id, reason.trim())
      toast(`Payment ${payment.receiptNo} reversed.`)
      onClose()
    } catch (err) {
      toast(errorMessage(err), 'error')
      setSaving(false)
    }
  }

  return (
    <Modal
      title="Reverse Payment"
      subtitle={`Receipt ${payment.receiptNo} · ${formatMoney(payment.amount)} on ${payment.paidOn} · recorded by ${payment.recordedByName}`}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="px-4 py-2 border rounded-lg text-xs font-medium">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="px-4 py-2 bg-rose-600 text-white rounded-lg text-xs font-semibold hover:bg-rose-700 disabled:opacity-50"
          >
            {saving ? 'Reversing…' : 'Post Reversal'}
          </button>
        </>
      }
    >
      <p className="text-xs text-slate-600 mb-4">
        The original payment stays in the history. A reversal entry of {formatMoney(-payment.amount)} is added and the balance goes
        back up. This cannot be undone and is recorded in the audit trail.
      </p>
      <Field label="Reason for Reversal" required>
        <textarea rows={3} className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Amount entered as 500 instead of 50" autoFocus />
      </Field>
    </Modal>
  )
}
