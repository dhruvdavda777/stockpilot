import { formatCompactCurrency, formatNumber } from '../format.js'

export default function CategoryBreakdown({ rows, loading }) {
  const max = Math.max(...rows.map((r) => r.value), 1)
  return (
    <section className="card">
      <header className="card__header">
        <div>
          <h2 className="card__title">Value by category</h2>
          <p className="card__subtitle">Where your capital sits</p>
        </div>
      </header>
      {loading ? (
        <div className="bars">
          {Array.from({ length: 4 }, (_, i) => (
            <span key={i} className="skeleton" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="empty">Add products to see the breakdown.</p>
      ) : (
        <ul className="bars">
          {rows.map((r) => (
            <li key={r.category} className="bars__row">
              <div className="bars__label">
                <span>{r.category}</span>
                <strong>{formatCompactCurrency(r.value)}</strong>
              </div>
              <div className="bars__track">
                <span style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }} />
              </div>
              <small>
                {formatNumber(r.products)} products · {formatNumber(r.units)} units
              </small>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
