import { Building2, Cross, LogOut, ShieldCheck, UserCheck } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function Header() {
  const { profile, perms, signOut } = useAuth()

  return (
    <header className="bg-slate-900 text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col lg:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <Cross className="text-rose-500 w-7 h-7" />
          <div>
            <h1 className="text-xl font-bold tracking-wide">Patient Owings & Debt Recovery Tracker</h1>
            <p className="text-xs text-slate-400">Holy Family Hospital, Berekum — Financial Management Portal</p>
          </div>
        </div>

        {profile && (
          <div className="flex flex-wrap items-center gap-3 bg-slate-800 px-4 py-2 rounded-lg border border-slate-700 text-xs md:text-sm">
            <div className="flex items-center gap-2">
              <UserCheck className="text-emerald-400 w-4 h-4" />
              <span className="text-slate-300 font-medium hidden sm:inline">Active Officer:</span>
              <span className="bg-slate-900 text-white border border-slate-600 rounded-sm px-2 py-1 text-xs">
                {profile.name} ({perms.label})
              </span>
            </div>

            <span className="text-slate-600">|</span>

            <div className="flex items-center gap-1.5">
              <ShieldCheck className="text-amber-400 w-4 h-4" />
              <span className="bg-amber-900/60 text-amber-300 border border-amber-700 px-2 py-0.5 rounded-sm text-[11px] font-medium">
                {perms.badgeText}
              </span>
            </div>

            <span className="text-slate-600">|</span>

            <div className="flex items-center gap-2 text-slate-300">
              <Building2 className="text-sky-400 w-4 h-4" />
              <span className="font-semibold text-white">Holy Family Hospital, Berekum</span>
            </div>

            <span className="text-slate-600">|</span>

            <button
              onClick={signOut}
              className="flex items-center gap-1.5 text-slate-300 hover:text-white text-xs"
              title="Sign out"
            >
              <LogOut className="w-4 h-4 text-rose-400" /> Sign Out
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
