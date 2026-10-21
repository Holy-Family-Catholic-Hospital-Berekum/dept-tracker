import { useState } from 'react'
import { EmptyRow, panelCls, StatusBadge } from '../components/ui'
import { useData } from '../context/DataContext'
import { addDays, daysBetween, formatMoney } from '../lib/format'

const WINDOWS = [
  [7, 'Next 7 days'],
  [14, 'Next 14 days'],
  [30, 'Next 30 days'],
]

function Section({ title, tone, rows, today, dateKey, onView }) {
  return (
    <div className="mb-8">
      <h3 className={`text-sm font-semibold uppercase tracking-wider mb-3 border-b pb-1 ${tone}`}>
        {title} <span className="text-slate-400 font-normal normal-case">({rows.length})</span>
      </h3>
      <div className="overflow-x-auto border border-slate-200 rounded-lg">
        <table className="w-full text-xs text-left text-slate-700">
          <thead className="bg-slate-100 border-b border-slate-300 text-slate-600 uppercase">
            <tr>
              <th className="p-3">Patient</th>
              <th className="p-3">Patient Phone</th>
              <th className="p-3">Guarantor & Phone</th>
              <th className="p-3">Location</th>
              <th className="p-3 text-right">Balance</th>
              <th className="p-3">Installment</th>
              <th className="p-3">{dateKey === 'finalDeadline' ? 'Final Deadline' : 'Due Date'}</th>
              <th className="p-3">Days</th>
              <th className="p-3">Status</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {rows.length === 0 && <EmptyRow colSpan={10}>Nobody in this list.</EmptyRow>}
            {rows.map((a) => {
              const days = daysBetween(today, a[dateKey])
              return (
                <tr key={a.id} className="hover:bg-slate-50">
                  <td className="p-3 font-medium text-slate-900">
                    {a.patient?.name}
                    <div className="text-[10px] text-slate-400">{a.patientId}</div>
                  </td>
                  <td className="p-3 font-mono">
                    <a href={`tel:${a.patient?.phone}`} className="text-sky-700 hover:underline">
                      {a.patient?.phone}
                    </a>
                  </td>
                  <td className="p-3">
                    {a.guarantor.name}
                    <div className="font-mono text-[11px]">
                      <a href={`tel:${a.guarantor.phone}`} className="text-sky-700 hover:underline">
                        {a.guarantor.phone}
                      </a>
                    </div>
                  </td>
                  <td className="p-3">
                    {a.patient?.location}
                    <div className="text-[10px] text-slate-400">Lm: {a.patient?.landmark}</div>
                  </td>
                  <td className="p-3 text-right font-bold text-rose-600">{formatMoney(a.balance)}</td>
                  <td className="p-3">{a.installmentAmount ? formatMoney(a.installmentAmount) : '—'}</td>
                  <td className="p-3">{a[dateKey]}</td>
                  <td className={`p-3 font-semibold ${days < 0 ? 'text-rose-600' : 'text-amber-600'}`}>
                    {days < 0 ? `${-days} overdue` : days === 0 ? 'Today' : `in ${days}`}
                  </td>
                  <td className="p-3">
                    <StatusBadge status={a.status} />
                  </td>
                  <td className="p-3">
                    <button onClick={() => onView(a)} className="text-sky-700 hover:underline text-[11px] whitespace-nowrap">
                      View History
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function FollowUp({ onView }) {
  const { agreements, today } = useData()
  const [windowDays, setWindowDays] = useState(7)
  const horizon = addDays(today, windowDays)

  const open = agreements.filter((a) => a.balance > 0)
  const byDate = (key) => (x, y) => x[key].localeCompare(y[key])
  const defaulted = open.filter((a) => a.status === 'Defaulted').sort(byDate('finalDeadline'))
  const overdue = open.filter((a) => a.status === 'Overdue').sort(byDate('nextDueDate'))
  const upcoming = open.filter((a) => a.status === 'Active' && a.nextDueDate <= horizon).sort(byDate('nextDueDate'))
  const deadlines = open
    .filter((a) => a.status !== 'Defaulted' && a.finalDeadline <= horizon)
    .sort(byDate('finalDeadline'))

  return (
    <div className={panelCls}>
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-3 mb-6">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Due & Overdue Follow-up</h2>
          <p className="text-xs text-slate-500">Patients to call or visit. Click a phone number to dial on a mobile device.</p>
        </div>
        <select
          value={windowDays}
          onChange={(e) => setWindowDays(Number(e.target.value))}
          className="border border-slate-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white"
          aria-label="Upcoming window"
        >
          {WINDOWS.map(([d, label]) => (
            <option key={d} value={d}>
              Upcoming: {label}
            </option>
          ))}
        </select>
      </div>

      <Section title="Past Final Deadline (Defaulted)" tone="text-rose-800" rows={defaulted} today={today} dateKey="finalDeadline" onView={onView} />
      <Section title="Overdue Installments" tone="text-rose-600" rows={overdue} today={today} dateKey="nextDueDate" onView={onView} />
      <Section title="Installments Due Soon" tone="text-amber-600" rows={upcoming} today={today} dateKey="nextDueDate" onView={onView} />
      <Section title="Final Deadlines Approaching" tone="text-sky-600" rows={deadlines} today={today} dateKey="finalDeadline" onView={onView} />
    </div>
  )
}
