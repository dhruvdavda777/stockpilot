import { useEffect, useRef } from 'react'
import { CloseIcon } from './Icons.jsx'

export default function Modal({ title, subtitle, onClose, children, footer }) {
  const dialogRef = useRef(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  // Mount-only: focus the first field and listen for Escape. onClose is read
  // through a ref so a new callback each render doesn't steal focus mid-typing.
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onCloseRef.current()
    document.addEventListener('keydown', onKey)
    dialogRef.current?.querySelector('input, select, textarea')?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" ref={dialogRef}>
        <header className="modal__header">
          <div>
            <h2 id="modal-title">{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </header>
        <div className="modal__body">{children}</div>
        {footer && <footer className="modal__footer">{footer}</footer>}
      </div>
    </div>
  )
}
