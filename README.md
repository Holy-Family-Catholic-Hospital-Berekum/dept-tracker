# Patient Owings & Debt Recovery Tracker

Holy Family Catholic Hospital, Berekum — Social Welfare Unit.

Tracks patients who could not pay their bill at discharge and signed an agreement to pay in
installments before a deadline: patient and guarantor details, the payment schedule, every payment
received, the remaining balance, and a permanent audit trail of who did what.

**Stack:** React + Vite, Tailwind CSS, Firebase Auth + Cloud Firestore (Spark/free plan), Chart.js,
write-excel-file.

## Roles

| | Accountant (admin) | Social Worker | Auditor |
|---|:-:|:-:|:-:|
| View records, dashboard, analytics, follow-up list | ✅ | ✅ | ✅ |
| Register patients / new agreements | ✅ | ✅ | |
| Record payments, print receipts | ✅ | ✅ | receipts only |
| Next due date when recording a payment | auto, editable | auto (schedule) | |
| Edit patient details, bill amount, due dates, deadline | ✅ | | |
| Reverse a payment (with reason) | ✅ | | |
| Export to Excel | ✅ | ✅ | ✅ |
| View audit trail | ✅ | | ✅ |
| Create / deactivate staff accounts | ✅ | | |

Roles are enforced by [firestore.rules](firestore.rules), not only by the UI.

## How the data is protected

There are no Cloud Functions (Spark plan), so the browser writes to Firestore directly and the
security rules do the enforcement:

- Every change must be committed in the same batch as a new audit log entry, or it is rejected.
  The entry must carry the signed-in officer's real ID, name and role, and the server's timestamp.
- Audit entries, payments and reversals can never be edited or deleted, by anyone.
- Money is stored in integer pesewas. An agreement's `totalPaid` must always equal the sum of its
  ledger entries; payments are numbered `{agreementId}_{seq}` so none can be skipped or duplicated.
- Mistakes are corrected with a reversal entry (accountant only, reason required). Each payment can
  be reversed once.

## Data model

| Collection | Contents |
|---|---|
| `users/{uid}` | name, email, role, active |
| `patients/{folderId}` | patient identity and contact details |
| `agreements/{id}` | patientId, guarantor, totalBill, totalPaid, paymentCount, schedule, installment, nextDueDate, finalDeadline |
| `payments/{agreementId}_{seq}` | ledger: payments (positive) and reversals (negative), method, paid by, receipt no., recorded by |
| `reversals/{paymentId}` | marker so a payment can only be reversed once |
| `auditLogs/{id}` | timestamp, officer, role, action, patient ref, details, before/after changes |
| `config/setup` | written once when the first accountant is created |

Status is computed: **Cleared** (balance 0), **Defaulted** (past final deadline), **Overdue** (past
next due date), otherwise **Active**.

## Setup

```bash
npm install
cp .env.example .env   # fill in from Firebase console > Project settings > Your apps
npm run dev
```

In the Firebase console: enable **Authentication → Email/Password** and create the Firestore database.
Deploy the rules (`npm run deploy:rules`), then open the app and click **Run first-time setup** to create
the accountant account. That can only be done once; the accountant then creates everyone else under
**Staff Accounts**.

## Scripts

| Command | |
|---|---|
| `npm run dev` | Start the app locally |
| `npm run dev:emulators` | Start local Auth + Firestore emulators (set `VITE_USE_EMULATORS=true` in `.env`) |
| `npm run test:rules` | Run the security rules test suite against the emulator (needs Java 21+) |
| `npm run build` | Production build into `dist/` |
| `npm run deploy:rules` | Deploy Firestore security rules |
| `npm run deploy` | Build, then deploy the site to Firebase Hosting and the rules |
| `npm run lint` | Lint with oxlint |
