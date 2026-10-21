import { Info, Lock } from 'lucide-react'
import { useState } from 'react'
import { btnPrimary, btnSecondary, Field, inputCls, Notice, panelCls, sectionTitleCls } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { errorMessage, useToast } from '../context/ToastContext'
import { cleanPhone, GHANA_CARD_PATTERN, METHODS, PAYERS, PHONE_PATTERN, SCHEDULES } from '../lib/constants'
import { FOLDER_ID_PATTERN, normalizeFolderId, registerAgreement } from '../lib/db'
import { formatMoney, toPesewas } from '../lib/format'

const EMPTY = {
  name: '', folderId: '', ghanaCard: '', phone: '', location: '', landmark: '',
  gName: '', gPhone: '', gGhanaCard: '', gRelation: '',
  total: '', paid: '0.00', scheduleType: 'Weekly', installment: '', nextDueDate: '', finalDeadline: '',
  method: 'Cash', paidBy: 'Patient', payerName: '',
}

function validate(f, existing) {
  const total = toPesewas(f.total)
  const paid = toPesewas(f.paid || '0')
  const installment = f.installment ? toPesewas(f.installment) : 0
  if (!FOLDER_ID_PATTERN.test(normalizeFolderId(f.folderId))) return 'Folder ID may only contain letters, numbers, dashes, dots and underscores.'
  if (!existing) {
    if (!GHANA_CARD_PATTERN.test(f.ghanaCard.trim().toUpperCase())) return 'Patient Ghana Card must be in the format GHA-XXXXXXXXX-X.'
    if (!PHONE_PATTERN.test(cleanPhone(f.phone))) return 'Patient phone number is not valid.'
  }
  if (!GHANA_CARD_PATTERN.test(f.gGhanaCard.trim().toUpperCase())) return 'Guarantor Ghana Card must be in the format GHA-XXXXXXXXX-X.'
  if (!PHONE_PATTERN.test(cleanPhone(f.gPhone))) return 'Guarantor phone number is not valid.'
  if (!(total > 0)) return 'Total bill must be greater than zero.'
  if (!(paid >= 0)) return 'Initial deposit is not a valid amount.'
  if (paid >= total) return 'Initial deposit must be less than the total bill (otherwise there is no debt to track).'
  if (!(installment >= 0)) return 'Installment amount is not valid.'
  if (f.nextDueDate > f.finalDeadline) return 'Next payment due date cannot be after the final deadline.'
  return null
}

export default function RegisterForm({ onSaved }) {
  const { profile, perms } = useAuth()
  const { patientsById } = useData()
  const toast = useToast()
  const [f, setF] = useState(EMPTY)
  const [saving, setSaving] = useState(false)

  const locked = !perms.canRegister
  const existing = patientsById[normalizeFolderId(f.folderId)] ?? null
  const set = (key) => (e) => setF((prev) => ({ ...prev, [key]: e.target.value }))
  const patientValue = (key) => (existing ? existing[key] : f[key])
  const deposit = toPesewas(f.paid || '0')

  async function handleSubmit(e) {
    e.preventDefault()
    if (locked) {
      toast(`Permission Denied: Your current role (${perms.label}) cannot add new patients.`, 'error')
      return
    }
    const problem = validate(f, existing)
    if (problem) {
      toast(problem, 'error')
      return
    }

    setSaving(true)
    try {
      await registerAgreement(profile, {
        existingPatient: existing,
        patient: {
          folderId: normalizeFolderId(f.folderId),
          name: f.name.trim(),
          ghanaCard: f.ghanaCard.trim().toUpperCase(),
          phone: cleanPhone(f.phone),
          location: f.location.trim(),
          landmark: f.landmark.trim(),
        },
        agreement: {
          guarantor: {
            name: f.gName.trim(),
            phone: cleanPhone(f.gPhone),
            ghanaCard: f.gGhanaCard.trim().toUpperCase(),
            relation: f.gRelation.trim() || 'N/A',
          },
          totalBill: toPesewas(f.total),
          scheduleType: f.scheduleType,
          installmentAmount: f.installment ? toPesewas(f.installment) : 0,
          nextDueDate: f.nextDueDate,
          finalDeadline: f.finalDeadline,
        },
        deposit: deposit > 0 ? { amount: deposit, method: f.method, paidBy: f.paidBy, payerName: f.payerName.trim() } : null,
      })
      toast(`Patient owing record created for ${existing?.name ?? f.name.trim()}.`)
      setF(EMPTY)
      onSaved()
    } catch (err) {
      toast(errorMessage(err), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={panelCls}>
      {locked && (
        <Notice icon={Lock}>
          <strong>Read-Only Role Active:</strong> Current logged-in role ({perms.label}) does not have permission to register new
          patients. Only the <strong>Social Worker</strong> or <strong>Accountant</strong> can register patients.
        </Notice>
      )}

      <h2 className="text-lg font-bold mb-4 text-slate-800">Register New Patient Owing Record</h2>
      <form onSubmit={handleSubmit} onReset={() => setF(EMPTY)} className="space-y-6">
        <fieldset disabled={locked || saving} className="space-y-6">
          <div>
            <h3 className={sectionTitleCls}>1. Patient Identification & Contact</h3>
            {existing && (
              <Notice icon={Info} tone="sky">
                Existing patient found: <strong>{existing.name}</strong>. A new payment agreement will be added to this patient's
                record. {perms.canEdit ? 'Edit their details from the patient history view.' : ''}
              </Notice>
            )}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Full Name" required>
                <input className={inputCls} required value={patientValue('name')} onChange={set('name')} disabled={!!existing} placeholder="e.g. Ama Serwaa" />
              </Field>
              <Field label="Patient Folder / Hospital ID" required>
                <input className={inputCls} required value={f.folderId} onChange={set('folderId')} placeholder="e.g. HFH-2026-089" />
              </Field>
              <Field label="Ghana Card ID (GHA-XXXXXXXXX-X)" required>
                <input className={inputCls} required value={patientValue('ghanaCard')} onChange={set('ghanaCard')} disabled={!!existing} placeholder="GHA-728193849-2" />
              </Field>
              <Field label="Phone Number" required>
                <input type="tel" className={inputCls} required value={patientValue('phone')} onChange={set('phone')} disabled={!!existing} placeholder="024XXXXXXX" />
              </Field>
              <Field label="Town / Location" required>
                <input className={inputCls} required value={patientValue('location')} onChange={set('location')} disabled={!!existing} placeholder="e.g. Berekum Central" />
              </Field>
              <Field label="Nearest Landmark / Hse No." required>
                <input className={inputCls} required value={patientValue('landmark')} onChange={set('landmark')} disabled={!!existing} placeholder="e.g. Opposite Berekum Market" />
              </Field>
            </div>
          </div>

          <div>
            <h3 className={sectionTitleCls}>2. Guarantor Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Guarantor Name" required>
                <input className={inputCls} required value={f.gName} onChange={set('gName')} placeholder="e.g. Kojo Oppong" />
              </Field>
              <Field label="Guarantor Phone" required>
                <input type="tel" className={inputCls} required value={f.gPhone} onChange={set('gPhone')} placeholder="055XXXXXXX" />
              </Field>
              <Field label="Guarantor Ghana Card ID" required>
                <input className={inputCls} required value={f.gGhanaCard} onChange={set('gGhanaCard')} placeholder="GHA-102938475-9" />
              </Field>
              <Field label="Guarantor Address / Relationship" className="md:col-span-3">
                <input className={inputCls} value={f.gRelation} onChange={set('gRelation')} placeholder="Brother - Resident at Sunyani Zongo" />
              </Field>
            </div>
          </div>

          <div>
            <h3 className={sectionTitleCls}>3. Financial Bill & Payment Schedule</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Total Bill Amount (GHS)" required>
                <input type="number" step="0.01" min="0.01" className={inputCls} required value={f.total} onChange={set('total')} placeholder="0.00" />
              </Field>
              <Field label="Initial Deposit Paid (GHS)">
                <input type="number" step="0.01" min="0" className={inputCls} value={f.paid} onChange={set('paid')} />
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
              <Field label="Agreed Installment Amount (GHS)">
                <input type="number" step="0.01" min="0" className={inputCls} value={f.installment} onChange={set('installment')} placeholder="e.g. 200.00" />
              </Field>
              <Field label="Next Payment Due Date" required>
                <input type="date" className={inputCls} required value={f.nextDueDate} onChange={set('nextDueDate')} />
              </Field>
              <Field label="Final Deadline (Full Payment)" required>
                <input type="date" className={inputCls} required value={f.finalDeadline} onChange={set('finalDeadline')} />
              </Field>
            </div>

            {deposit > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 p-4 bg-slate-50 border border-slate-200 rounded-lg">
                <p className="md:col-span-3 text-xs text-slate-600">
                  Initial deposit of <strong>{formatMoney(deposit)}</strong> will be recorded as the first payment.
                </p>
                <Field label="Deposit Payment Method">
                  <select className={inputCls} value={f.method} onChange={set('method')}>
                    {METHODS.map((m) => (
                      <option key={m}>{m}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Deposit Paid By">
                  <select className={inputCls} value={f.paidBy} onChange={set('paidBy')}>
                    {PAYERS.map((m) => (
                      <option key={m}>{m}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Payer Name (if not patient)">
                  <input className={inputCls} value={f.payerName} onChange={set('payerName')} placeholder="Optional" />
                </Field>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="reset" className={btnSecondary}>
              Clear Form
            </button>
            <button type="submit" className={btnPrimary}>
              {saving ? 'Saving…' : 'Save Patient Record'}
            </button>
          </div>
        </fieldset>
      </form>
    </div>
  )
}
