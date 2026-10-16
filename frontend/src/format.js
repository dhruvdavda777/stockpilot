const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 })
const number = new Intl.NumberFormat('en-US')

export const formatCurrency = (value) => currency.format(value ?? 0)
export const formatNumber = (value) => number.format(value ?? 0)
export const formatCompactCurrency = (value) =>
  (value ?? 0) >= 10000 ? '$' + compact.format(value) : currency.format(value ?? 0)

export const STATUS_LABELS = {
  in_stock: 'In stock',
  low_stock: 'Low stock',
  out_of_stock: 'Out of stock',
}

export const REASON_LABELS = {
  initial: 'Initial stock',
  restock: 'Restock',
  sale: 'Sale',
  return: 'Customer return',
  adjustment: 'Adjustment',
  damaged: 'Damaged / written off',
}

export function timeAgo(iso, now = Date.now()) {
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000))
  if (seconds < 45) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  return `${days}d ago`
}

// Fill level of the stock bar: reorder level sits at 1/3 of the bar, so
// "low" visually reads as the bottom third.
export function stockFill(quantity, reorderLevel) {
  const full = Math.max(reorderLevel * 3, 1)
  return Math.min(100, Math.round((quantity / full) * 100))
}
