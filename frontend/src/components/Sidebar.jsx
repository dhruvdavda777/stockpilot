import { ActivityIcon, BoxIcon, CloseIcon, DashboardIcon, LogoIcon, TagIcon } from './Icons.jsx'
import PipelineStatus from './PipelineStatus.jsx'

export const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: DashboardIcon },
  { id: 'products', label: 'Products', icon: BoxIcon },
  { id: 'categories', label: 'Categories', icon: TagIcon },
  { id: 'activity', label: 'Stock activity', icon: ActivityIcon },
]

export default function Sidebar({ view, onNavigate, open, onClose, apiOnline, alerts }) {
  return (
    <>
      <div className={`sidebar-backdrop ${open ? 'is-open' : ''}`} onClick={onClose} />
      <aside className={`sidebar ${open ? 'is-open' : ''}`} aria-label="Main navigation">
        <div className="sidebar__brand">
          <span className="sidebar__logo">
            <LogoIcon />
          </span>
          <div>
            <strong>StockPilot</strong>
            <small>Inventory Cloud</small>
          </div>
          <button className="icon-btn sidebar__close" onClick={onClose} aria-label="Close menu">
            <CloseIcon />
          </button>
        </div>

        <div className="sidebar__workspace">
          <span className="workspace-avatar">AW</span>
          <div>
            <strong>Acme Warehouse</strong>
            <small>Mumbai DC · Main</small>
          </div>
        </div>

        <nav className="sidebar__nav">
          <p className="sidebar__label">Workspace</p>
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`nav-item ${view === id ? 'is-active' : ''}`}
              onClick={() => onNavigate(id)}
              aria-current={view === id ? 'page' : undefined}
            >
              <Icon />
              <span>{label}</span>
              {id === 'products' && alerts > 0 && <span className="nav-item__badge">{alerts}</span>}
            </button>
          ))}
        </nav>

        <PipelineStatus apiOnline={apiOnline} />
      </aside>
    </>
  )
}
