import { STATUS } from '../lib/format'

// Class names taken from the original mock (Tailwind v3 `rounded` = v4 `rounded-sm`).
export const inputCls =
  'w-full border p-2 text-sm rounded-sm focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:bg-slate-100 disabled:text-slate-500 bg-white'
export const labelCls = 'block text-xs font-medium text-slate-700 mb-1'
export const sectionTitleCls = 'text-sm font-semibold text-sky-600 uppercase tracking-wider mb-3 border-b pb-1'
export const panelCls = 'bg-white p-6 rounded-b-xl shadow-xs border border-slate-200'

export const btnPrimary =
  'px-6 py-2 bg-sky-600 text-white rounded-lg text-sm font-semibold hover:bg-sky-700 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed'
export const btnSecondary =
  'px-5 py-2 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50'
export const btnSuccess =
  'px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed'
export const btnSmall = 'px-2 py-1 rounded-sm text-[11px] transition'

export function Field({ label, required, children, className = '' }) {
  return (
    <div className={className}>
      <label className={labelCls}>
        {label}
        {required && ' *'}
      </label>
      {children}
    </div>
  )
}

export function StatusBadge({ status }) {
  return <span className={`${STATUS[status]} px-2 py-0.5 rounded-full text-[10px] font-semibold`}>{status}</span>
}

export function Notice({ icon: Icon, children, tone = 'amber' }) {
  const tones = {
    amber: 'bg-amber-50 border-amber-500 text-amber-800',
    rose: 'bg-rose-50 border-rose-500 text-rose-800',
    sky: 'bg-sky-50 border-sky-500 text-sky-800',
  }
  return (
    <div className={`${tones[tone]} border-l-4 p-4 mb-4 text-sm`}>
      <div className="flex items-center gap-2">
        {Icon && <Icon className="w-5 h-5 shrink-0" />}
        <span>{children}</span>
      </div>
    </div>
  )
}

export function EmptyRow({ colSpan, children }) {
  return (
    <tr>
      <td colSpan={colSpan} className="p-6 text-center text-slate-400 italic">
        {children}
      </td>
    </tr>
  )
}
