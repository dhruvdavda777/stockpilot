import { REASON_LABELS, timeAgo } from '../format.js'
import { ArrowDownIcon, ArrowUpIcon } from './Icons.jsx'

export default function ActivityFeed({ movements, loading, title = 'Recent activity' }) {
  return (
    <section className="card">
      <header className="card__header">
        <div>
          <h2 className="card__title">{title}</h2>
          <p className="card__subtitle">Every stock change is audited</p>
        </div>
      </header>
      {loading ? (
        <ul className="feed">
          {Array.from({ length: 5 }, (_, i) => (
            <li key={i} className="feed__item">
              <span className="skeleton" />
            </li>
          ))}
        </ul>
      ) : movements.length === 0 ? (
        <p className="empty">No stock movements yet.</p>
      ) : (
        <ul className="feed">
          {movements.map((m) => {
            const incoming = m.change > 0
            return (
              <li key={m.id} className="feed__item">
                <span className={`feed__icon ${incoming ? 'is-in' : 'is-out'}`}>
                  {incoming ? <ArrowUpIcon /> : <ArrowDownIcon />}
                </span>
                <div className="feed__body">
                  <p>
                    <strong>{m.product_name}</strong>{' '}
                    <span className={incoming ? 'text-in' : 'text-out'}>
                      {incoming ? '+' : ''}
                      {m.change}
                    </span>
                  </p>
                  <small>
                    {REASON_LABELS[m.reason] ?? m.reason}
                    {m.note && <> · {m.note}</>} · {m.quantity_after} left
                  </small>
                </div>
                <time dateTime={m.created_at} className="feed__time">
                  {timeAgo(m.created_at)}
                </time>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
