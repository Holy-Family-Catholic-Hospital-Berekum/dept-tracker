import { Pencil, Printer, Undo2 } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { usePrintReceipt } from '../context/PrintContext'
import { balanceAfterEntry, formatMoney, formatTimestamp } from '../lib/format'
import EditAgreementModal from './EditAgreementModal'
import EditPatientModal from './EditPatientModal'
import Modal from './Modal'
import ReverseModal from './ReverseModal'
import { btnSmall, EmptyRow, sectionTitleCls, StatusBadge } from './ui'

function Info({ label, children }) {
  return (
    <div>
      <div className="text-[10px] uppercase text-slate-400 font-medium">{label}</div>
      <div className="text-xs text-slate-800">{children || '—'}</div>
    </div>
  )
}

export default function AgreementDetail({ agreementId, onClose, onPay }) {
  const { profile, perms } = useAuth()
  const { agreements } = useData()
  const printReceipt = usePrintReceipt()
  const [editing, setEditing] = useState(null) // 'terms' | 'patient' | payment (reverse)

  const a = agreements.find((x) => x.id === agreementId)
  if (!a) return null
  const p = a.patient
  const others = agreements.filter((x) => x.patientId === a.patientId && x.id !== a.id)

  if (editing === 'terms') return <EditAgreementModal agreement={a} onClose={() => setEditing(null)} />
  if (editing === 'patient' && p) return <EditPatientModal patient={p} onClose={() => setEditing(null)} />
  if (editing?.id) return <ReverseModal payment={editing} onClose={() => setEditing(null)} />

  return (
    <Modal
      title={`${p?.name ?? a.patientId} — Payment History`}
      subtitle={`Folder ID ${a.patientId} · Agreement opened ${formatTimestamp(a.createdAt).slice(0, 10)}`}
      onClose={onClose}
      size="max-w-5xl"
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-slate-50 border rounded-lg p-3">
          <Info label="Total Bill">
            <span className="font-semibold">{formatMoney(a.totalBill)}</span>
          </Info>
        </div>
        <div className="bg-slate-50 border rounded-lg p-3">
          <Info label="Total Paid">
            <span className="font-semibold text-emerald-600">{formatMoney(a.totalPaid)}</span>
          </Info>
        </div>
        <div className="bg-slate-50 border rounded-lg p-3">
          <Info label="Balance Owing">
            <span className={`font-bold ${a.balance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{formatMoney(a.balance)}</span>
          </Info>
        </div>
        <div className="bg-slate-50 border rounded-lg p-3">
          <Info label="Status">
            <StatusBadge status={a.status} />
          </Info>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div>
          <div className="flex justify-between items-center">
            <h4 className={`${sectionTitleCls} flex-1`}>Patient</h4>
            {perms.canEdit && p && (
              <button onClick={() => setEditing('patient')} className="text-sky-700 hover:underline text-[11px] flex items-center gap-1 mb-3 ml-2">
                <Pencil className="w-3 h-3" /> Edit
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Info label="Ghana Card">{p?.ghanaCard}</Info>
            <Info label="Phone">{p?.phone}</Info>
            <Info label="Location">{p?.location}</Info>
            <Info label="Landmark">{p?.landmark}</Info>
          </div>
        </div>
        <div>
          <h4 className={sectionTitleCls}>Guarantor</h4>
          <div className="grid grid-cols-2 gap-3">
            <Info label="Name">{a.guarantor.name}</Info>
            <Info label="Phone">{a.guarantor.phone}</Info>
            <Info label="Ghana Card">{a.guarantor.ghanaCard}</Info>
            <Info label="Relationship">{a.guarantor.relation}</Info>
          </div>
        </div>
        <div>
          <div className="flex justify-between items-center">
            <h4 className={`${sectionTitleCls} flex-1`}>Agreement Terms</h4>
            {perms.canEdit && (
              <button onClick={() => setEditing('terms')} className="text-sky-700 hover:underline text-[11px] flex items-center gap-1 mb-3 ml-2">
                <Pencil className="w-3 h-3" /> Edit
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Info label="Schedule">{a.scheduleType}</Info>
            <Info label="Installment">{a.installmentAmount ? formatMoney(a.installmentAmount) : 'Not set'}</Info>
            <Info label="Next Due">{a.nextDueDate}</Info>
            <Info label="Final Deadline">{a.finalDeadline}</Info>
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center mb-2">
        <h4 className="text-sm font-semibold text-slate-700">Payment Ledger ({a.payments.length} entries)</h4>
        {perms.canPay && a.balance > 0 && (
          <button onClick={() => onPay(a)} className={`${btnSmall} bg-sky-600 text-white hover:bg-sky-700`}>
            + Record Payment
          </button>
        )}
      </div>
      <div className="overflow-x-auto border border-slate-200 rounded-lg">
        <table className="w-full text-xs text-left text-slate-700">
          <thead className="bg-slate-100 border-b border-slate-300 text-slate-600 uppercase">
            <tr>
              <th className="p-3">#</th>
              <th className="p-3">Date Paid</th>
              <th className="p-3">Receipt No.</th>
              <th className="p-3 text-right">Amount</th>
              <th className="p-3">Method / Paid By</th>
              <th className="p-3">Recorded By</th>
              <th className="p-3 text-right">Balance After</th>
              <th className="p-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {a.payments.length === 0 && <EmptyRow colSpan={8}>No payments recorded yet.</EmptyRow>}
            {a.payments.map((pay) => {
              const isReversal = pay.type === 'reversal'
              const balanceAfter = balanceAfterEntry(a, pay)
              return (
                <tr key={pay.id} className={isReversal ? 'bg-rose-50' : pay.reversed ? 'bg-slate-50 text-slate-400' : 'hover:bg-slate-50'}>
                  <td className="p-3 font-mono">{pay.seq}</td>
                  <td className="p-3">{pay.paidOn}</td>
                  <td className="p-3 font-mono text-[11px]">
                    {pay.receiptNo}
                    {pay.reversed && <div className="text-[10px] text-rose-600 font-sans">Reversed</div>}
                  </td>
                  <td className={`p-3 text-right font-semibold ${isReversal ? 'text-rose-600' : 'text-emerald-700'} ${pay.reversed ? 'line-through' : ''}`}>
                    {formatMoney(pay.amount)}
                  </td>
                  <td className="p-3">
                    {pay.method}
                    <div className="text-[10px] text-slate-400">
                      {pay.paidBy}
                      {pay.payerName && ` — ${pay.payerName}`}
                    </div>
                    {(pay.note || pay.reason) && (
                      <div className={`text-[10px] ${isReversal ? 'text-rose-600' : 'text-slate-500'}`}>
                        {isReversal ? `Reason: ${pay.reason}` : pay.note}
                      </div>
                    )}
                  </td>
                  <td className="p-3">
                    {pay.recordedByName}
                    <div className="text-[10px] text-slate-400 font-mono">{formatTimestamp(pay.createdAt)}</div>
                  </td>
                  <td className="p-3 text-right">{formatMoney(balanceAfter)}</td>
                  <td className="p-3">
                    <div className="flex justify-center gap-2">
                      <button
                        onClick={() => printReceipt({ payment: pay, agreement: a, balanceAfter, printedBy: profile.name })}
                        className="text-slate-500 hover:text-sky-700"
                        title="Print receipt"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                      {perms.canReverse && !isReversal && !pay.reversed && (
                        <button onClick={() => setEditing(pay)} className="text-slate-500 hover:text-rose-600" title="Reverse this payment">
                          <Undo2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {others.length > 0 && (
        <div className="mt-6">
          <h4 className="text-sm font-semibold text-slate-700 mb-2">Other Agreements for this Patient</h4>
          <ul className="text-xs divide-y border rounded-lg">
            {others.map((o) => (
              <li key={o.id} className="flex justify-between items-center p-3">
                <span>
                  Opened {formatTimestamp(o.createdAt).slice(0, 10)} · Bill {formatMoney(o.totalBill)} · Balance {formatMoney(o.balance)}
                </span>
                <StatusBadge status={o.status} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  )
}
