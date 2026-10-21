import { CircleCheck, TriangleAlert } from 'lucide-react'
import { createContext, useCallback, useContext, useState } from 'react'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const toast = useCallback((message, type = 'success') => {
    const id = crypto.randomUUID()
    setToasts((t) => [...t, { id, message, type }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), type === 'error' ? 7000 : 4000)
  }, [])

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 max-w-sm">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-start gap-2 px-4 py-3 rounded-lg shadow-lg text-sm text-white ${
              t.type === 'error' ? 'bg-rose-600' : 'bg-slate-900'
            }`}
          >
            {t.type === 'error' ? (
              <TriangleAlert className="w-4 h-4 mt-0.5 shrink-0" />
            ) : (
              <CircleCheck className="w-4 h-4 mt-0.5 shrink-0 text-emerald-400" />
            )}
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}

// Firestore rejections surface as "Missing or insufficient permissions."
export function errorMessage(err) {
  if (err?.code === 'permission-denied') return 'Permission denied: your role cannot perform this action.'
  if (err?.code === 'auth/email-already-in-use') return 'An account with this email already exists.'
  if (err?.code === 'auth/weak-password' || err?.code === 'auth/password-does-not-meet-requirements') {
    return 'Password must be at least 8 characters with an uppercase letter, a lowercase letter, a number and a symbol.'
  }
  if (err?.code === 'auth/invalid-credential' || err?.code === 'auth/wrong-password') return 'Incorrect email or password.'
  if (err?.code === 'auth/too-many-requests') return 'Too many attempts. Please wait a few minutes and try again.'
  if (err?.code === 'unavailable') return 'Cannot reach the server. Check the internet connection.'
  return err?.message || 'Something went wrong.'
}
