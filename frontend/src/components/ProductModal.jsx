import { useState } from 'react'
import Modal from './Modal.jsx'

const EMPTY = {
  sku: '',
  name: '',
  category_id: '',
  quantity: 0,
  reorder_level: 10,
  unit_price: 0,
  supplier: '',
  location: '',
  description: '',
}

export default function ProductModal({ product, categories, onClose, onSubmit }) {
  const editing = Boolean(product)
  const [form, setForm] = useState(() =>
    editing
      ? { ...EMPTY, ...product, category_id: product.category_id ?? '', supplier: product.supplier ?? '', location: product.location ?? '', description: product.description ?? '' }
      : EMPTY,
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const field = (name) => ({
    name,
    value: form[name],
    onChange: (e) => setForm((f) => ({ ...f, [name]: e.target.value })),
  })

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const payload = {
      sku: form.sku.trim(),
      name: form.name.trim(),
      category_id: form.category_id === '' ? null : Number(form.category_id),
      reorder_level: Number(form.reorder_level),
      unit_price: Number(form.unit_price),
      supplier: form.supplier.trim() || null,
      location: form.location.trim() || null,
      description: form.description.trim() || null,
    }
    if (!editing) payload.quantity = Number(form.quantity)
    try {
      await onSubmit(payload)
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <Modal
      title={editing ? 'Edit product' : 'New product'}
      subtitle={editing ? `SKU ${product.sku}` : 'Add an item to your inventory'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="product-form" className="btn btn--primary" disabled={saving}>
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Create product'}
          </button>
        </>
      }
    >
      <form id="product-form" className="form-grid" onSubmit={handleSubmit}>
        {error && <p className="form-error span-2">{error}</p>}
        <label className="field">
          <span>Product name</span>
          <input required maxLength={160} placeholder="Wireless Mouse" {...field('name')} />
        </label>
        <label className="field">
          <span>SKU</span>
          <input required maxLength={40} pattern="[A-Za-z0-9\-_.]+" placeholder="EL-1001" {...field('sku')} />
        </label>
        <label className="field">
          <span>Category</span>
          <select {...field('category_id')}>
            <option value="">Uncategorised</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Supplier</span>
          <input maxLength={120} placeholder="Logitech" {...field('supplier')} />
        </label>
        {!editing && (
          <label className="field">
            <span>Opening quantity</span>
            <input type="number" min={0} required {...field('quantity')} />
          </label>
        )}
        <label className="field">
          <span>Reorder level</span>
          <input type="number" min={0} required {...field('reorder_level')} />
        </label>
        <label className="field">
          <span>Unit price (USD)</span>
          <input type="number" min={0} step="0.01" required {...field('unit_price')} />
        </label>
        <label className="field">
          <span>Bin location</span>
          <input maxLength={60} placeholder="A1-03" {...field('location')} />
        </label>
        <label className="field span-2">
          <span>Description</span>
          <textarea rows={2} placeholder="Optional notes" {...field('description')} />
        </label>
        {editing && (
          <p className="form-hint span-2">Quantity changes go through “Adjust stock” so every change is audited.</p>
        )}
      </form>
    </Modal>
  )
}
