import { Check, X } from 'lucide-react'
import { PASSWORD_RULES } from '../lib/password'

export default function PasswordChecklist({ password, className = '' }) {
  return (
    <ul className={`grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0.5 text-[11px] ${className}`}>
      {PASSWORD_RULES.map(({ label, test }) => {
        const ok = test(password)
        return (
          <li key={label} className={`flex items-center gap-1 ${ok ? 'text-emerald-600' : 'text-slate-400'}`}>
            {ok ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />} {label}
          </li>
        )
      })}
    </ul>
  )
}
