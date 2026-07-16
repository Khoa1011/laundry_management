import { Bell, ChevronDown, ClipboardList, Home, Languages, Menu, MoreHorizontal, Plus, Settings2, Shirt, Sparkles, Users, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { QuickCustomerDialog } from '../features/customers/QuickCustomerDialog'
import { useTheme } from '../providers/ThemeProvider'

const navItems = [
  { to: '/overview', key: 'overview', icon: Home },
  { to: '/orders', key: 'orders', icon: ClipboardList },
  { to: '/customers', key: 'customers', icon: Users },
  { to: '/more', key: 'more', icon: MoreHorizontal },
] as const

export function AppShell() {
  const { t, i18n } = useTranslation()
  const { user, branchId, setBranchId, logout, hasPermission } = useAuth()
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const [quickCreateOpen, setQuickCreateOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const focused = location.pathname === '/customers/new' || /\/customers\/\d+\/edit$/.test(location.pathname)
  const canCreate = hasPermission('customer.create')

  const signOut = () => { logout(); navigate('/login', { replace: true }) }
  return (
    <div className={`application-shell${focused ? ' application-shell--focused' : ''}`}>
      <aside className="desktop-sidebar">
        <div className="brand"><span className="brand__mark"><Shirt size={22} aria-hidden="true" /></span><span><strong>{t('appName')}</strong><small>POS</small></span></div>
        <nav className="sidebar-nav" aria-label={t('navigation:customers')}>
          {navItems.map(({ to, key, icon: Icon }) => <NavLink key={to} to={to} className={({ isActive }) => `nav-item${isActive ? ' nav-item--active' : ''}`}><Icon size={20} aria-hidden="true" /><span>{t(`navigation:${key}`)}</span></NavLink>)}
        </nav>
        <NavLink to="/settings/preferences" className="nav-item nav-item--settings"><Settings2 size={20} aria-hidden="true" /><span>{t('navigation:preferences')}</span></NavLink>
      </aside>

      <header className="app-header">
        <button type="button" className="icon-button mobile-menu-button" onClick={() => setMobileMenuOpen(true)} aria-label={t('menu')}><Menu size={22} aria-hidden="true" /></button>
        <div className="mobile-brand"><Shirt size={20} aria-hidden="true" /><strong>{t('appName')}</strong></div>
        <div className="header-spacer" />
        {user && user.branches.length > 0 && <label className="header-select"><span className="sr-only">{t('branch')}</span><select value={branchId ?? ''} onChange={(event) => setBranchId(Number(event.target.value))}>{user.branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select><ChevronDown size={16} aria-hidden="true" /></label>}
        <div className="desktop-header-controls">
          <label className="compact-select"><Sparkles size={17} aria-hidden="true" /><span className="sr-only">{t('theme')}</span><select value={theme} onChange={(event) => setTheme(event.target.value as typeof theme)}><option value="laundry-teal">{t('teal')}</option><option value="laundry-indigo">{t('indigo')}</option></select></label>
          <label className="compact-select"><Languages size={17} aria-hidden="true" /><span className="sr-only">{t('language')}</span><select value={i18n.language.startsWith('en') ? 'en' : 'vi'} onChange={(event) => void i18n.changeLanguage(event.target.value)}><option value="vi">VI</option><option value="en">EN</option></select></label>
          <button type="button" className="icon-button" aria-label={t('notifications')} title={t('noNotifications')}><Bell size={20} aria-hidden="true" /></button>
          <div className="user-context"><span className="avatar avatar--small">{user?.displayName.slice(0, 1).toLocaleUpperCase()}</span><span><strong>{user?.displayName}</strong><small>{user?.roles[0]}</small></span><button type="button" className="text-button" onClick={signOut}>{t('logout')}</button></div>
        </div>
      </header>

      {mobileMenuOpen && <div className="mobile-drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setMobileMenuOpen(false) }}><aside className="mobile-drawer" aria-label={t('menu')}><div className="mobile-drawer__header"><div className="brand"><span className="brand__mark"><Shirt size={22} /></span><strong>{t('appName')}</strong></div><button className="icon-button" onClick={() => setMobileMenuOpen(false)} aria-label={t('close')}><X size={20} /></button></div>{navItems.map(({ to, key, icon: Icon }) => <NavLink key={to} to={to} onClick={() => setMobileMenuOpen(false)} className={({ isActive }) => `nav-item${isActive ? ' nav-item--active' : ''}`}><Icon size={20} /><span>{t(`navigation:${key}`)}</span></NavLink>)}<div className="mobile-preferences"><label>{t('theme')}<select value={theme} onChange={(event) => setTheme(event.target.value as typeof theme)}><option value="laundry-teal">{t('teal')}</option><option value="laundry-indigo">{t('indigo')}</option></select></label><label>{t('language')}<select value={i18n.language.startsWith('en') ? 'en' : 'vi'} onChange={(event) => void i18n.changeLanguage(event.target.value)}><option value="vi">{t('vietnamese')}</option><option value="en">{t('english')}</option></select></label><button className="button button--secondary" onClick={signOut}>{t('logout')}</button></div></aside></div>}

      <main className="app-main"><Outlet /></main>

      {!focused && <nav className="mobile-bottom-nav" aria-label={t('menu')}>
        <NavLink to="/overview" className={({ isActive }) => isActive ? 'active' : ''}><Home size={23} /><span>{t('navigation:overview')}</span></NavLink>
        <NavLink to="/orders" className={({ isActive }) => isActive ? 'active' : ''}><ClipboardList size={23} /><span>{t('navigation:orders')}</span></NavLink>
        <button type="button" className="central-create" onClick={() => canCreate && setQuickCreateOpen(true)} disabled={!canCreate} aria-label={t('customers:quickAdd')}><Plus size={28} /></button>
        <NavLink to="/customers" className={({ isActive }) => isActive ? 'active' : ''}><Users size={23} /><span>{t('navigation:customers')}</span></NavLink>
        <NavLink to="/more" className={({ isActive }) => isActive ? 'active' : ''}><MoreHorizontal size={23} /><span>{t('navigation:more')}</span></NavLink>
      </nav>}
      <QuickCustomerDialog open={quickCreateOpen} onClose={() => setQuickCreateOpen(false)} />
    </div>
  )
}
