import { sendPasswordResetEmail } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { Lock } from 'lucide-react'
import { useEffect, useState } from 'react'
import { btnPrimary, Field, inputCls, Notice } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { errorMessage } from '../context/ToastContext'
import { bootstrapAccountant } from '../lib/db'
import { auth, db } from '../lib/firebase'

function Card({ title, subtitle, children }) {
  return (
    <div className="max-w-md mx-auto mt-12 bg-white rounded-xl shadow-xs border border-slate-200 p-6">
      <div className="flex items-center gap-3 mb-4">
        <img src="/icon-192.png" alt="Holy Family Catholic Hospital, Berekum" className="w-14 h-14" />
        <div>
          <h2 className="text-lg font-bold text-slate-800">{title}</h2>
          <p className="text-xs text-slate-500">{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  )
}

function SetupForm({ onCancel }) {
  const [f, setF] = useState({ name: '', email: '', password: '', confirm: '' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const set = (key) => (e) => setF((prev) => ({ ...prev, [key]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    if (f.password.length < 8) return setError('Password must be at least 8 characters.')
    if (f.password !== f.confirm) return setError('Passwords do not match.')
    setSaving(true)
    setError('')
    try {
      await bootstrapAccountant({ name: f.name.trim(), email: f.email.trim().toLowerCase(), password: f.password })
    } catch (err) {
      setError(errorMessage(err))
      setSaving(false)
    }
  }

  return (
    <Card title="First-Time System Setup" subtitle="Create the Accountant (administrator) account">
      <Notice icon={Lock}>
        This can only be done once. The account created here gets full access and creates all other staff accounts.
      </Notice>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Full Name" required>
          <input className={inputCls} required value={f.name} onChange={set('name')} placeholder="e.g. Prince Danso" />
        </Field>
        <Field label="Email" required>
          <input type="email" className={inputCls} required value={f.email} onChange={set('email')} />
        </Field>
        <Field label="Password" required>
          <input type="password" className={inputCls} required value={f.password} onChange={set('password')} autoComplete="new-password" />
        </Field>
        <Field label="Confirm Password" required>
          <input type="password" className={inputCls} required value={f.confirm} onChange={set('confirm')} autoComplete="new-password" />
        </Field>
        {error && <p className="text-xs text-rose-600">{error}</p>}
        <div className="flex justify-between items-center">
          <button type="button" onClick={onCancel} className="text-xs text-slate-500 hover:underline">
            Back to sign in
          </button>
          <button type="submit" disabled={saving} className={btnPrimary}>
            {saving ? 'Setting up…' : 'Create Administrator'}
          </button>
        </div>
      </form>
    </Card>
  )
}

export default function Login() {
  const { signIn } = useAuth()
  const [f, setF] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)
  const [needsSetup, setNeedsSetup] = useState(false)
  const [setupMode, setSetupMode] = useState(false)
  const set = (key) => (e) => setF((prev) => ({ ...prev, [key]: e.target.value }))

  useEffect(() => {
    getDoc(doc(db, 'config', 'setup'))
      .then((snap) => setNeedsSetup(!snap.exists()))
      .catch(() => setNeedsSetup(false))
  }, [])

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setInfo('')
    try {
      await signIn(f.email.trim(), f.password)
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  async function forgot() {
    setError('')
    if (!f.email.trim()) return setError('Enter your email first, then click "Forgot password".')
    try {
      await sendPasswordResetEmail(auth, f.email.trim())
      setInfo('If an account exists for that email, a password reset link has been sent.')
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  if (setupMode) return <SetupForm onCancel={() => setSetupMode(false)} />

  return (
    <Card title="Officer Sign In" subtitle="Authorised Holy Family Hospital staff only">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email" required>
          <input type="email" className={inputCls} required value={f.email} onChange={set('email')} autoComplete="username" autoFocus />
        </Field>
        <Field label="Password" required>
          <input type="password" className={inputCls} required value={f.password} onChange={set('password')} autoComplete="current-password" />
        </Field>
        {error && <p className="text-xs text-rose-600">{error}</p>}
        {info && <p className="text-xs text-emerald-700">{info}</p>}
        <div className="flex justify-between items-center">
          <button type="button" onClick={forgot} className="text-xs text-slate-500 hover:underline">
            Forgot password?
          </button>
          <button type="submit" disabled={busy} className={btnPrimary}>
            {busy ? 'Signing in…' : 'Sign In'}
          </button>
        </div>
      </form>
      {needsSetup && (
        <div className="mt-6 pt-4 border-t text-xs text-slate-600">
          No administrator has been set up yet.{' '}
          <button onClick={() => setSetupMode(true)} className="text-sky-700 font-semibold hover:underline">
            Run first-time setup
          </button>
        </div>
      )}
    </Card>
  )
}

export function NoAccess({ status }) {
  const { signOut, user } = useAuth()
  return (
    <Card
      title={status === 'inactive' ? 'Account Deactivated' : 'No Access Assigned'}
      subtitle={user?.email ?? ''}
    >
      <p className="text-sm text-slate-600 mb-4">
        {status === 'inactive'
          ? 'Your account has been deactivated. Contact the Accountant if you believe this is a mistake.'
          : 'Your sign-in is valid but no role has been assigned to this account. Contact the Accountant to get access.'}
      </p>
      <button onClick={signOut} className={btnPrimary}>
        Sign Out
      </button>
    </Card>
  )
}
