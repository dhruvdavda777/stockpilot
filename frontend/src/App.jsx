import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from './api.js'
import ActivityFeed from './components/ActivityFeed.jsx'
import AdjustModal from './components/AdjustModal.jsx'
import CategoriesView from './components/CategoriesView.jsx'
import CategoryBreakdown from './components/CategoryBreakdown.jsx'
import { AlertIcon, MenuIcon, PlusIcon, RefreshIcon } from './components/Icons.jsx'
import KpiCards from './components/KpiCards.jsx'
import ProductModal from './components/ProductModal.jsx'
import ProductTable from './components/ProductTable.jsx'
import Sidebar, { NAV_ITEMS } from './components/Sidebar.jsx'

const DEFAULT_FILTERS = { q: '', stock_status: '', category_id: '' }

const SUBTITLES = {
  dashboard: 'Live overview of stock levels, value and movements',
  products: 'Search, filter and manage every SKU',
  categories: 'Organise products into groups',
  activity: 'Audit trail of every stock movement',
}

function useDebounced(value, delay = 250) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export default function App() {
  const [view, setView] = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const [stats, setStats] = useState(null)
  const [categories, setCategories] = useState([])
  const [movements, setMovements] = useState([])
  const [attention, setAttention] = useState([])
  const [products, setProducts] = useState([])
  const [filters, setFilters] = useState(DEFAULT_FILTERS)

  const [overviewLoading, setOverviewLoading] = useState(true)
  const [productsLoading, setProductsLoading] = useState(true)
  const [backendError, setBackendError] = useState('')

  const [modal, setModal] = useState(null) // { type: 'product' | 'adjust', product? }
  const [toast, setToast] = useState(null)

  const debouncedFilters = useDebounced(filters)

  const notify = useCallback((message, tone = 'success') => {
    setToast({ message, tone, id: Date.now() })
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(t)
  }, [toast])

  const loadOverview = useCallback(async () => {
    try {
      const [s, c, m, low, out] = await Promise.all([
        api.stats(),
        api.categories(),
        api.movements({ limit: 30 }),
        api.products({ stock_status: 'low_stock', limit: 50 }),
        api.products({ stock_status: 'out_of_stock', limit: 50 }),
      ])
      setStats(s)
      setCategories(c)
      setMovements(m)
      setAttention([...out, ...low])
      setBackendError('')
    } catch (err) {
      setBackendError(err.message)
    } finally {
      setOverviewLoading(false)
    }
  }, [])

  const loadProducts = useCallback(async (f) => {
    setProductsLoading(true)
    try {
      setProducts(await api.products({ ...f, limit: 200 }))
      setBackendError('')
    } catch (err) {
      setBackendError(err.message)
    } finally {
      setProductsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadOverview()
  }, [loadOverview])

  useEffect(() => {
    loadProducts(debouncedFilters)
  }, [debouncedFilters, loadProducts])

  const refreshAll = useCallback(() => {
    loadOverview()
    loadProducts(debouncedFilters)
  }, [loadOverview, loadProducts, debouncedFilters])

  const navigate = (id) => {
    setView(id)
    setSidebarOpen(false)
  }

  async function saveProduct(payload) {
    if (modal.product) {
      await api.updateProduct(modal.product.id, payload)
      notify(`Updated ${payload.name}`)
    } else {
      await api.createProduct(payload)
      notify(`Created ${payload.name}`)
    }
    setModal(null)
    refreshAll()
  }

  async function adjustStock(payload) {
    const updated = await api.adjustStock(modal.product.id, payload)
    notify(`${updated.name}: ${payload.change > 0 ? '+' : ''}${payload.change} → ${updated.quantity} units`)
    setModal(null)
    refreshAll()
  }

  async function deleteProduct(product) {
    if (!window.confirm(`Delete ${product.name} (${product.sku})? Its movement history is deleted too.`)) return
    try {
      await api.deleteProduct(product.id)
      notify(`Deleted ${product.name}`)
      refreshAll()
    } catch (err) {
      notify(err.message, 'error')
    }
  }

  async function createCategory(payload) {
    await api.createCategory(payload)
    notify(`Added category ${payload.name}`)
    loadOverview()
  }

  async function deleteCategory(category) {
    if (!window.confirm(`Delete category ${category.name}? Its products become uncategorised.`)) return
    try {
      await api.deleteCategory(category.id)
      notify(`Deleted ${category.name}`)
      refreshAll()
    } catch (err) {
      notify(err.message, 'error')
    }
  }

  const tableHandlers = {
    onEdit: (product) => setModal({ type: 'product', product }),
    onAdjust: (product) => setModal({ type: 'adjust', product }),
    onDelete: deleteProduct,
  }

  const alerts = (stats?.low_stock ?? 0) + (stats?.out_of_stock ?? 0)
  const title = useMemo(() => NAV_ITEMS.find((n) => n.id === view)?.label, [view])
  const newProductButton = (
    <button className="btn btn--primary" onClick={() => setModal({ type: 'product' })}>
      <PlusIcon /> <span>New product</span>
    </button>
  )

  return (
    <div className="app">
      <Sidebar
        view={view}
        onNavigate={navigate}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        apiOnline={!backendError && stats !== null}
        alerts={alerts}
      />

      <main className="main">
        <header className="topbar">
          <button className="icon-btn topbar__menu" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
            <MenuIcon />
          </button>
          <div className="topbar__title">
            <h1>{title}</h1>
            <p>{SUBTITLES[view]}</p>
          </div>
          <div className="topbar__actions">
            <button className="btn btn--ghost" onClick={refreshAll} aria-label="Refresh data">
              <RefreshIcon /> <span className="hide-sm">Refresh</span>
            </button>
            {newProductButton}
          </div>
        </header>

        {backendError && (
          <div className="banner banner--error" role="alert">
            <AlertIcon />
            <div>
              <strong>Backend unavailable.</strong> {backendError}. Check that the API pods are ready
              (<code>kubectl get pods -n stockpilot</code>).
            </div>
            <button className="btn btn--ghost btn--sm" onClick={refreshAll}>
              Retry
            </button>
          </div>
        )}

        <div className="content">
          {view === 'dashboard' && (
            <>
              <KpiCards stats={stats} loading={overviewLoading} />
              <div className="grid grid--main">
                <ProductTable
                  compact
                  title="Needs attention"
                  products={attention}
                  categories={categories}
                  filters={filters}
                  onFiltersChange={setFilters}
                  loading={overviewLoading}
                  action={
                    <button className="btn btn--ghost btn--sm" onClick={() => navigate('products')}>
                      View all products
                    </button>
                  }
                  {...tableHandlers}
                />
                <div className="stack">
                  <CategoryBreakdown rows={stats?.by_category ?? []} loading={overviewLoading} />
                  <ActivityFeed movements={movements.slice(0, 6)} loading={overviewLoading} />
                </div>
              </div>
            </>
          )}

          {view === 'products' && (
            <ProductTable
              products={products}
              categories={categories}
              filters={filters}
              onFiltersChange={setFilters}
              loading={productsLoading}
              {...tableHandlers}
            />
          )}

          {view === 'categories' && (
            <CategoriesView
              categories={categories}
              loading={overviewLoading}
              onCreate={createCategory}
              onDelete={deleteCategory}
            />
          )}

          {view === 'activity' && (
            <ActivityFeed movements={movements} loading={overviewLoading} title="Stock movements" />
          )}
        </div>
      </main>

      {modal?.type === 'product' && (
        <ProductModal
          product={modal.product}
          categories={categories}
          onClose={() => setModal(null)}
          onSubmit={saveProduct}
        />
      )}
      {modal?.type === 'adjust' && (
        <AdjustModal product={modal.product} onClose={() => setModal(null)} onSubmit={adjustStock} />
      )}

      {toast && (
        <div key={toast.id} className={`toast toast--${toast.tone}`} role="status">
          {toast.message}
        </div>
      )}
    </div>
  )
}
