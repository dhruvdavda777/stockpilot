import { formatCurrency, formatNumber, stockFill } from '../format.js'
import { EditIcon, SearchIcon, SwapIcon, TrashIcon } from './Icons.jsx'
import StatusBadge from './StatusBadge.jsx'

export const STATUS_FILTERS = [
  { id: '', label: 'All' },
  { id: 'in_stock', label: 'In stock' },
  { id: 'low_stock', label: 'Low stock' },
  { id: 'out_of_stock', label: 'Out of stock' },
]

export default function ProductTable({
  products,
  categories,
  filters,
  onFiltersChange,
  loading,
  onEdit,
  onAdjust,
  onDelete,
  compact = false,
  title = 'Products',
  action,
}) {
  const set = (patch) => onFiltersChange({ ...filters, ...patch })

  return (
    <section className="card">
      <header className="card__header card__header--wrap">
        <div>
          <h2 className="card__title">{title}</h2>
          <p className="card__subtitle">{loading ? 'Loading…' : `${products.length} shown`}</p>
        </div>
        {action}
      </header>

      {!compact && (
        <div className="toolbar">
          <div className="segmented" role="tablist" aria-label="Filter by stock status">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.id || 'all'}
                role="tab"
                aria-selected={filters.stock_status === f.id}
                className={`segmented__item ${filters.stock_status === f.id ? 'is-active' : ''}`}
                onClick={() => set({ stock_status: f.id })}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="toolbar__right">
            <label className="search">
              <SearchIcon />
              <input
                type="search"
                placeholder="Search name, SKU, supplier"
                value={filters.q}
                onChange={(e) => set({ q: e.target.value })}
                aria-label="Search products"
              />
            </label>
            <select
              className="select"
              value={filters.category_id}
              onChange={(e) => set({ category_id: e.target.value })}
              aria-label="Filter by category"
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div className="table-wrap">
        <table className={`table ${compact ? 'table--compact' : ''}`}>
          <thead>
            <tr>
              <th>Product</th>
              <th className="hide-sm">Category</th>
              <th>Stock</th>
              <th>Status</th>
              <th className="num hide-md">Unit price</th>
              <th className="num hide-md">Value</th>
              <th className="actions-col">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {loading &&
              Array.from({ length: compact ? 4 : 6 }, (_, i) => (
                <tr key={`sk-${i}`} className="row-skeleton">
                  <td colSpan={7}>
                    <span className="skeleton" />
                  </td>
                </tr>
              ))}

            {!loading && products.length === 0 && (
              <tr>
                <td colSpan={7} className="empty">
                  No products match these filters.
                </td>
              </tr>
            )}

            {!loading &&
              products.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div className="product-cell">
                      <strong>{p.name}</strong>
                      <span>
                        <code>{p.sku}</code>
                        {p.location && <> · {p.location}</>}
                      </span>
                    </div>
                  </td>
                  <td className="hide-sm">{p.category?.name ?? <span className="muted">—</span>}</td>
                  <td>
                    <div className="stock-cell">
                      <span>
                        <strong>{formatNumber(p.quantity)}</strong>
                        <small> / min {p.reorder_level}</small>
                      </span>
                      <span className={`meter meter--${p.stock_status}`}>
                        <span style={{ width: `${stockFill(p.quantity, p.reorder_level)}%` }} />
                      </span>
                    </div>
                  </td>
                  <td>
                    <StatusBadge status={p.stock_status} />
                  </td>
                  <td className="num hide-md">{formatCurrency(p.unit_price)}</td>
                  <td className="num hide-md">{formatCurrency(p.unit_price * p.quantity)}</td>
                  <td className="actions-col">
                    <div className="row-actions">
                      <button className="icon-btn" onClick={() => onAdjust(p)} title="Adjust stock" aria-label={`Adjust stock for ${p.name}`}>
                        <SwapIcon />
                      </button>
                      <button className="icon-btn" onClick={() => onEdit(p)} title="Edit" aria-label={`Edit ${p.name}`}>
                        <EditIcon />
                      </button>
                      <button className="icon-btn icon-btn--danger" onClick={() => onDelete(p)} title="Delete" aria-label={`Delete ${p.name}`}>
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
  )
}
