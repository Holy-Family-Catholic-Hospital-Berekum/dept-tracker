import { useState } from 'react'
import { btnPrimary, EmptyRow, Field, inputCls, panelCls, sectionTitleCls } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { errorMessage, useToast } from '../context/ToastContext'
import { createStaff, sendStaffPasswordReset, updateStaff } from '../lib/db'
import { formatTimestamp } from '../lib/format'
import { ROLE_KEYS, ROLES } from '../lib/roles'

const EMPTY = { name: '', email: '', password: '', role: 'social_worker' }

export default function Users() {
  const { profile } = useAuth()
  const { users } = useData()
  const toast = useToast()
  const [f, setF] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [busy, setBusy] = useState(null)
  const set = (key) => (e) => setF((prev) => ({ ...prev, [key]: e.target.value }))

  async function handleCreate(e) {
    e.preventDefault()
    if (f.password.length < 8) return toast('Temporary password must be at least 8 characters.', 'error')
    setSaving(true)
    try {
      await createStaff(profile, { name: f.name.trim(), email: f.email.trim().toLowerCase(), password: f.password, role: f.role })
      toast(`Account created for ${f.name.trim()}. Share the temporary password with them privately.`)
      setF(EMPTY)
    } catch (err) {
      toast(errorMessage(err), 'error')
    } finally {
      setSaving(false)
    }
  }

  async function run(user, fn, message) {
    setBusy(user.id)
    try {
      await fn()
      toast(message)
    } catch (err) {
      toast(errorMessage(err), 'error')
    } finally {
      setBusy(null)
    }
  }

  const sorted = [...users].sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name))

  return (
    <div className={panelCls}>
      <h2 className="text-lg font-bold mb-4 text-slate-800">Staff Accounts & Access Control</h2>

      <form onSubmit={handleCreate} className="mb-8">
        <h3 className={sectionTitleCls}>Create Staff Account</h3>
        <fieldset disabled={saving} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
          <Field label="Full Name" required>
            <input className={inputCls} required value={f.name} onChange={set('name')} placeholder="e.g. Pius Henneh" />
          </Field>
          <Field label="Email (used to sign in)" required>
            <input type="email" className={inputCls} required value={f.email} onChange={set('email')} placeholder="name@example.com" />
          </Field>
          <Field label="Temporary Password" required>
            <input type="text" className={inputCls} required minLength={8} value={f.password} onChange={set('password')} placeholder="Min. 8 characters" autoComplete="off" />
          </Field>
          <Field label="Role">
            <select className={inputCls} value={f.role} onChange={set('role')}>
              {ROLE_KEYS.map((r) => (
                <option key={r} value={r}>
                  {ROLES[r].label}
                </option>
              ))}
            </select>
          </Field>
          <button type="submit" className={btnPrimary}>
            {saving ? 'Creating…' : 'Create Account'}
          </button>
        </fieldset>
        <p className="text-[11px] text-slate-500 mt-2">
          Ask the officer to change their password with "Send Password Reset" after their first sign-in.
        </p>
      </form>

      <h3 className={sectionTitleCls}>Staff ({users.length})</h3>
      <div className="overflow-x-auto border border-slate-200 rounded-lg">
        <table className="w-full text-xs text-left text-slate-700">
          <thead className="bg-slate-100 border-b border-slate-300 text-slate-600 uppercase">
            <tr>
              <th className="p-3">Name</th>
              <th className="p-3">Email</th>
              <th className="p-3">Role</th>
              <th className="p-3">Status</th>
              <th className="p-3">Created</th>
              <th className="p-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {users.length === 0 && <EmptyRow colSpan={6}>No staff accounts.</EmptyRow>}
            {sorted.map((u) => {
              const isSelf = u.id === profile.uid
              const disabled = busy === u.id
              return (
                <tr key={u.id} className={u.active ? 'hover:bg-slate-50' : 'bg-slate-50 text-slate-400'}>
                  <td className="p-3 font-semibold">
                    {u.name}
                    {isSelf && <span className="text-[10px] text-sky-600 font-normal"> (you)</span>}
                  </td>
                  <td className="p-3">{u.email}</td>
                  <td className="p-3">
                    <select
                      value={u.role}
                      disabled={isSelf || disabled}
                      onChange={(e) =>
                        run(u, () => updateStaff(profile, u, { role: e.target.value }), `${u.name} is now ${ROLES[e.target.value].label}.`)
                      }
                      className="border rounded-sm px-2 py-1 text-xs bg-white disabled:bg-slate-100"
                      title={isSelf ? 'You cannot change your own role' : ''}
                    >
                      {ROLE_KEYS.map((r) => (
                        <option key={r} value={r}>
                          {ROLES[r].label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        u.active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {u.active ? 'Active' : 'Deactivated'}
                    </span>
                  </td>
                  <td className="p-3 font-mono text-slate-500">{formatTimestamp(u.createdAt).slice(0, 10)}</td>
                  <td className="p-3">
                    <div className="flex justify-center gap-3">
                      <button
                        disabled={disabled}
                        onClick={() => run(u, () => sendStaffPasswordReset(profile, u), `Password reset email sent to ${u.email}.`)}
                        className="text-sky-700 hover:underline text-[11px] disabled:opacity-50"
                      >
                        Send Password Reset
                      </button>
                      {!isSelf && (
                        <button
                          disabled={disabled}
                          onClick={() =>
                            run(
                              u,
                              () => updateStaff(profile, u, { active: !u.active }),
                              `${u.name} ${u.active ? 'deactivated' : 'reactivated'}.`,
                            )
                          }
                          className={`text-[11px] hover:underline disabled:opacity-50 ${u.active ? 'text-rose-600' : 'text-emerald-600'}`}
                        >
                          {u.active ? 'Deactivate' : 'Reactivate'}
                        </button>
                      )}
                    </div>
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
