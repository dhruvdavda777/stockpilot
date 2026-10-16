import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import KpiCards from '../components/KpiCards.jsx'
import ProductTable from '../components/ProductTable.jsx'
import StatusBadge from '../components/StatusBadge.jsx'

afterEach(cleanup)

const stats = {
  total_products: 12,
  total_units: 1021,
  inventory_value: 25400,
  low_stock: 3,
  out_of_stock: 2,
  categories: 4,
  movements_last_24h: 7,
}

describe('KpiCards', () => {
  it('shows totals and the combined reorder count', () => {
    render(<KpiCards stats={stats} loading={false} />)
    expect(screen.getByText('12')).toBeTruthy()
    expect(screen.getByText('1,021')).toBeTruthy()
    expect(screen.getByText('$25.4K')).toBeTruthy()
    expect(screen.getByText('5')).toBeTruthy() // 3 low + 2 out
    expect(screen.getByText('2 out of stock')).toBeTruthy()
  })
})

describe('StatusBadge', () => {
  it('labels stock statuses', () => {
    render(<StatusBadge status="low_stock" />)
    expect(screen.getByText('Low stock').className).toContain('badge--low_stock')
  })
})

describe('ProductTable', () => {
  const props = {
    categories: [],
    filters: { q: '', stock_status: '', category_id: '' },
    onFiltersChange: vi.fn(),
    onEdit: vi.fn(),
    onAdjust: vi.fn(),
    onDelete: vi.fn(),
  }

  it('renders an empty state', () => {
    render(<ProductTable {...props} products={[]} loading={false} />)
    expect(screen.getByText('No products match these filters.')).toBeTruthy()
  })

  it('renders product rows with value', () => {
    const product = {
      id: 1,
      sku: 'EL-1',
      name: 'Mouse',
      quantity: 4,
      reorder_level: 10,
      unit_price: 2.5,
      stock_status: 'low_stock',
      category: { id: 1, name: 'Electronics' },
    }
    render(<ProductTable {...props} products={[product]} loading={false} />)
    expect(screen.getByText('Mouse')).toBeTruthy()
    expect(screen.getByText('Electronics')).toBeTruthy()
    expect(screen.getByText('$10.00')).toBeTruthy()
  })
})
