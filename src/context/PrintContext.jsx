import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import Receipt from '../components/Receipt'

const PrintContext = createContext(null)

export function PrintProvider({ children }) {
  const [job, setJob] = useState(null)

  useEffect(() => {
    if (!job) return undefined
    const clear = () => setJob(null)
    window.addEventListener('afterprint', clear)
    // Let the portal render and the logo load before opening the print dialog.
    let cancelled = false
    const t = setTimeout(async () => {
      const images = [...document.querySelectorAll('#print-root img')]
      await Promise.all(images.map((img) => img.decode().catch(() => {})))
      if (!cancelled) window.print()
    }, 50)
    return () => {
      cancelled = true
      clearTimeout(t)
      window.removeEventListener('afterprint', clear)
    }
  }, [job])

  const printReceipt = useCallback((receipt) => setJob({ ...receipt, printedAt: new Date() }), [])

  return (
    <PrintContext.Provider value={printReceipt}>
      {children}
      {job && createPortal(<Receipt {...job} />, document.getElementById('print-root'))}
    </PrintContext.Provider>
  )
}

export function usePrintReceipt() {
  return useContext(PrintContext)
}
