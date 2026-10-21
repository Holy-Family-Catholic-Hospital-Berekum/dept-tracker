import { BellRing, ChartPie, FileText, Table, UserCog, UserPlus } from 'lucide-react'
import { lazy, Suspense, useState } from 'react'
import AgreementDetail from './components/AgreementDetail'
import Header from './components/Header'
import PaymentModal from './components/PaymentModal'
import StatsCards from './components/StatsCards'
import { Notice } from './components/ui'
import { AuthProvider, useAuth } from './context/AuthContext'
import { DataProvider, useData } from './context/DataContext'
import { PrintProvider } from './context/PrintContext'
import { errorMessage, ToastProvider } from './context/ToastContext'
import AuditTrail from './views/AuditTrail'
import FollowUp from './views/FollowUp'
import Login, { NoAccess } from './views/Login'
import RegisterForm from './views/RegisterForm'
import Spreadsheet from './views/Spreadsheet'
import Users from './views/Users'

const Analytics = lazy(() => import('./views/Analytics'))

const TABS = [
  { key: 'spreadsheet', label: 'Excel Master Spreadsheet', icon: Table },
  { key: 'analytics', label: 'Graphical Analytics', icon: ChartPie },
  { key: 'follow-up', label: 'Due & Overdue Follow-up', icon: BellRing },
  { key: 'add-patient', label: 'New Patient Record', icon: UserPlus },
  { key: 'audit', label: 'Audit Trail Log', icon: FileText, perm: 'canViewAudit' },
  { key: 'users', label: 'Staff Accounts', icon: UserCog, perm: 'canManageUsers' },
]

function Workspace() {
  const { perms } = useAuth()
  const { error } = useData()
  const [tab, setTab] = useState('spreadsheet')
  const [paying, setPaying] = useState(null)
  const [viewingId, setViewingId] = useState(null)

  const tabs = TABS.filter((t) => !t.perm || perms[t.perm])
  const view = (a) => setViewingId(a.id)

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {error && <Notice tone="rose">Could not load data: {errorMessage(error)}</Notice>}

      <StatsCards />

      <div className="flex border-b border-slate-300 bg-white rounded-t-xl px-4 gap-6 mb-0 shadow-xs overflow-x-auto">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`tab-btn py-3 text-sm flex items-center gap-2 whitespace-nowrap ${tab === key ? 'active' : 'text-slate-600'}`}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {tab === 'spreadsheet' && <Spreadsheet onPay={setPaying} onView={view} />}
      {tab === 'analytics' && (
        <Suspense fallback={<div className="bg-white p-6 rounded-b-xl border text-sm text-slate-500">Loading charts…</div>}>
          <Analytics />
        </Suspense>
      )}
      {tab === 'follow-up' && <FollowUp onView={view} />}
      {tab === 'add-patient' && <RegisterForm onSaved={() => setTab('spreadsheet')} />}
      {tab === 'audit' && perms.canViewAudit && <AuditTrail />}
      {tab === 'users' && perms.canManageUsers && <Users />}

      {viewingId && !paying && (
        <AgreementDetail agreementId={viewingId} onClose={() => setViewingId(null)} onPay={setPaying} />
      )}
      {paying && <PaymentModal agreement={paying} onClose={() => setPaying(null)} />}
    </div>
  )
}

function Root() {
  const { status } = useAuth()
  return (
    <>
      <Header />
      {status === 'loading' && <p className="text-center text-sm text-slate-500 mt-16">Loading…</p>}
      {status === 'signedOut' && <Login />}
      {(status === 'noProfile' || status === 'inactive') && <NoAccess status={status} />}
      {status === 'ready' && (
        <DataProvider>
          <Workspace />
        </DataProvider>
      )}
    </>
  )
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <PrintProvider>
          <Root />
        </PrintProvider>
      </AuthProvider>
    </ToastProvider>
  )
}
