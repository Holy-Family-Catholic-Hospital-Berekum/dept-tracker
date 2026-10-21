import { ArcElement, BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, Tooltip } from 'chart.js'
import { Bar, Doughnut } from 'react-chartjs-2'
import { panelCls } from '../components/ui'
import { useData } from '../context/DataContext'
import { formatMoney, fromPesewas } from '../lib/format'

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend)

const options = { responsive: true, maintainAspectRatio: false }

export default function Analytics() {
  const { agreements } = useData()

  const counts = { Cleared: 0, Active: 0, Overdue: 0, Defaulted: 0 }
  let billed = 0
  let recovered = 0
  let outstanding = 0
  for (const a of agreements) {
    counts[a.status]++
    billed += a.totalBill
    recovered += a.totalPaid
    outstanding += a.balance
  }

  const statusData = {
    labels: Object.keys(counts),
    datasets: [{ data: Object.values(counts), backgroundColor: ['#10b981', '#f59e0b', '#f43f5e', '#9f1239'] }],
  }

  const financialData = {
    labels: ['Total Billed', 'Total Recovered', 'Outstanding Debt'],
    datasets: [
      {
        label: 'Amount (GHS)',
        data: [billed, recovered, outstanding].map(fromPesewas),
        backgroundColor: ['#0284c7', '#10b981', '#f43f5e'],
      },
    ],
  }

  const financialOptions = {
    ...options,
    plugins: { tooltip: { callbacks: { label: (ctx) => formatMoney(Math.round(ctx.raw * 100)) } } },
  }

  return (
    <div className={panelCls}>
      <h2 className="text-lg font-bold mb-4 text-slate-800">Financial Debt Recovery Insights — Holy Family Hospital</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="border border-slate-200 p-4 rounded-xl bg-slate-50">
          <h3 className="text-sm font-semibold text-slate-700 mb-2">Patient Debt Status Breakdown</h3>
          <div className="relative h-64">
            <Doughnut data={statusData} options={options} />
          </div>
        </div>
        <div className="border border-slate-200 p-4 rounded-xl bg-slate-50">
          <h3 className="text-sm font-semibold text-slate-700 mb-2">Total Billed vs Recovered vs Outstanding Balance</h3>
          <div className="relative h-64">
            <Bar data={financialData} options={financialOptions} />
          </div>
        </div>
      </div>
    </div>
  )
}
