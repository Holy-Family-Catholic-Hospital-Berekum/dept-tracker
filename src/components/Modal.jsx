import { X } from 'lucide-react'
import { useEffect } from 'react'

export default function Modal({ title, subtitle, onClose, children, footer, size = 'max-w-md' }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4" onMouseDown={onClose}>
      <div
        className={`bg-white rounded-xl shadow-xl p-6 w-full ${size} max-h-[92vh] overflow-y-auto`}
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex justify-between items-start gap-4">
          <h3 className="text-lg font-bold text-slate-800 mb-2">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
        {subtitle && <p className="text-xs text-slate-500 mb-4">{subtitle}</p>}
        {children}
        {footer && <div className="flex justify-end gap-3 mt-6">{footer}</div>}
      </div>
    </div>
  )
}
