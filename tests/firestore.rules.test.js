// Security rules tests. Run with: npm run test:rules (starts the Firestore emulator; needs Java 21+).
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing'
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore'
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, test } from 'vitest'

let env

const STAFF = {
  acc: { name: 'Prince Danso', email: 'acc@hfch.test', role: 'accountant', active: true },
  sw: { name: 'Pius Henneh', email: 'sw@hfch.test', role: 'social_worker', active: true },
  aud: { name: 'Atta Yeboah Senior', email: 'aud@hfch.test', role: 'auditor', active: true },
  gone: { name: 'Former Officer', email: 'gone@hfch.test', role: 'social_worker', active: false },
}

const PATIENT = {
  folderId: 'HFH-2026-001',
  name: 'Kofi Owusu',
  ghanaCard: 'GHA-782194021-3',
  phone: '0244123456',
  location: 'Berekum Newtown',
  landmark: 'Behind Pentecost Church',
}

const TERMS = {
  patientId: 'HFH-2026-001',
  guarantor: { name: 'Samuel Owusu', phone: '0509876543', ghanaCard: 'GHA-908123412-1', relation: 'Father' },
  totalBill: 350000,
  scheduleType: 'Bi-Weekly',
  installmentAmount: 20000,
  nextDueDate: '2026-11-01',
  finalDeadline: '2027-03-01',
}

const db = (uid) => env.authenticatedContext(uid, { email: STAFF[uid]?.email }).firestore()

const created = (uid, auditId) => ({
  createdAt: serverTimestamp(),
  createdBy: uid,
  updatedAt: serverTimestamp(),
  updatedBy: uid,
  lastAuditId: auditId,
})

const updated = (uid, auditId) => ({ updatedAt: serverTimestamp(), updatedBy: uid, lastAuditId: auditId })

function audit(uid, overrides = {}) {
  const s = STAFF[uid]
  return {
    timestamp: serverTimestamp(),
    uid,
    userName: s.name,
    role: s.role,
    action: 'Test Action',
    entityType: '',
    entityId: '',
    patientRef: '',
    details: '',
    changes: null,
    ...overrides,
  }
}

function payment(uid, agreementId, seq, amount, auditId, overrides = {}) {
  return {
    agreementId,
    patientId: TERMS.patientId,
    seq,
    type: 'payment',
    amount,
    method: 'Cash',
    paidBy: 'Patient',
    payerName: '',
    paidOn: '2026-10-21',
    receiptNo: `RCT-${seq}`,
    note: '',
    reversesPaymentId: null,
    reason: null,
    recordedBy: uid,
    recordedByName: STAFF[uid].name,
    createdAt: serverTimestamp(),
    auditId,
    ...overrides,
  }
}

// Seeds a patient + agreement (with `paid` already on the ledger as payment #1) bypassing rules.
async function seedAgreement(id = 'agr1', paid = 50000, terms = {}) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const f = ctx.firestore()
    await setDoc(doc(f, 'patients', PATIENT.folderId), { ...PATIENT, ...created('acc', 'seed') })
    await setDoc(doc(f, 'agreements', id), { ...TERMS, ...terms, totalPaid: paid, paymentCount: paid ? 1 : 0, ...created('acc', 'seed') })
    if (paid) await setDoc(doc(f, 'payments', `${id}_1`), payment('acc', id, 1, paid, 'seed'))
  })
}

function postPayment(uid, agreementId, { seq, amount, totalPaid, extra = {} }) {
  const f = db(uid)
  const auditRef = doc(collection(f, 'auditLogs'))
  const batch = writeBatch(f)
  batch.set(doc(f, 'payments', `${agreementId}_${seq}`), payment(uid, agreementId, seq, amount, auditRef.id))
  batch.update(doc(f, 'agreements', agreementId), { totalPaid, paymentCount: seq, ...updated(uid, auditRef.id), ...extra })
  batch.set(auditRef, audit(uid, { action: 'Payment Collection' }))
  return batch.commit()
}

function postReversal(uid, agreementId, { originalId, seq, amount, totalPaid }) {
  const f = db(uid)
  const auditRef = doc(collection(f, 'auditLogs'))
  const batch = writeBatch(f)
  const reversalId = `${agreementId}_${seq}`
  batch.set(
    doc(f, 'payments', reversalId),
    payment(uid, agreementId, seq, -amount, auditRef.id, {
      type: 'reversal',
      reversesPaymentId: originalId,
      reason: 'Entered wrong amount',
    }),
  )
  batch.set(doc(f, 'reversals', originalId), { reversalId, createdBy: uid, createdAt: serverTimestamp() })
  batch.update(doc(f, 'agreements', agreementId), { totalPaid, paymentCount: seq, ...updated(uid, auditRef.id) })
  batch.set(auditRef, audit(uid, { action: 'Payment Reversal' }))
  return batch.commit()
}

function register(uid, { withAudit = true, deposit = 0 } = {}) {
  const f = db(uid)
  const auditRef = doc(collection(f, 'auditLogs'))
  const agreementRef = doc(collection(f, 'agreements'))
  const batch = writeBatch(f)
  batch.set(doc(f, 'patients', PATIENT.folderId), { ...PATIENT, ...created(uid, auditRef.id) })
  batch.set(agreementRef, { ...TERMS, totalPaid: deposit, paymentCount: deposit ? 1 : 0, ...created(uid, auditRef.id) })
  if (deposit) batch.set(doc(f, 'payments', `${agreementRef.id}_1`), payment(uid, agreementRef.id, 1, deposit, auditRef.id))
  if (withAudit) batch.set(auditRef, audit(uid, { action: 'Patient Registration' }))
  return batch.commit()
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-dept-tracker',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  })
})

afterAll(() => env?.cleanup())

beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const f = ctx.firestore()
    await setDoc(doc(f, 'config', 'setup'), { completedBy: 'acc', completedAt: serverTimestamp() })
    for (const [uid, s] of Object.entries(STAFF)) await setDoc(doc(f, 'users', uid), { ...s, ...created('acc', 'seed') })
  })
})

describe('registration', () => {
  test('social worker can register a patient with a deposit', () => assertSucceeds(register('sw', { deposit: 50000 })))
  test('accountant can register a patient without a deposit', () => assertSucceeds(register('acc')))
  test('auditor cannot register', () => assertFails(register('aud')))
  test('deactivated officer cannot register', () => assertFails(register('gone')))
  test('registration without an audit entry is rejected', () => assertFails(register('sw', { withAudit: false })))

  test('deposit must match the agreement total paid', async () => {
    const f = db('sw')
    const auditRef = doc(collection(f, 'auditLogs'))
    const agreementRef = doc(collection(f, 'agreements'))
    const batch = writeBatch(f)
    batch.set(doc(f, 'patients', PATIENT.folderId), { ...PATIENT, ...created('sw', auditRef.id) })
    batch.set(agreementRef, { ...TERMS, totalPaid: 90000, paymentCount: 1, ...created('sw', auditRef.id) })
    batch.set(doc(f, 'payments', `${agreementRef.id}_1`), payment('sw', agreementRef.id, 1, 50000, auditRef.id))
    batch.set(auditRef, audit('sw'))
    await assertFails(batch.commit())
  })

  test('social worker cannot overwrite an existing patient', async () => {
    await seedAgreement()
    await assertFails(register('sw'))
  })
})

describe('payments', () => {
  beforeEach(() => seedAgreement())

  test('social worker can record a payment', () => assertSucceeds(postPayment('sw', 'agr1', { seq: 2, amount: 20000, totalPaid: 70000 })))
  test('auditor cannot record a payment', () => assertFails(postPayment('aud', 'agr1', { seq: 2, amount: 20000, totalPaid: 70000 })))
  test('totals must match the payment amount', () => assertFails(postPayment('sw', 'agr1', { seq: 2, amount: 20000, totalPaid: 90000 })))
  test('cannot skip a sequence number', () => assertFails(postPayment('sw', 'agr1', { seq: 3, amount: 20000, totalPaid: 70000 })))
  test('cannot pay more than the balance', () => assertFails(postPayment('sw', 'agr1', { seq: 2, amount: 400000, totalPaid: 450000 })))
  test('cannot record a zero or negative payment', () => assertFails(postPayment('sw', 'agr1', { seq: 2, amount: -100, totalPaid: 49900 })))

  // Seeded agreement is Bi-Weekly with next due 2026-11-01, so the scheduled next date is 2026-11-15.
  test('social worker payment applies the scheduled next due date', () =>
    assertSucceeds(postPayment('sw', 'agr1', { seq: 2, amount: 20000, totalPaid: 70000, extra: { nextDueDate: '2026-11-15' } })))

  test('social worker cannot choose a different due date', () =>
    assertFails(postPayment('sw', 'agr1', { seq: 2, amount: 20000, totalPaid: 70000, extra: { nextDueDate: '2026-11-10' } })))

  test('social worker cannot move the due date backwards', () =>
    assertFails(postPayment('sw', 'agr1', { seq: 2, amount: 20000, totalPaid: 70000, extra: { nextDueDate: '2026-10-25' } })))

  test('monthly schedule clamps to the end of a shorter month', async () => {
    await seedAgreement('agr2', 50000, { scheduleType: 'Monthly', nextDueDate: '2027-01-31' })
    await assertSucceeds(postPayment('sw', 'agr2', { seq: 2, amount: 20000, totalPaid: 70000, extra: { nextDueDate: '2027-02-28' } }))
  })

  test('scheduled due date is capped at the final deadline', async () => {
    await seedAgreement('agr3', 50000, { scheduleType: 'Weekly', nextDueDate: '2027-02-27' })
    await assertSucceeds(postPayment('sw', 'agr3', { seq: 2, amount: 20000, totalPaid: 70000, extra: { nextDueDate: '2027-03-01' } }))
  })

  test('due date cannot pass the final deadline', () =>
    assertFails(postPayment('acc', 'agr1', { seq: 2, amount: 20000, totalPaid: 70000, extra: { nextDueDate: '2027-04-01' } })))

  test('accountant can move the due date when recording a payment', () =>
    assertSucceeds(postPayment('acc', 'agr1', { seq: 2, amount: 20000, totalPaid: 70000, extra: { nextDueDate: '2026-12-01' } })))

  test('payment cannot be written without the agreement update', async () => {
    const f = db('sw')
    const auditRef = doc(collection(f, 'auditLogs'))
    const batch = writeBatch(f)
    batch.set(doc(f, 'payments', 'agr1_2'), payment('sw', 'agr1', 2, 20000, auditRef.id))
    batch.set(auditRef, audit('sw'))
    await assertFails(batch.commit())
  })

  test('payments can never be edited or deleted', async () => {
    await assertFails(updateDoc(doc(db('acc'), 'payments', 'agr1_1'), { amount: 1 }))
    await assertFails(deleteDoc(doc(db('acc'), 'payments', 'agr1_1')))
  })
})

describe('reversals', () => {
  beforeEach(() => seedAgreement())

  test('accountant can reverse a payment', () =>
    assertSucceeds(postReversal('acc', 'agr1', { originalId: 'agr1_1', seq: 2, amount: 50000, totalPaid: 0 })))

  test('social worker cannot reverse a payment', () =>
    assertFails(postReversal('sw', 'agr1', { originalId: 'agr1_1', seq: 2, amount: 50000, totalPaid: 0 })))

  test('reversal amount must equal the original', () =>
    assertFails(postReversal('acc', 'agr1', { originalId: 'agr1_1', seq: 2, amount: 10000, totalPaid: 40000 })))

  test('a payment can only be reversed once', async () => {
    // Enough on the ledger that a second reversal would not go negative: only the marker stops it.
    await assertSucceeds(postPayment('acc', 'agr1', { seq: 2, amount: 60000, totalPaid: 110000 }))
    await assertSucceeds(postReversal('acc', 'agr1', { originalId: 'agr1_1', seq: 3, amount: 50000, totalPaid: 60000 }))
    await assertFails(postReversal('acc', 'agr1', { originalId: 'agr1_1', seq: 4, amount: 50000, totalPaid: 10000 }))
  })

  test('a reversal cannot itself be reversed', async () => {
    await assertSucceeds(postReversal('acc', 'agr1', { originalId: 'agr1_1', seq: 2, amount: 50000, totalPaid: 0 }))
    await assertFails(postReversal('acc', 'agr1', { originalId: 'agr1_2', seq: 3, amount: -50000, totalPaid: 50000 }))
  })
})

describe('agreement edits', () => {
  beforeEach(() => seedAgreement())

  function editTerms(uid, changes) {
    const f = db(uid)
    const auditRef = doc(collection(f, 'auditLogs'))
    const batch = writeBatch(f)
    batch.update(doc(f, 'agreements', 'agr1'), { ...changes, ...updated(uid, auditRef.id) })
    batch.set(auditRef, audit(uid, { action: 'Agreement Edit' }))
    return batch.commit()
  }

  test('accountant can change the bill and deadline', () => assertSucceeds(editTerms('acc', { totalBill: 400000, finalDeadline: '2027-06-01' })))
  test('social worker cannot change the bill', () => assertFails(editTerms('sw', { totalBill: 400000 })))
  test('social worker cannot change the deadline', () => assertFails(editTerms('sw', { finalDeadline: '2027-06-01' })))
  test('accountant cannot change total paid through an edit', () => assertFails(editTerms('acc', { totalPaid: 350000 })))
  test('bill cannot go below what has been paid', () => assertFails(editTerms('acc', { totalBill: 10000 })))
  test('next due date cannot be after the final deadline', () => assertFails(editTerms('acc', { nextDueDate: '2027-04-01' })))

  test('edit without an audit entry is rejected', () =>
    assertFails(updateDoc(doc(db('acc'), 'agreements', 'agr1'), { totalBill: 400000, ...updated('acc', 'missing') })))
})

describe('patient edits', () => {
  beforeEach(() => seedAgreement())

  function editPatient(uid) {
    const f = db(uid)
    const auditRef = doc(collection(f, 'auditLogs'))
    const batch = writeBatch(f)
    batch.update(doc(f, 'patients', PATIENT.folderId), { phone: '0200000000', ...updated(uid, auditRef.id) })
    batch.set(auditRef, audit(uid))
    return batch.commit()
  }

  test('accountant can edit patient details', () => assertSucceeds(editPatient('acc')))
  test('social worker cannot edit patient details', () => assertFails(editPatient('sw')))
})

describe('audit trail', () => {
  test('audit entries cannot be edited or deleted', async () => {
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'auditLogs', 'a1'), audit('sw')))
    await assertFails(updateDoc(doc(db('acc'), 'auditLogs', 'a1'), { details: 'changed' }))
    await assertFails(deleteDoc(doc(db('acc'), 'auditLogs', 'a1')))
  })

  test('cannot write an audit entry as someone else', () => assertFails(setDoc(doc(db('sw'), 'auditLogs', 'x'), audit('acc'))))
  test('cannot fake the officer name', () => assertFails(setDoc(doc(db('sw'), 'auditLogs', 'x'), audit('sw', { userName: 'Prince Danso' }))))
  test('cannot fake the role', () => assertFails(setDoc(doc(db('sw'), 'auditLogs', 'x'), audit('sw', { role: 'accountant' }))))
  test('cannot backdate the timestamp', () =>
    assertFails(setDoc(doc(db('sw'), 'auditLogs', 'x'), audit('sw', { timestamp: new Date('2020-01-01') }))))
  test('deactivated officer cannot write audit entries', () => assertFails(setDoc(doc(db('gone'), 'auditLogs', 'x'), audit('gone'))))

  test('auditor and accountant can read the audit trail', async () => {
    await assertSucceeds(getDocs(collection(db('aud'), 'auditLogs')))
    await assertSucceeds(getDocs(collection(db('acc'), 'auditLogs')))
  })
  test('social worker cannot read the audit trail', () => assertFails(getDocs(collection(db('sw'), 'auditLogs'))))
})

describe('reading data', () => {
  beforeEach(() => seedAgreement())

  test('all active roles can read patients and agreements', async () => {
    for (const uid of ['acc', 'sw', 'aud']) {
      await assertSucceeds(getDocs(collection(db(uid), 'patients')))
      await assertSucceeds(getDocs(collection(db(uid), 'agreements')))
      await assertSucceeds(getDocs(collection(db(uid), 'payments')))
    }
  })
  test('deactivated officer cannot read', () => assertFails(getDocs(collection(db('gone'), 'patients'))))
  test('signed-out visitor cannot read', () => assertFails(getDocs(collection(env.unauthenticatedContext().firestore(), 'patients'))))
  test('someone without a staff profile cannot read', () => assertFails(getDocs(collection(db('stranger'), 'agreements'))))
})

describe('staff accounts', () => {
  function writeUser(actor, uid, data, mode = 'set') {
    const f = db(actor)
    const auditRef = doc(collection(f, 'auditLogs'))
    const batch = writeBatch(f)
    const ref = doc(f, 'users', uid)
    if (mode === 'set') batch.set(ref, { ...data, ...created(actor, auditRef.id) })
    else batch.update(ref, { ...data, ...updated(actor, auditRef.id) })
    batch.set(auditRef, audit(actor))
    return batch.commit()
  }

  const newStaff = { name: 'New Officer', email: 'new@hfch.test', role: 'social_worker', active: true }

  test('accountant can create staff', () => assertSucceeds(writeUser('acc', 'new1', newStaff)))
  test('social worker cannot create staff', () => assertFails(writeUser('sw', 'new1', newStaff)))
  test('social worker cannot promote themselves', () => assertFails(writeUser('sw', 'sw', { role: 'accountant' }, 'update')))
  test('accountant can deactivate staff', () => assertSucceeds(writeUser('acc', 'sw', { active: false }, 'update')))
  test('accountant cannot deactivate themselves', () => assertFails(writeUser('acc', 'acc', { active: false }, 'update')))
  test('staff cannot read other staff profiles', () => assertFails(getDoc(doc(db('sw'), 'users', 'acc'))))
  test('staff can read their own profile', () => assertSucceeds(getDoc(doc(db('sw'), 'users', 'sw'))))
})

describe('first-time setup', () => {
  function bootstrap(uid, email) {
    const f = env.authenticatedContext(uid, { email }).firestore()
    const auditRef = doc(collection(f, 'auditLogs'))
    const batch = writeBatch(f)
    batch.set(doc(f, 'users', uid), { name: 'First Admin', email, role: 'accountant', active: true, ...created(uid, auditRef.id) })
    batch.set(doc(f, 'config', 'setup'), { completedBy: uid, completedAt: serverTimestamp() })
    batch.set(auditRef, { ...audit('acc'), uid, userName: 'First Admin', role: 'accountant' })
    return batch.commit()
  }

  test('first accountant can set up an empty system', async () => {
    await env.clearFirestore()
    await assertSucceeds(bootstrap('first', 'first@hfch.test'))
  })

  test('setup cannot be repeated once done', () => assertFails(bootstrap('intruder', 'intruder@hfch.test')))
})
