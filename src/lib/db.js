// All writes go through here. Each one commits its audit entry in the same batch or
// transaction, which firestore.rules requires (no audit entry → write rejected).
import { deleteApp, initializeApp } from 'firebase/app'
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
  sendPasswordResetEmail,
  signOut,
} from 'firebase/auth'
import { collection, doc, runTransaction, serverTimestamp, writeBatch } from 'firebase/firestore'
import { auth, db, firebaseConfig, useEmulators } from './firebase'
import { formatMoney, todayStr } from './format'

const newAuditRef = () => doc(collection(db, 'auditLogs'))

// Document IDs used to build paths must be a single segment (no "/" to escape the collection).
const DOC_ID_PATTERN = /^[A-Za-z0-9._-]{1,128}$/

function assertDocId(id) {
  if (typeof id !== 'string' || !DOC_ID_PATTERN.test(id)) throw new Error('Invalid record reference.')
  return id
}

function auditEntry(profile, { action, entityType = '', entityId = '', patientRef = '', details = '', changes = null }) {
  return {
    timestamp: serverTimestamp(),
    uid: profile.uid,
    userName: profile.name,
    role: profile.role,
    action,
    entityType,
    entityId,
    patientRef,
    details,
    changes,
  }
}

function createStamp(profile, auditId) {
  return {
    createdAt: serverTimestamp(),
    createdBy: profile.uid,
    updatedAt: serverTimestamp(),
    updatedBy: profile.uid,
    lastAuditId: auditId,
  }
}

function updateStamp(profile, auditId) {
  return { updatedAt: serverTimestamp(), updatedBy: profile.uid, lastAuditId: auditId }
}

// Records only the fields that actually changed, as { field: { from, to } }.
function diffFields(before, after) {
  const changes = {}
  for (const key of Object.keys(after)) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      changes[key] = { from: before[key] ?? null, to: after[key] }
    }
  }
  return changes
}

function receiptNumber(agreementId, seq, paidOn) {
  return `RCT-${paidOn.replaceAll('-', '')}-${agreementId.slice(0, 5).toUpperCase()}-${seq}`
}

function ledgerEntry(profile, { agreementId, patientId, seq, auditId, ...fields }) {
  return {
    agreementId,
    patientId,
    seq,
    type: 'payment',
    note: '',
    payerName: '',
    reversesPaymentId: null,
    reason: null,
    ...fields,
    recordedBy: profile.uid,
    recordedByName: profile.name,
    createdAt: serverTimestamp(),
    auditId,
  }
}

export function normalizeFolderId(value) {
  return value.trim().toUpperCase().replace(/\s+/g, '-')
}

export const FOLDER_ID_PATTERN = /^[A-Z0-9][A-Z0-9._-]{1,59}$/

// ---------- patients & agreements ----------

export async function registerAgreement(profile, { patient, existingPatient, agreement, deposit }) {
  const batch = writeBatch(db)
  const auditRef = newAuditRef()
  const agreementRef = doc(collection(db, 'agreements'))
  const patientId = existingPatient ? existingPatient.folderId : patient.folderId

  if (!existingPatient) {
    batch.set(doc(db, 'patients', assertDocId(patientId)), { ...patient, ...createStamp(profile, auditRef.id) })
  }

  const depositAmount = deposit?.amount ?? 0
  batch.set(agreementRef, {
    patientId,
    ...agreement,
    totalPaid: depositAmount,
    paymentCount: depositAmount > 0 ? 1 : 0,
    ...createStamp(profile, auditRef.id),
  })

  if (depositAmount > 0) {
    const paidOn = todayStr()
    batch.set(
      doc(db, 'payments', `${agreementRef.id}_1`),
      ledgerEntry(profile, {
        agreementId: agreementRef.id,
        patientId,
        seq: 1,
        auditId: auditRef.id,
        amount: depositAmount,
        method: deposit.method,
        paidBy: deposit.paidBy,
        payerName: deposit.payerName,
        paidOn,
        receiptNo: receiptNumber(agreementRef.id, 1, paidOn),
        note: 'Initial deposit',
      }),
    )
  }

  const name = existingPatient ? existingPatient.name : patient.name
  batch.set(
    auditRef,
    auditEntry(profile, {
      action: existingPatient ? 'New Agreement' : 'Patient Registration',
      entityType: 'agreement',
      entityId: agreementRef.id,
      patientRef: patientId,
      details:
        `${existingPatient ? 'New payment agreement for existing patient' : 'Registered patient'} ${name}. ` +
        `Total bill ${formatMoney(agreement.totalBill)}, initial deposit ${formatMoney(depositAmount)}, ` +
        `${agreement.scheduleType} schedule, final deadline ${agreement.finalDeadline}.`,
    }),
  )

  await batch.commit()
  return agreementRef.id
}

export async function updatePatient(profile, patient, changes) {
  const diff = diffFields(patient, changes)
  if (Object.keys(diff).length === 0) return
  const auditRef = newAuditRef()
  const batch = writeBatch(db)
  batch.update(doc(db, 'patients', assertDocId(patient.folderId)), { ...changes, ...updateStamp(profile, auditRef.id) })
  batch.set(
    auditRef,
    auditEntry(profile, {
      action: 'Patient Details Edit',
      entityType: 'patient',
      entityId: patient.folderId,
      patientRef: patient.folderId,
      details: `Edited ${Object.keys(diff).join(', ')} for ${patient.name}.`,
      changes: diff,
    }),
  )
  await batch.commit()
}

export async function updateAgreementTerms(profile, agreement, changes) {
  const diff = diffFields(agreement, changes)
  if (Object.keys(diff).length === 0) return
  const auditRef = newAuditRef()
  const batch = writeBatch(db)
  batch.update(doc(db, 'agreements', assertDocId(agreement.id)), { ...changes, ...updateStamp(profile, auditRef.id) })
  batch.set(
    auditRef,
    auditEntry(profile, {
      action: 'Agreement Edit',
      entityType: 'agreement',
      entityId: agreement.id,
      patientRef: agreement.patientId,
      details: `Edited ${Object.keys(diff).join(', ')} on agreement for ${agreement.patient?.name ?? agreement.patientId}.`,
      changes: diff,
    }),
  )
  await batch.commit()
}

// ---------- ledger ----------

export async function recordPayment(profile, agreementId, { amount, method, paidBy, payerName, paidOn, note, nextDueDate }) {
  return runTransaction(db, async (tx) => {
    const agreementRef = doc(db, 'agreements', assertDocId(agreementId))
    const snap = await tx.get(agreementRef)
    if (!snap.exists()) throw new Error('Agreement not found.')
    const a = snap.data()
    const balance = a.totalBill - a.totalPaid
    if (amount > balance) throw new Error(`Amount exceeds the outstanding balance of ${formatMoney(balance)}.`)

    const seq = a.paymentCount + 1
    const paymentId = `${agreementId}_${seq}`
    const auditRef = newAuditRef()
    const payment = ledgerEntry(profile, {
      agreementId,
      patientId: a.patientId,
      seq,
      auditId: auditRef.id,
      amount,
      method,
      paidBy,
      payerName,
      paidOn,
      note,
      receiptNo: receiptNumber(agreementId, seq, paidOn),
    })

    const update = { totalPaid: a.totalPaid + amount, paymentCount: seq, ...updateStamp(profile, auditRef.id) }
    if (nextDueDate && nextDueDate !== a.nextDueDate) update.nextDueDate = nextDueDate

    tx.set(doc(db, 'payments', paymentId), payment)
    tx.update(agreementRef, update)
    tx.set(
      auditRef,
      auditEntry(profile, {
        action: 'Payment Collection',
        entityType: 'payment',
        entityId: paymentId,
        patientRef: a.patientId,
        details:
          `Collected ${formatMoney(amount)} via ${method} from ${paidBy}${payerName ? ` (${payerName})` : ''}, ` +
          `receipt ${payment.receiptNo}. Remaining balance: ${formatMoney(balance - amount)}.` +
          (update.nextDueDate ? ` Next due date moved from ${a.nextDueDate} to ${update.nextDueDate}.` : ''),
      }),
    )
    return { ...payment, id: paymentId, createdAt: new Date() }
  })
}

export async function reversePayment(profile, paymentId, reason) {
  const safePaymentId = assertDocId(paymentId)
  return runTransaction(db, async (tx) => {
    const paymentRef = doc(db, 'payments', safePaymentId)
    const markerRef = doc(db, 'reversals', safePaymentId)
    const original = await tx.get(paymentRef)
    if (!original.exists()) throw new Error('Payment not found.')
    const p = original.data()
    if (p.type !== 'payment') throw new Error('Only payments can be reversed.')

    const agreementRef = doc(db, 'agreements', assertDocId(p.agreementId))
    const [agreementSnap, markerSnap] = await Promise.all([tx.get(agreementRef), tx.get(markerRef)])
    if (markerSnap.exists()) throw new Error('This payment has already been reversed.')
    const a = agreementSnap.data()

    const seq = a.paymentCount + 1
    const reversalId = `${p.agreementId}_${seq}`
    const auditRef = newAuditRef()
    tx.set(
      doc(db, 'payments', reversalId),
      ledgerEntry(profile, {
        agreementId: p.agreementId,
        patientId: p.patientId,
        seq,
        auditId: auditRef.id,
        type: 'reversal',
        amount: -p.amount,
        method: p.method,
        paidBy: p.paidBy,
        payerName: p.payerName,
        paidOn: todayStr(),
        receiptNo: `${p.receiptNo}-REV`,
        reversesPaymentId: paymentId,
        reason,
      }),
    )
    tx.set(markerRef, { reversalId, createdBy: profile.uid, createdAt: serverTimestamp() })
    tx.update(agreementRef, { totalPaid: a.totalPaid - p.amount, paymentCount: seq, ...updateStamp(profile, auditRef.id) })
    tx.set(
      auditRef,
      auditEntry(profile, {
        action: 'Payment Reversal',
        entityType: 'payment',
        entityId: reversalId,
        patientRef: p.patientId,
        details: `Reversed payment ${p.receiptNo} of ${formatMoney(p.amount)}. Reason: ${reason}`,
      }),
    )
  })
}

// ---------- staff accounts ----------

// A second Firebase app instance creates the login, so the accountant stays signed in.
export async function createStaff(profile, { name, email, password, role }) {
  const secondary = initializeApp(firebaseConfig, `staff-${Date.now()}`)
  const secondaryAuth = getAuth(secondary)
  if (useEmulators) connectAuthEmulator(secondaryAuth, 'http://127.0.0.1:9099', { disableWarnings: true })
  let uid
  try {
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password)
    uid = cred.user.uid
    await signOut(secondaryAuth)
  } finally {
    await deleteApp(secondary)
  }

  const auditRef = newAuditRef()
  const batch = writeBatch(db)
  batch.set(doc(db, 'users', uid), { name, email, role, active: true, ...createStamp(profile, auditRef.id) })
  batch.set(
    auditRef,
    auditEntry(profile, {
      action: 'Staff Account Created',
      entityType: 'user',
      entityId: uid,
      details: `Created account for ${name} (${email}) with role ${role}.`,
    }),
  )
  await batch.commit()
}

export async function updateStaff(profile, user, changes) {
  const diff = diffFields(user, changes)
  if (Object.keys(diff).length === 0) return
  const auditRef = newAuditRef()
  const batch = writeBatch(db)
  batch.update(doc(db, 'users', assertDocId(user.id)), { ...changes, ...updateStamp(profile, auditRef.id) })
  batch.set(
    auditRef,
    auditEntry(profile, {
      action: 'Staff Account Edit',
      entityType: 'user',
      entityId: user.id,
      details: `Updated ${Object.keys(diff).join(', ')} for ${user.name} (${user.email}).`,
      changes: diff,
    }),
  )
  await batch.commit()
}

export async function sendStaffPasswordReset(profile, user) {
  await sendPasswordResetEmail(auth, user.email)
  await logEvent(profile, 'Password Reset Sent', `Sent password reset email to ${user.name} (${user.email}).`, {
    entityType: 'user',
    entityId: user.id,
  })
}

// First run only: the rules allow exactly one self-created accountant, guarded by config/setup.
export async function bootstrapAccountant({ name, email, password }) {
  const cred = await createUserWithEmailAndPassword(auth, email, password)
  const uid = cred.user.uid
  const profile = { uid, name, role: 'accountant' }
  const auditRef = newAuditRef()
  const batch = writeBatch(db)
  batch.set(doc(db, 'users', uid), { name, email: cred.user.email, role: 'accountant', active: true, ...createStamp(profile, auditRef.id) })
  batch.set(doc(db, 'config', 'setup'), { completedBy: uid, completedAt: serverTimestamp() })
  batch.set(
    auditRef,
    auditEntry(profile, {
      action: 'System Setup',
      entityType: 'user',
      entityId: uid,
      details: `Initial accountant (administrator) account created for ${name} (${email}).`,
    }),
  )
  try {
    await batch.commit()
  } catch (err) {
    await cred.user.delete().catch(() => {})
    throw err
  }
}

// Audit-only events (sign in, exports, ...).
export async function logEvent(profile, action, details, extra = {}) {
  const batch = writeBatch(db)
  batch.set(newAuditRef(), auditEntry(profile, { action, details, ...extra }))
  await batch.commit()
}
