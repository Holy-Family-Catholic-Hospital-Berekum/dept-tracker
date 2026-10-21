import writeXlsxFile from 'write-excel-file/browser'
import { formatTimestamp, fromPesewas, todayStr } from './format'

const header = (labels) => labels.map((value) => ({ value, fontWeight: 'bold', backgroundColor: '#F1F5F9' }))
const money = (p) => ({ value: fromPesewas(p), type: Number, format: '#,##0.00' })

export async function exportWorkbook({ agreements, exportedBy }) {
  const today = todayStr()
  const meta = [
    ['Facility', 'Holy Family Catholic Hospital, Berekum'],
    ['Exported By', exportedBy],
    ['Export Date', today],
    [],
  ]

  const master = [
    ...meta,
    header([
      'Patient ID', 'Full Name', 'Ghana Card', 'Phone', 'Location', 'Landmark',
      'Guarantor Name', 'Guarantor Phone', 'Guarantor Ghana Card', 'Guarantor Relation',
      'Total Bill (GHS)', 'Paid (GHS)', 'Balance Owing (GHS)', 'Schedule', 'Installment (GHS)',
      'Next Due Date', 'Final Deadline', 'Status', 'Payments Recorded',
    ]),
    ...agreements.map((a) => [
      a.patientId,
      a.patient?.name ?? '',
      a.patient?.ghanaCard ?? '',
      a.patient?.phone ?? '',
      a.patient?.location ?? '',
      a.patient?.landmark ?? '',
      a.guarantor.name,
      a.guarantor.phone,
      a.guarantor.ghanaCard,
      a.guarantor.relation,
      money(a.totalBill),
      money(a.totalPaid),
      money(a.balance),
      a.scheduleType,
      money(a.installmentAmount),
      a.nextDueDate,
      a.finalDeadline,
      a.status,
      a.payments.length,
    ]),
  ]

  const ledger = [
    ...meta,
    header([
      'Receipt No.', 'Date Paid', 'Patient ID', 'Patient Name', 'Type', 'Amount (GHS)', 'Method',
      'Paid By', 'Payer Name', 'Note / Reason', 'Recorded By', 'Recorded At', 'Reversed',
    ]),
    ...agreements.flatMap((a) =>
      a.payments.map((p) => [
        p.receiptNo,
        p.paidOn,
        a.patientId,
        a.patient?.name ?? '',
        p.type === 'reversal' ? 'Reversal' : 'Payment',
        money(p.amount),
        p.method,
        p.paidBy,
        p.payerName,
        p.type === 'reversal' ? p.reason : p.note,
        p.recordedByName,
        formatTimestamp(p.createdAt),
        p.reversed ? 'Yes' : '',
      ]),
    ),
  ]

  const width = (n, w = 18) => Array.from({ length: n }, () => ({ width: w }))

  await writeXlsxFile([
    { data: master, sheet: 'Master List', columns: width(19), stickyRowsCount: meta.length + 1 },
    { data: ledger, sheet: 'Payment Ledger', columns: width(13), stickyRowsCount: meta.length + 1 },
  ]).toFile(`HolyFamilyHospital_Owings_Report_${today}.xlsx`)
}
