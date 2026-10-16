import { formatCompactCurrency, formatNumber } from '../format.js'
import { AlertIcon, BoxIcon, DollarIcon, LayersIcon } from './Icons.jsx'

export default function KpiCards({ stats, loading }) {
  const cards = [
    {
      label: 'Products',
      value: formatNumber(stats?.total_products),
      hint: `${formatNumber(stats?.categories)} categories`,
      icon: BoxIcon,
      tone: 'indigo',
    },
    {
      label: 'Units on hand',
      value: formatNumber(stats?.total_units),
      hint: `${formatNumber(stats?.movements_last_24h)} movements in 24h`,
      icon: LayersIcon,
      tone: 'sky',
    },
    {
      label: 'Inventory value',
      value: formatCompactCurrency(stats?.inventory_value),
      hint: 'At unit cost',
      icon: DollarIcon,
      tone: 'emerald',
    },
    {
      label: 'Needs reorder',
      value: formatNumber((stats?.low_stock ?? 0) + (stats?.out_of_stock ?? 0)),
      hint: `${formatNumber(stats?.out_of_stock)} out of stock`,
      icon: AlertIcon,
      tone: 'amber',
    },
  ]

  return (
    <section className="kpi-grid" aria-label="Key metrics">
      {cards.map(({ label, value, hint, icon: Icon, tone }) => (
        <article key={label} className={`kpi kpi--${tone}`}>
          <div className="kpi__icon">
            <Icon />
          </div>
          <div className="kpi__body">
            <p className="kpi__label">{label}</p>
            {loading ? <span className="skeleton skeleton--kpi" /> : <p className="kpi__value">{value}</p>}
            <p className="kpi__hint">{loading ? ' ' : hint}</p>
          </div>
        </article>
      ))}
    </section>
  )
}
