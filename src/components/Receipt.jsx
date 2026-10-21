import { formatMoney, formatTimestamp } from '../lib/format'

function Row({ label, value, strong }) {
  return (
    <div className="flex justify-between py-1.5 border-b border-dashed border-slate-300 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className={strong ? 'font-bold text-slate-900' : 'text-slate-800'}>{value}</span>
    </div>
  )
}

// Printed via PrintContext into #print-root (see index.css @media print).
export default function Receipt({ payment, agreement, balanceAfter, printedBy, printedAt }) {
  const patient = agreement.patient
  const isReversal = payment.type === 'reversal'
  return (
    <div className="max-w-[148mm] mx-auto text-slate-800 font-sans">
      <div className="text-center border-b-2 border-slate-800 pb-3 mb-4">
        <h1 className="text-lg font-bold tracking-wide">HOLY FAMILY CATHOLIC HOSPITAL, BEREKUM</h1>
        <p className="text-xs text-slate-600">Social Welfare Unit — Patient Debt Recovery</p>
        <h2 className="mt-3 text-base font-semibold uppercase">{isReversal ? 'Payment Reversal Slip' : 'Payment Receipt'}</h2>
      </div>

      <Row label="Receipt No." value={payment.receiptNo} strong />
      <Row label="Date Paid" value={payment.paidOn} />
      <Row label="Patient" value={`${patient?.name ?? '—'} (${agreement.patientId})`} />
      <Row label="Ghana Card" value={patient?.ghanaCard ?? '—'} />
      <Row label="Total Bill" value={formatMoney(agreement.totalBill)} />
      <Row label={isReversal ? 'Amount Reversed' : 'Amount Paid'} value={formatMoney(Math.abs(payment.amount))} strong />
      <Row label="Payment Method" value={payment.method} />
      <Row label="Paid By" value={`${payment.paidBy}${payment.payerName ? ` — ${payment.payerName}` : ''}`} />
      <Row label="Balance After This Payment" value={formatMoney(balanceAfter)} strong />
      {payment.note && <Row label="Note" value={payment.note} />}
      {isReversal && <Row label="Reversal Reason" value={payment.reason} />}
      <Row label="Recorded By" value={payment.recordedByName} />
      <Row label="Final Deadline" value={agreement.finalDeadline} />

      <div className="grid grid-cols-2 gap-10 mt-12 text-xs text-center">
        <div className="border-t border-slate-500 pt-1">Received By (Signature)</div>
        <div className="border-t border-slate-500 pt-1">Payer (Signature)</div>
      </div>

      <p className="mt-8 text-[10px] text-slate-500 text-center">
        Printed {formatTimestamp(printedAt)} by {printedBy}. Please keep this slip as proof of payment.
      </p>
    </div>
  )
}
