import { describe, expect, it } from 'vitest'
import { formatCompactCurrency, formatCurrency, stockFill, timeAgo } from '../format.js'

describe('format helpers', () => {
  it('formats currency', () => {
    expect(formatCurrency(1234.5)).toBe('$1,234.50')
    expect(formatCurrency(null)).toBe('$0.00')
  })

  it('compacts large currency values only', () => {
    expect(formatCompactCurrency(999)).toBe('$999.00')
    expect(formatCompactCurrency(25400)).toBe('$25.4K')
  })

  it('puts the reorder level at one third of the stock bar', () => {
    expect(stockFill(10, 10)).toBe(33)
    expect(stockFill(0, 10)).toBe(0)
    expect(stockFill(500, 10)).toBe(100)
    expect(stockFill(5, 0)).toBe(100)
  })

  it('renders relative times', () => {
    const now = Date.parse('2026-10-16T12:00:00Z')
    expect(timeAgo('2026-10-16T11:59:50Z', now)).toBe('just now')
    expect(timeAgo('2026-10-16T11:30:00Z', now)).toBe('30m ago')
    expect(timeAgo('2026-10-16T07:00:00Z', now)).toBe('5h ago')
    expect(timeAgo('2026-10-13T12:00:00Z', now)).toBe('3d ago')
  })
})
