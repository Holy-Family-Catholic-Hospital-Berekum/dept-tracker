import { Download, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { btnSmall, EmptyRow, StatusBadge } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { errorMessage, useToast } from '../context/ToastContext'
import { logEvent } from '../lib/db'
import { formatMoney } from '../lib/format'

function searchText(a) {
  const p = a.patient ?? {}
  return [a.patientId, p.name, p.ghanaCard, p.phone, p.location, p.landmark, a.guarantor.name, a.guarantor.phone, a.guarantor.ghanaCard]
    .join(' ')
    .toLowerCase()
}

export default function Spreadsheet({ onPay, onView }) {
  const { profile, perms } = useAuth()
  const { agreements, loading } = useData()
  const toast = useToast()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('All')
  const [exporting, setExporting] = useState(false)

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return agreements.filter((a) => (status === 'All' || a.status === status) && (!needle || searchText(a).includes(needle)))
  }, [agreements, q, status])

  async function handleExport() {
    if (!perms.canExport) {
      toast(`Permission Denied: Your current role (${perms.label}) cannot export reports.`, 'error')
      return
    }
    setExporting(true)
    try {
      const { exportWorkbook } = await import('../lib/exportExcel')
      await exportWorkbook({ agreements, exportedBy: `${profile.name} (${perms.label})` })
      await logEvent(profile, 'Report Export', `Exported master spreadsheet and payment ledger to Excel (${agreements.length} agreements).`)
    } catch (err) {
      toast(errorMessage(err), 'error')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="bg-white p-4 rounded-b-xl shadow-xs border border-slate-200">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-4">
        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, ID, Ghana Card, town..."
              className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="border border-slate-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white"
            aria-label="Filter by status"
          >
            {['All', 'Active', 'Overdue', 'Defaulted', 'Cleared'].map((s) => (
              <option key={s} value={s}>
                {s === 'All' ? 'All Statuses' : s}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <button
            onClick={handleExport}
            disabled={exporting}
            title={perms.canExport ? '' : `Role ${perms.label} cannot export reports.`}
            className={`flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition shadow-xs ${
              perms.canExport ? '' : 'opacity-50 cursor-not-allowed'
            }`}
          >
            <Download className="w-4 h-4" /> {exporting ? 'Exporting…' : 'Export to Excel (.XLSX)'}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto max-h-[550px] border border-slate-200 rounded-lg">
        <table className="w-full text-xs text-left text-slate-700 excel-table">
          <thead className="text-xs uppercase bg-slate-100 border-b border-slate-300 text-slate-600">
            <tr>
              <th className="p-3 border-r">Patient Name & ID</th>
              <th className="p-3 border-r">Ghana Card No.</th>
              <th className="p-3 border-r">Contact & Phone</th>
              <th className="p-3 border-r">Location & Landmark</th>
              <th className="p-3 border-r">Guarantor Details</th>
              <th className="p-3 border-r">Bill / Paid (GHS)</th>
              <th className="p-3 border-r">Balance Owing</th>
              <th className="p-3 border-r">Payment Schedule</th>
              <th className="p-3 border-r">Status</th>
              <th className="p-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {loading && <EmptyRow colSpan={10}>Loading records…</EmptyRow>}
            {!loading && rows.length === 0 && (
              <EmptyRow colSpan={10}>{agreements.length ? 'No records match your search.' : 'No patient owing records yet.'}</EmptyRow>
            )}
            {rows.map((a) => (
              <tr key={a.id} className="hover:bg-slate-50 transition border-b">
                <td className="p-3 border-r font-medium text-slate-900">
                  {a.patient?.name ?? '—'}
                  <div className="text-[10px] text-slate-400">{a.patientId}</div>
                </td>
                <td className="p-3 border-r font-mono text-[11px]">{a.patient?.ghanaCard}</td>
                <td className="p-3 border-r">{a.patient?.phone}</td>
                <td className="p-3 border-r">
                  {a.patient?.location}
                  <div className="text-[10px] text-slate-400">Lm: {a.patient?.landmark}</div>
                </td>
                <td className="p-3 border-r">
                  {a.guarantor.name} ({a.guarantor.relation || 'N/A'})
                  <div className="text-[10px] text-slate-400">
                    Ph: {a.guarantor.phone} | ID: {a.guarantor.ghanaCard}
                  </div>
                </td>
                <td className="p-3 border-r">
                  <span className="text-slate-900 font-semibold">{formatMoney(a.totalBill)}</span>
                  <div className="text-[10px] text-emerald-600">Paid: {formatMoney(a.totalPaid)}</div>
                </td>
                <td className={`p-3 border-r font-bold ${a.balance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {formatMoney(a.balance)}
                </td>
                <td className="p-3 border-r">
                  {a.scheduleType}
                  {a.installmentAmount > 0 && <span className="text-slate-500"> · {formatMoney(a.installmentAmount)}</span>}
                  <div className="text-[10px] text-slate-500">Due: {a.nextDueDate}</div>
                  <div className="text-[10px] text-slate-500">Deadline: {a.finalDeadline}</div>
                </td>
                <td className="p-3 border-r">
                  <StatusBadge status={a.status} />
                </td>
                <td className="p-3 text-center">
                  <div className="flex flex-col items-center gap-1">
                    {perms.canPay && a.balance > 0 ? (
                      <button onClick={() => onPay(a)} className={`${btnSmall} bg-sky-600 text-white hover:bg-sky-700 whitespace-nowrap`}>
                        + Payment
                      </button>
                    ) : a.balance <= 0 ? (
                      <span className="text-emerald-600 font-medium text-[11px]">Paid</span>
                    ) : (
                      <span className="text-slate-400 text-[11px] italic" title="Permission required to receive payment">
                        Read Only
                      </span>
                    )}
                    <button onClick={() => onView(a)} className="text-sky-700 hover:underline text-[11px]">
                      View History
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
