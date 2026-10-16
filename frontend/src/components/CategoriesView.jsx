import { useState } from 'react'
import { PlusIcon, TrashIcon } from './Icons.jsx'

export default function CategoriesView({ categories, loading, onCreate, onDelete }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await onCreate({ name: name.trim(), description: description.trim() || null })
      setName('')
      setDescription('')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid grid--side">
      <section className="card">
        <header className="card__header">
          <div>
            <h2 className="card__title">Categories</h2>
            <p className="card__subtitle">{categories.length} total</p>
          </div>
        </header>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th className="hide-sm">Description</th>
                <th className="num">Products</th>
                <th className="actions-col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr className="row-skeleton">
                  <td colSpan={4}>
                    <span className="skeleton" />
                  </td>
                </tr>
              )}
              {!loading && categories.length === 0 && (
                <tr>
                  <td colSpan={4} className="empty">
                    No categories yet.
                  </td>
                </tr>
              )}
              {categories.map((c) => (
                <tr key={c.id}>
                  <td>
                    <strong>{c.name}</strong>
                  </td>
                  <td className="hide-sm muted">{c.description || '—'}</td>
                  <td className="num">{c.product_count}</td>
                  <td className="actions-col">
                    <div className="row-actions">
                      <button className="icon-btn icon-btn--danger" onClick={() => onDelete(c)} aria-label={`Delete ${c.name}`} title="Delete">
                        <TrashIcon />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card card--padded">
        <h2 className="card__title">Add category</h2>
        <form className="stack" onSubmit={handleSubmit}>
          {error && <p className="form-error">{error}</p>}
          <label className="field">
            <span>Name</span>
            <input required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="Networking" />
          </label>
          <label className="field">
            <span>Description</span>
            <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" />
          </label>
          <button className="btn btn--primary" disabled={saving}>
            <PlusIcon /> {saving ? 'Adding…' : 'Add category'}
          </button>
        </form>
      </section>
    </div>
  )
}
