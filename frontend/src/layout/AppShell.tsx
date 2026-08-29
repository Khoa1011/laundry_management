import {
  Building2,
  ChevronDown,
  ClipboardList,
  Droplet,
  Globe2,
  Home,
  LogOut,
  Menu,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Settings2,
  ShieldCheck,
  Sparkles,
  Tags,
  Users,
  UsersRound,
  X,
} from 'lucide-react'
import { AnimatePresence, m } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { PERMISSION_CODES, type PermissionCode } from '../auth/permissionCodes.generated'
import { AppNavLink } from '../components/navigation/AppNavLink'
import { Button, ButtonLink } from '../components/ui/Button'
import { IconButton, IconButtonLink } from '../components/ui/IconButton'
import { QuickCustomerDialog } from '../features/customers/QuickCustomerDialog'
import { NotificationBell } from '../features/notifications/components/NotificationBell'
import { motionDuration, motionEase } from '../providers/motionPresets'

const navItems = [
  { to: '/overview', key: 'overview', icon: Home },
  { to: '/orders', key: 'orders', icon: ClipboardList },
  { to: '/customers', key: 'customers', icon: Users, permission: PERMISSION_CODES.CUSTOMER_READ },
  { to: '/employees', key: 'employees', icon: UsersRound, permission: PERMISSION_CODES.EMPLOYEE_READ },
  { to: '/more', key: 'more', icon: MoreHorizontal },
] as const

export function AppShell() {
  const { t, i18n } = useTranslation()
  const { user, branchId, setBranchId, logout, hasPermission } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [quickCreateOpen, setQuickCreateOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem('laundry.sidebar.collapsed') === 'true',
  )
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null)
  const mobileDrawerRef = useRef<HTMLElement>(null)

  const focused = location.pathname === '/customers/new'
    || /\/customers\/\d+\/edit$/.test(location.pathname)
    || location.pathname === '/employees/new'
    || /\/employees\/\d+\/edit$/.test(location.pathname)
    || /\/settings\/access\/roles\/(?:new|\d+\/(?:edit|permissions))$/.test(location.pathname)
  const canCreate = hasPermission(PERMISSION_CODES.CUSTOMER_CREATE)
  const visibleNavItems = navItems.filter((item) =>
    !('permission' in item) || hasPermission(item.permission as PermissionCode))
  const canOpenAccess = [
    PERMISSION_CODES.ACCESS_ROLE_READ,
    PERMISSION_CODES.ACCESS_USER_READ,
    PERMISSION_CODES.ACCESS_PERMISSION_READ,
    PERMISSION_CODES.ACCESS_AUDIT_READ,
  ].some(hasPermission)
  const canOpenCatalog = [
    PERMISSION_CODES.SERVICE_READ,
    PERMISSION_CODES.ITEM_TYPE_READ,
    PERMISSION_CODES.PRICE_LIST_READ,
  ].some(hasPermission)
  const desktopPrimaryNavItems = visibleNavItems.filter((item) => item.key !== 'more')
  const itemLabel = (key: typeof navItems[number]['key']) =>
    key === 'employees' ? t('employee:title') : t(`navigation:${key}`)

  const toggleSidebar = () => setSidebarCollapsed((current) => {
    const next = !current
    localStorage.setItem('laundry.sidebar.collapsed', String(next))
    return next
  })

  useEffect(() => {
    if (!mobileMenuOpen) return
    const drawer = mobileDrawerRef.current
    const trigger = mobileMenuButtonRef.current
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    drawer?.querySelector<HTMLElement>('button, a, select')?.focus()

    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setMobileMenuOpen(false)
        return
      }
      if (event.key !== 'Tab' || !drawer) return
      const focusable = Array.from(
        drawer.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], select:not([disabled])'),
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      trigger?.focus()
    }
  }, [mobileMenuOpen])

  useEffect(() => {
    const onNavigate = (event: Event) => {
      const route = (event as CustomEvent<string>).detail
      if (typeof route === 'string' && route.startsWith('/')) navigate(route)
    }
    window.addEventListener('laundry:navigate', onNavigate)
    return () => window.removeEventListener('laundry:navigate', onNavigate)
  }, [navigate])

  const signOut = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  const selfEmployeeLink = !hasPermission(PERMISSION_CODES.EMPLOYEE_READ)
    && hasPermission(PERMISSION_CODES.EMPLOYEE_READ_SELF)

  return (
    <div className={`application-shell${focused ? ' application-shell--focused' : ''}${sidebarCollapsed ? ' application-shell--sidebar-collapsed' : ''}`}>
      <a className="skip-link" href="#main-content">{t('skipToContent')}</a>

      <aside className="desktop-sidebar">
        <div className="desktop-sidebar__header">
          <div className="brand">
            <span className="brand__mark brand__mark--laundry"><Droplet size={24} aria-hidden="true" /></span>
            <span><strong>{t('appName')}</strong><small>{t('appMode')}</small></span>
          </div>
          <IconButton
            type="button"
            className="sidebar-collapse-button"
            onClick={toggleSidebar}
            label={sidebarCollapsed ? t('expandSidebar') : t('collapseSidebar')}
            title={sidebarCollapsed ? t('expandSidebar') : t('collapseSidebar')}
          >
            {sidebarCollapsed
              ? <PanelLeftOpen size={19} aria-hidden="true" />
              : <PanelLeftClose size={19} aria-hidden="true" />}
          </IconButton>
        </div>

        <p className="sidebar-group-label">{t('navigation:operations')}</p>
        <nav className="sidebar-nav" aria-label={t('navigation:operations')}>
          {desktopPrimaryNavItems.map(({ to, key, icon: Icon }) => (
            <AppNavLink key={to} to={to} title={itemLabel(key)} indicatorId="desktop-sidebar-active">
              <span className="nav-item__icon-tile"><Icon size={20} aria-hidden="true" /></span>
              <span>{itemLabel(key)}</span>
            </AppNavLink>
          ))}
          {selfEmployeeLink && (
            <AppNavLink to="/employees/me" title={t('employee:selfTitle')} indicatorId="desktop-sidebar-active">
              <span className="nav-item__icon-tile"><UsersRound size={20} aria-hidden="true" /></span>
              <span>{t('employee:selfTitle')}</span>
            </AppNavLink>
          )}
        </nav>

        <p className="sidebar-group-label sidebar-group-label--admin">{t('navigation:administration')}</p>
        <nav className="sidebar-nav sidebar-nav--secondary" aria-label={t('navigation:administration')}>
          {canOpenCatalog && (
            <AppNavLink to="/catalog/services" title={t('catalog:navigation')} indicatorId="desktop-sidebar-active">
              <span className="nav-item__icon-tile"><Tags size={20} aria-hidden="true" /></span>
              <span>{t('catalog:navigation')}</span>
            </AppNavLink>
          )}
          {canOpenAccess && (
            <AppNavLink to="/settings/access" title={t('access:accessControl')} indicatorId="desktop-sidebar-active">
              <span className="nav-item__icon-tile"><ShieldCheck size={20} aria-hidden="true" /></span>
              <span>{t('access:accessControl')}</span>
            </AppNavLink>
          )}
          <AppNavLink to="/more" title={t('navigation:more')} indicatorId="desktop-sidebar-active">
            <span className="nav-item__icon-tile"><MoreHorizontal size={20} aria-hidden="true" /></span>
            <span>{t('navigation:more')}</span>
          </AppNavLink>
        </nav>

        <AppNavLink
          to="/settings/preferences"
          title={t('navigation:preferences')}
          className="nav-item nav-item--settings"
          indicatorId="desktop-sidebar-active"
        >
          <span className="nav-item__icon-tile"><Settings2 size={20} aria-hidden="true" /></span>
          <span>{t('navigation:preferences')}</span>
        </AppNavLink>
      </aside>

      <header className="app-header">
        <IconButton
          ref={mobileMenuButtonRef}
          type="button"
          className="mobile-menu-button"
          onClick={() => setMobileMenuOpen(true)}
          label={t('menu')}
        >
          <Menu size={22} aria-hidden="true" />
        </IconButton>
        <div className="mobile-brand"><Droplet size={20} aria-hidden="true" /><strong>{t('appName')}</strong></div>
        <div className="header-spacer" />
        {user && user.branches.length > 0 && (
          <label className="header-select">
            <span className="sr-only">{t('branch')}</span>
            <span className="header-select__icon"><Building2 size={18} aria-hidden="true" /></span>
            <select value={branchId ?? ''} onChange={(event) => setBranchId(Number(event.target.value))}>
              {user.branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </select>
            <ChevronDown size={16} aria-hidden="true" />
          </label>
        )}
        <NotificationBell />
        <div className="desktop-header-controls">
          <IconButtonLink className="header-appearance-button" to="/settings/preferences" label={t('appearance:title')} title={t('appearance:title')}>
            <Sparkles size={18} aria-hidden="true" />
          </IconButtonLink>
          <label className="compact-select">
            <Globe2 size={17} aria-hidden="true" />
            <span className="sr-only">{t('language')}</span>
            <select value={i18n.language.startsWith('en') ? 'en' : 'vi'} onChange={(event) => void i18n.changeLanguage(event.target.value)}>
              <option value="vi">VI</option>
              <option value="en">EN</option>
            </select>
          </label>
          <div className="user-context">
            <span className="avatar avatar--small">{user?.displayName.slice(0, 1).toLocaleUpperCase()}</span>
            <span><strong>{user?.displayName}</strong><small>{user?.roles[0]}</small></span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="header-logout-button"
            aria-label={t('logout')}
            title={t('logout')}
            onClick={() => void signOut()}
          >
            <LogOut size={18} aria-hidden="true" /><span>{t('logout')}</span>
          </Button>
        </div>
      </header>

      <AnimatePresence initial={false}>
        {mobileMenuOpen && (
          <m.div
            className="mobile-drawer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: motionDuration.primitive }}
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setMobileMenuOpen(false)
            }}
          >
            <m.aside
              ref={mobileDrawerRef}
              className="mobile-drawer"
              role="dialog"
              aria-modal="true"
              aria-label={t('menu')}
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: motionDuration.structural, ease: motionEase }}
            >
              <div className="mobile-drawer__header">
                <div className="brand">
                  <span className="brand__mark brand__mark--laundry"><Droplet size={24} aria-hidden="true" /></span>
                  <span><strong>{t('appName')}</strong><small>{t('appMode')}</small></span>
                </div>
                <IconButton onClick={() => setMobileMenuOpen(false)} label={t('close')}><X size={20} /></IconButton>
              </div>
              <nav className="mobile-drawer__nav" aria-label={t('menu')}>
                {visibleNavItems.map(({ to, key, icon: Icon }) => (
                  <AppNavLink key={to} to={to} onClick={() => setMobileMenuOpen(false)} indicatorId="mobile-drawer-active">
                    <Icon size={20} aria-hidden="true" />
                    <span>{itemLabel(key)}</span>
                  </AppNavLink>
                ))}
                {selfEmployeeLink && (
                  <AppNavLink to="/employees/me" onClick={() => setMobileMenuOpen(false)} indicatorId="mobile-drawer-active">
                    <UsersRound size={20} aria-hidden="true" />
                    <span>{t('employee:selfTitle')}</span>
                  </AppNavLink>
                )}
                {canOpenCatalog && (
                  <AppNavLink to="/catalog/services" onClick={() => setMobileMenuOpen(false)} indicatorId="mobile-drawer-active">
                    <Tags size={20} aria-hidden="true" />
                    <span>{t('catalog:navigation')}</span>
                  </AppNavLink>
                )}
                {canOpenAccess && (
                  <AppNavLink to="/settings/access" onClick={() => setMobileMenuOpen(false)} indicatorId="mobile-drawer-active">
                    <ShieldCheck size={20} aria-hidden="true" />
                    <span>{t('access:accessControl')}</span>
                  </AppNavLink>
                )}
              </nav>
              <div className="mobile-preferences">
                <ButtonLink to="/settings/preferences" onClick={() => setMobileMenuOpen(false)} variant="secondary">
                  <Sparkles size={18} aria-hidden="true" />{t('appearance:title')}
                </ButtonLink>
                <label>{t('language')}
                  <select value={i18n.language.startsWith('en') ? 'en' : 'vi'} onChange={(event) => void i18n.changeLanguage(event.target.value)}>
                    <option value="vi">{t('vietnamese')}</option>
                    <option value="en">{t('english')}</option>
                  </select>
                </label>
                <Button variant="secondary" onClick={() => void signOut()}>{t('logout')}</Button>
              </div>
            </m.aside>
          </m.div>
        )}
      </AnimatePresence>

      <main id="main-content" className="app-main"><Outlet /></main>

      {!focused && (
        <nav className="mobile-bottom-nav" aria-label={t('menu')}>
          <AppNavLink to="/overview" className="" activeClassName="active" indicatorId="mobile-bottom-active">
            <Home size={23} aria-hidden="true" /><span>{t('navigation:overview')}</span>
          </AppNavLink>
          <AppNavLink to="/orders" className="" activeClassName="active" indicatorId="mobile-bottom-active">
            <ClipboardList size={23} aria-hidden="true" /><span>{t('navigation:orders')}</span>
          </AppNavLink>
          <IconButton
            type="button"
            className="central-create"
            variant="primary"
            onClick={() => canCreate && setQuickCreateOpen(true)}
            disabled={!canCreate}
            label={t('customers:quickAdd')}
          >
            <Plus size={28} aria-hidden="true" />
          </IconButton>
          {hasPermission(PERMISSION_CODES.CUSTOMER_READ) && (
            <AppNavLink to="/customers" className="" activeClassName="active" indicatorId="mobile-bottom-active">
              <Users size={23} aria-hidden="true" /><span>{t('navigation:customers')}</span>
            </AppNavLink>
          )}
          <AppNavLink to="/more" className="" activeClassName="active" indicatorId="mobile-bottom-active">
            <MoreHorizontal size={23} aria-hidden="true" /><span>{t('navigation:more')}</span>
          </AppNavLink>
        </nav>
      )}
      {canCreate && <QuickCustomerDialog open={quickCreateOpen} onClose={() => setQuickCreateOpen(false)} />}
    </div>
  )
}
