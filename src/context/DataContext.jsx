import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore'
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { db } from '../lib/firebase'
import { agreementStatus, balanceOf, todayStr } from '../lib/format'
import { useAuth } from './AuthContext'

const DataContext = createContext(null)

const AUDIT_LIMIT = 2000

function useCollection(enabled, makeQuery) {
  const [state, setState] = useState({ docs: [], loading: true, error: null })
  useEffect(() => {
    if (!enabled) {
      setState({ docs: [], loading: false, error: null })
      return undefined
    }
    return onSnapshot(
      makeQuery(),
      (snap) => setState({ docs: snap.docs.map((d) => ({ id: d.id, ...d.data() })), loading: false, error: null }),
      (error) => setState({ docs: [], loading: false, error }),
    )
    // makeQuery is a stable inline factory; re-subscribe only when access changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled])
  return state
}

export function DataProvider({ children }) {
  const { profile, perms } = useAuth()
  const ready = Boolean(profile?.active)

  const patients = useCollection(ready, () => collection(db, 'patients'))
  const agreements = useCollection(ready, () => collection(db, 'agreements'))
  const payments = useCollection(ready, () => collection(db, 'payments'))
  const reversals = useCollection(ready, () => collection(db, 'reversals'))
  const auditLogs = useCollection(ready && perms?.canViewAudit, () =>
    query(collection(db, 'auditLogs'), orderBy('timestamp', 'desc'), limit(AUDIT_LIMIT)),
  )
  const users = useCollection(ready && (perms?.canManageUsers || perms?.canViewAudit), () => collection(db, 'users'))

  const value = useMemo(() => {
    const today = todayStr()
    const patientsById = Object.fromEntries(patients.docs.map((p) => [p.id, p]))
    const reversedIds = new Set(reversals.docs.map((r) => r.id))

    const paymentsByAgreement = {}
    for (const p of payments.docs) {
      ;(paymentsByAgreement[p.agreementId] ??= []).push({ ...p, reversed: reversedIds.has(p.id) })
    }
    for (const list of Object.values(paymentsByAgreement)) list.sort((a, b) => a.seq - b.seq)

    const rows = agreements.docs
      .map((a) => ({
        ...a,
        patient: patientsById[a.patientId] ?? null,
        balance: balanceOf(a),
        status: agreementStatus(a, today),
        payments: paymentsByAgreement[a.id] ?? [],
      }))
      .sort((a, b) => (b.createdAt?.toMillis?.() ?? Number.MAX_SAFE_INTEGER) - (a.createdAt?.toMillis?.() ?? Number.MAX_SAFE_INTEGER))

    const errors = [patients, agreements, payments, reversals, auditLogs, users].map((c) => c.error).filter(Boolean)

    return {
      loading: patients.loading || agreements.loading || payments.loading,
      error: errors[0] ?? null,
      today,
      patients: patients.docs,
      patientsById,
      agreements: rows,
      payments: payments.docs,
      auditLogs: auditLogs.docs,
      auditLimit: AUDIT_LIMIT,
      users: users.docs,
    }
  }, [patients, agreements, payments, reversals, auditLogs, users])

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  return useContext(DataContext)
}
