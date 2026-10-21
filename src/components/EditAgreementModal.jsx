import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { errorMessage, useToast } from '../context/ToastContext'
import { cleanPhone, GHANA_CARD_PATTERN, PHONE_PATTERN, SCHEDULES } from '../lib/constants'
import { updateAgreementTerms } from '../lib/db'
import { formatMoney, fromPesewas, toPesewas } from '../lib/format'
import Modal from './Modal'
import { btnSuccess, Field, inputCls, sectionTitleCls } from './ui'

export default function EditAgreementModal({ agreement, onClose }) {
  const { profile } = useAuth()
  const toast = useToast()
  const g = agreement.guarantor
  const [f, setF] = useState({
    total: fromPesewas(agreement.totalBill).toFixed(2),
    installment: agreement.installmentAmount ? fromPesewas(agreement.installmentAmount).toFixed(2) : '',
    scheduleType: agreement.scheduleType,
    nextDueDate: agreement.nextDueDate,
    finalDeadline: agreement.finalDeadline,
    gName: g.name,
    gPhone: g.phone,
    gGhanaCard: g.ghanaCard,
    gRelation: g.relation,
  })
  const [saving, setSaving] = useState(false)
  const set = (key) => (e) => setF((prev) => ({ ...prev, [key]: e.target.value }))

  async function submit() {
    const totalBill = toPesewas(f.total)
    const installmentAmount = f.installment ? toPesewas(f.installment) : 0
    if (!(totalBill > 0)) return toast('Total bill must be greater than zero.', 'error')
    if (totalBill < agreement.totalPaid) return toast(`Total bill cannot be less than the amount already paid (${formatMoney(agreement.totalPaid)}).`, 'error')
    if (!(installmentAmount >= 0)) return toast('Installment amount is not valid.', 'error')
    if (!f.nextDueDate || !f.finalDeadline) return toast('Both dates are required.', 'error')
    if (f.nextDueDate > f.finalDeadline) return toast('Next due date cannot be after the final deadline.', 'error')
    if (!GHANA_CARD_PATTERN.test(f.gGhanaCard.trim().toUpperCase())) return toast('Guarantor Ghana Card must be in the format GHA-XXXXXXXXX-X.', 'error')
    if (!PHONE_PATTERN.test(cleanPhone(f.gPhone))) return toast('Guarantor phone number is not valid.', 'error')
    if (f.gName.trim().length < 2) return toast('Guarantor name is required.', 'error')

    setSaving(true)
    try {
      await updateAgreementTerms(profile, agreement, {
        totalBill,
        installmentAmount,
        scheduleType: f.scheduleType,
        nextDueDate: f.nextDueDate,
        finalDeadline: f.finalDeadline,
        guarantor: {
          name: f.gName.trim(),
          phone: cleanPhone(f.gPhone),
          ghanaCard: f.gGhanaCard.trim().toUpperCase(),
          relation: f.gRelation.trim() || 'N/A',
        },
      })
      toast('Agreement updated.')
      onClose()
    } catch (err) {
      toast(errorMessage(err), 'error')
      setSaving(false)
    }
  }

  return (
    <Modal
      title="Edit Agreement Terms"
      subtitle={`Patient: ${agreement.patient?.name} (${agreement.patientId}) | Paid so far: ${formatMoney(agreement.totalPaid)}`}
      onClose={onClose}
      size="max-w-2xl"
      footer={
        <>
          <button onClick={onClose} className="px-4 py-2 border rounded-lg text-xs font-medium">
            Cancel
          </button>
          <button onClick={submit} disabled={saving} className={btnSuccess}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </>
      }
    >
      <h4 className={sectionTitleCls}>Bill & Schedule</h4>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Field label="Total Bill Amount (GHS)" required>
          <input type="number" step="0.01" className={inputCls} value={f.total} onChange={set('total')} />
        </Field>
        <Field label="Schedule Type">
          <select className={inputCls} value={f.scheduleType} onChange={set('scheduleType')}>
            {SCHEDULES.map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Installment Amount (GHS)">
          <input type="number" step="0.01" className={inputCls} value={f.installment} onChange={set('installment')} />
        </Field>
        <Field label="Next Payment Due Date" required>
          <input type="date" className={inputCls} value={f.nextDueDate} onChange={set('nextDueDate')} />
        </Field>
        <Field label="Final Deadline" required>
          <input type="date" className={inputCls} value={f.finalDeadline} onChange={set('finalDeadline')} />
        </Field>
      </div>

      <h4 className={sectionTitleCls}>Guarantor</h4>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field label="Guarantor Name" required>
          <input className={inputCls} value={f.gName} onChange={set('gName')} />
        </Field>
        <Field label="Guarantor Phone" required>
          <input className={inputCls} value={f.gPhone} onChange={set('gPhone')} />
        </Field>
        <Field label="Guarantor Ghana Card ID" required>
          <input className={inputCls} value={f.gGhanaCard} onChange={set('gGhanaCard')} />
        </Field>
        <Field label="Guarantor Address / Relationship" className="md:col-span-3">
          <input className={inputCls} value={f.gRelation} onChange={set('gRelation')} />
        </Field>
      </div>
    </Modal>
  )
}
