import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { errorMessage, useToast } from '../context/ToastContext'
import { cleanPhone, GHANA_CARD_PATTERN, PHONE_PATTERN } from '../lib/constants'
import { updatePatient } from '../lib/db'
import Modal from './Modal'
import { btnSuccess, Field, inputCls } from './ui'

export default function EditPatientModal({ patient, onClose }) {
  const { profile } = useAuth()
  const toast = useToast()
  const [f, setF] = useState({
    name: patient.name,
    ghanaCard: patient.ghanaCard,
    phone: patient.phone,
    location: patient.location,
    landmark: patient.landmark,
  })
  const [saving, setSaving] = useState(false)
  const set = (key) => (e) => setF((prev) => ({ ...prev, [key]: e.target.value }))

  async function submit() {
    const changes = {
      name: f.name.trim(),
      ghanaCard: f.ghanaCard.trim().toUpperCase(),
      phone: cleanPhone(f.phone),
      location: f.location.trim(),
      landmark: f.landmark.trim(),
    }
    if (changes.name.length < 2 || changes.location.length < 2 || changes.landmark.length < 2) {
      return toast('Name, location and landmark are required.', 'error')
    }
    if (!GHANA_CARD_PATTERN.test(changes.ghanaCard)) return toast('Ghana Card must be in the format GHA-XXXXXXXXX-X.', 'error')
    if (!PHONE_PATTERN.test(changes.phone)) return toast('Phone number is not valid.', 'error')

    setSaving(true)
    try {
      await updatePatient(profile, patient, changes)
      toast('Patient details updated.')
      onClose()
    } catch (err) {
      toast(errorMessage(err), 'error')
      setSaving(false)
    }
  }

  return (
    <Modal
      title="Edit Patient Details"
      subtitle={`Folder ID: ${patient.folderId} (cannot be changed)`}
      onClose={onClose}
      size="max-w-2xl"
      footer={
        <>
          <button onClick={onClose} className="px-4 py-2 border rounded-lg text-xs font-medium">
            Cancel
          </button>
          <button onClick={submit} disabled={saving} className={btnSuccess}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Full Name" required>
          <input className={inputCls} value={f.name} onChange={set('name')} />
        </Field>
        <Field label="Ghana Card ID" required>
          <input className={inputCls} value={f.ghanaCard} onChange={set('ghanaCard')} />
        </Field>
        <Field label="Phone Number" required>
          <input className={inputCls} value={f.phone} onChange={set('phone')} />
        </Field>
        <Field label="Town / Location" required>
          <input className={inputCls} value={f.location} onChange={set('location')} />
        </Field>
        <Field label="Nearest Landmark / Hse No." required className="md:col-span-2">
          <input className={inputCls} value={f.landmark} onChange={set('landmark')} />
        </Field>
      </div>
    </Modal>
  )
}
