import { CircleCheck, CircleDollarSign, TriangleAlert, Users } from 'lucide-react'
import { useData } from '../context/DataContext'
import { formatMoney } from '../lib/format'

function Card({ icon: Icon, tone, label, value }) {
  return (
    <div className="bg-white p-4 rounded-xl shadow-xs border border-slate-200 flex items-center gap-4">
      <div className={`p-3 rounded-lg ${tone}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <p className="text-xs text-slate-500 font-medium uppercase">{label}</p>
        <h3 className="text-2xl font-bold text-slate-800">{value}</h3>
      </div>
    </div>
  )
}

export default function StatsCards() {
  const { agreements } = useData()

  let owings = 0
  let recovered = 0
  let overdue = 0
  const debtors = new Set()
  for (const a of agreements) {
    recovered += a.totalPaid
    if (a.balance > 0) {
      owings += a.balance
      debtors.add(a.patientId)
    }
    if (a.status === 'Overdue' || a.status === 'Defaulted') overdue += a.balance
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <Card icon={Users} tone="bg-sky-100 text-sky-600" label="Total Debtors" value={debtors.size} />
      <Card icon={CircleDollarSign} tone="bg-amber-100 text-amber-600" label="Total Owings (GHS)" value={formatMoney(owings)} />
      <Card icon={CircleCheck} tone="bg-emerald-100 text-emerald-600" label="Total Recovered" value={formatMoney(recovered)} />
      <Card icon={TriangleAlert} tone="bg-rose-100 text-rose-600" label="Overdue Amount" value={formatMoney(overdue)} />
    </div>
  )
}
