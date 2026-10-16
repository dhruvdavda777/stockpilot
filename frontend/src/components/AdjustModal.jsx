import { useState } from 'react'
import { REASON_LABELS } from '../format.js'
import Modal from './Modal.jsx'

const IN_REASONS = ['restock', 'return', 'adjustment']
const OUT_REASONS = ['sale', 'damaged', 'adjustment']

export default function AdjustModal({ product, onClose, onSubmit }) {
  const [direction, setDirection] = useState('in')
  const [amount, setAmount] = useState(1)
  const [reason, setReason] = useState('restock')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const reasons = direction === 'in' ? IN_REASONS : OUT_REASONS
  const change = (direction === 'in' ? 1 : -1) * Number(amount || 0)
  const after = product.quantity + change

  function switchDirection(next) {
    setDirection(next)
    setReason(next === 'in' ? 'restock' : 'sale')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await onSubmit({ change, reason, note: note.trim() || null })
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <Modal
      title="Adjust stock"
      subtitle={`${product.name} · ${product.quantity} on hand`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="adjust-form" className="btn btn--primary" disabled={saving || after < 0 || change === 0}>
            {saving ? 'Saving…' : 'Record movement'}
          </button>
        </>
      }
    >
      <form id="adjust-form" className="form-grid" onSubmit={handleSubmit}>
        {error && <p className="form-error span-2">{error}</p>}
        <div className="segmented span-2" role="radiogroup" aria-label="Direction">
          <button type="button" role="radio" aria-checked={direction === 'in'} className={`segmented__item ${direction === 'in' ? 'is-active' : ''}`} onClick={() => switchDirection('in')}>
            Stock in
          </button>
          <button type="button" role="radio" aria-checked={direction === 'out'} className={`segmented__item ${direction === 'out' ? 'is-active' : ''}`} onClick={() => switchDirection('out')}>
            Stock out
          </button>
        </div>
        <label className="field">
          <span>Quantity</span>
          <input type="number" min={1} required value={amount} onChange={(e) => setAmount(e.target.value)} />
        </label>
        <label className="field">
          <span>Reason</span>
          <select value={reason} onChange={(e) => setReason(e.target.value)}>
            {reasons.map((r) => (
              <option key={r} value={r}>
                {REASON_LABELS[r]}
              </option>
            ))}
          </select>
        </label>
        <label className="field span-2">
          <span>Note</span>
          <input maxLength={255} placeholder="PO-1042, Order #881…" value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        <p className={`adjust-preview span-2 ${after < 0 ? 'is-invalid' : ''}`}>
          {product.quantity} → <strong>{after}</strong> units
          {after < 0 && ' — not enough stock'}
          {after >= 0 && after <= product.reorder_level && ' — at or below reorder level'}
        </p>
      </form>
    </Modal>
  )
}
