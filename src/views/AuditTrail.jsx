import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { EmptyRow, panelCls } from '../components/ui'
import { useData } from '../context/DataContext'
import { formatMoney, formatTimestamp } from '../lib/format'
import { ROLES } from '../lib/roles'

const MONEY_FIELDS = new Set(['totalBill', 'installmentAmount'])

function show(field, value) {
  if (value == null) return '—'
  if (MONEY_FIELDS.has(field)) return formatMoney(value)
  if (typeof value === 'object') return Object.entries(value).map(([k, v]) => `${k}: ${v}`).join(', ')
  return String(value)
}

function Changes({ changes }) {
  if (!changes) return null
  return (
    <ul className="mt-1 space-y-0.5">
      {Object.entries(changes).map(([field, { from, to }]) => (
        <li key={field} className="text-[10px] text-slate-500">
          <span className="font-semibold">{field}</span>: <span className="line-through">{show(field, from)}</span> → {show(field, to)}
        </li>
      ))}
    </ul>
  )
}

const selectCls = 'border border-slate-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white'

export default function AuditTrail() {
  const { auditLogs, auditLimit } = useData()
  const [q, setQ] = useState('')
  const [action, setAction] = useState('')
  const [officer, setOfficer] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const actions = useMemo(() => [...new Set(auditLogs.map((l) => l.action))].sort(), [auditLogs])
  const officers = useMemo(() => [...new Set(auditLogs.map((l) => l.userName))].sort(), [auditLogs])

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return auditLogs.filter((l) => {
      const day = formatTimestamp(l.timestamp).slice(0, 10)
      return (
        (!action || l.action === action) &&
        (!officer || l.userName === officer) &&
        (!from || day >= from) &&
        (!to || day <= to) &&
        (!needle || `${l.patientRef} ${l.details} ${l.entityId}`.toLowerCase().includes(needle))
      )
    })
  }, [auditLogs, q, action, officer, from, to])

  return (
    <div className={panelCls}>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800">System Audit Trail & Security Logs</h2>
          <p className="text-xs text-slate-500">
            Full inspection log for Holy Family Hospital internal compliance. Entries are permanent and cannot be edited or deleted.
          </p>
        </div>
        <span className="bg-slate-100 text-slate-700 text-xs px-3 py-1 rounded-full font-mono border whitespace-nowrap">
          {rows.length} Events Logged
        </span>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search patient ref, details..."
            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>
        <select value={action} onChange={(e) => setAction(e.target.value)} className={selectCls} aria-label="Action type">
          <option value="">All Actions</option>
          {actions.map((a) => (
            <option key={a}>{a}</option>
          ))}
        </select>
        <select value={officer} onChange={(e) => setOfficer(e.target.value)} className={selectCls} aria-label="Officer">
          <option value="">All Officers</option>
          {officers.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={selectCls} aria-label="From date" />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={selectCls} aria-label="To date" />
      </div>

      <div className="overflow-x-auto max-h-[500px] border border-slate-200 rounded-lg">
        <table className="w-full text-xs text-left text-slate-700 excel-table">
          <thead className="bg-slate-100 border-b border-slate-300 text-slate-600 uppercase">
            <tr>
              <th className="p-3">Timestamp</th>
              <th className="p-3">Performed By (Credentials)</th>
              <th className="p-3">Role</th>
              <th className="p-3">Action Type</th>
              <th className="p-3">Patient Ref</th>
              <th className="p-3">Audit Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {rows.length === 0 && <EmptyRow colSpan={6}>No audit events match the filters.</EmptyRow>}
            {rows.map((log) => (
              <tr key={log.id} className="hover:bg-slate-50 align-top">
                <td className="p-3 font-mono text-slate-500 whitespace-nowrap">{formatTimestamp(log.timestamp)}</td>
                <td className="p-3 font-semibold text-slate-800">{log.userName}</td>
                <td className="p-3">
                  <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-sm text-[10px] font-medium border">
                    {ROLES[log.role]?.label ?? log.role}
                  </span>
                </td>
                <td className="p-3">
                  <span className="bg-sky-50 text-sky-800 px-2 py-0.5 rounded-sm text-[10px] font-semibold border border-sky-200 whitespace-nowrap">
                    {log.action}
                  </span>
                </td>
                <td className="p-3 font-mono text-slate-600">{log.patientRef || 'N/A'}</td>
                <td className="p-3 text-slate-600">
                  {log.details}
                  <Changes changes={log.changes} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {auditLogs.length >= auditLimit && (
        <p className="text-[11px] text-slate-500 mt-2">Showing the most recent {auditLimit} events.</p>
      )}
    </div>
  )
}
