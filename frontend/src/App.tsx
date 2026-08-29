import { lazy, Suspense, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { createBrowserRouter, Navigate, Outlet, RouterProvider, useLocation } from 'react-router-dom'
import { useAuth } from './auth/AuthProvider'
import { PERMISSION_CODES, type PermissionCode } from './auth/permissionCodes.generated'
import { StatePanel } from './components/States'
import { AppShell } from './layout/AppShell'
import { LoginPage } from './pages/LoginPage'

const CustomerListPage = lazy(() => import('./features/customers/CustomerListPage').then((module) => ({ default: module.CustomerListPage })))
const CustomerFormPage = lazy(() => import('./features/customers/CustomerFormPage').then((module) => ({ default: module.CustomerFormPage })))
const CustomerDetailPage = lazy(() => import('./features/customers/CustomerDetailPage').then((module) => ({ default: module.CustomerDetailPage })))
const EmployeeListPage = lazy(() => import('./features/employees/EmployeeListPage').then((module) => ({ default: module.EmployeeListPage })))
const EmployeeFormPage = lazy(() => import('./features/employees/EmployeeFormPage').then((module) => ({ default: module.EmployeeFormPage })))
const EmployeeDetailPage = lazy(() => import('./features/employees/EmployeeDetailPage').then((module) => ({ default: module.EmployeeDetailPage })))
const EmployeeSelfPage = lazy(() => import('./features/employees/EmployeeDetailPage').then((module) => ({ default: module.EmployeeSelfPage })))
const EmployeePositionsPage = lazy(() => import('./features/employees/EmployeePositionsPage').then((module) => ({ default: module.EmployeePositionsPage })))
const OverviewPage = lazy(() => import('./pages/OperationalLandingPages').then((module) => ({ default: module.OverviewPage })))
const MorePage = lazy(() => import('./pages/OperationalLandingPages').then((module) => ({ default: module.MorePage })))
const OrdersUnavailablePage = lazy(() => import('./pages/OperationalLandingPages').then((module) => ({ default: module.OrdersUnavailablePage })))
const ForbiddenPage = lazy(() => import('./pages/PlaceholderPage').then((module) => ({ default: module.ForbiddenPage })))
const NotFoundPage = lazy(() => import('./pages/PlaceholderPage').then((module) => ({ default: module.NotFoundPage })))
const AccessLandingPage = lazy(() => import('./features/access-control/AccessPages').then((module) => ({ default: module.AccessLandingPage })))
const RoleListPage = lazy(() => import('./features/access-control/RolePages').then((module) => ({ default: module.RoleListPage })))
const RoleFormPage = lazy(() => import('./features/access-control/RolePages').then((module) => ({ default: module.RoleFormPage })))
const RoleDetailPage = lazy(() => import('./features/access-control/RolePages').then((module) => ({ default: module.RoleDetailPage })))
const RoleMatrixPage = lazy(() => import('./features/access-control/AccessPages').then((module) => ({ default: module.RoleMatrixPage })))
const UserListPage = lazy(() => import('./features/access-control/AccessPages').then((module) => ({ default: module.UserListPage })))
const UserAccessPage = lazy(() => import('./features/access-control/AccessPages').then((module) => ({ default: module.UserAccessPage })))
const PermissionCatalogPage = lazy(() => import('./features/access-control/AccessPages').then((module) => ({ default: module.PermissionCatalogPage })))
const AccessAuditPage = lazy(() => import('./features/access-control/AccessPages').then((module) => ({ default: module.AccessAuditPage })))
const NotificationCenterPage = lazy(() => import('./features/notifications/pages/NotificationCenterPage').then((module) => ({ default: module.NotificationCenterPage })))
const AppearanceSettingsPage = lazy(() => import('./features/appearance/AppearanceSettingsPage').then((module) => ({ default: module.AppearanceSettingsPage })))
const ServiceCatalogPage = lazy(() => import('./features/service-catalog/CatalogPages').then((module) => ({ default: module.ServiceCatalogPage })))
const ItemTypeCatalogPage = lazy(() => import('./features/service-catalog/CatalogPages').then((module) => ({ default: module.ItemTypeCatalogPage })))
const PriceListPage = lazy(() => import('./features/service-catalog/CatalogPages').then((module) => ({ default: module.PriceListPage })))
const PriceListDetailPage = lazy(() => import('./features/service-catalog/CatalogPages').then((module) => ({ default: module.PriceListDetailPage })))

function LazyPage({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  return <Suspense fallback={<div className="route-loading" role="status">{t('loading')}</div>}>{children}</Suspense>
}

function ProtectedRoute() {
  const { t } = useTranslation()
  const { user, isRestoring } = useAuth()
  const location = useLocation()
  if (isRestoring) return <div className="route-loading" role="status">{t('loading')}</div>
  return user ? <Outlet /> : <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />
}

function PermissionRoute({ permission, children }: { permission: PermissionCode; children: ReactNode }) {
  const { hasPermission } = useAuth()
  return hasPermission(permission) ? children : <Navigate to="/forbidden" replace />
}

function AnyPermissionRoute({ permissions, children }: { permissions: PermissionCode[]; children: ReactNode }) {
  const { hasPermission } = useAuth()
  return permissions.some(hasPermission) ? children : <Navigate to="/forbidden" replace />
}

function HomeRedirect() {
  const { hasPermission } = useAuth()
  if (hasPermission(PERMISSION_CODES.CUSTOMER_READ)) return <Navigate to="/customers" replace />
  if (hasPermission(PERMISSION_CODES.EMPLOYEE_READ)) return <Navigate to="/employees" replace />
  if (hasPermission(PERMISSION_CODES.EMPLOYEE_READ_SELF)) return <Navigate to="/employees/me" replace />
  if (hasPermission(PERMISSION_CODES.SERVICE_READ)) return <Navigate to="/catalog/services" replace />
  return <Navigate to="/overview" replace />
}

function RouteError() {
  const { t } = useTranslation()
  return <main className="standalone-state"><StatePanel title={t('errors:genericTitle')} body={t('errors:genericBody')} action={<a className="button button--secondary" href="/customers">{t('goHome')}</a>} /></main>
}

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage />, errorElement: <RouteError /> },
  { element: <ProtectedRoute />, errorElement: <RouteError />, children: [
    { element: <AppShell />, children: [
      { index: true, element: <HomeRedirect /> },
      { path: '/customers', element: <PermissionRoute permission={PERMISSION_CODES.CUSTOMER_READ}><LazyPage><CustomerListPage /></LazyPage></PermissionRoute> },
      { path: '/customers/new', element: <PermissionRoute permission={PERMISSION_CODES.CUSTOMER_CREATE}><LazyPage><CustomerFormPage /></LazyPage></PermissionRoute> },
      { path: '/customers/:customerId', element: <PermissionRoute permission={PERMISSION_CODES.CUSTOMER_READ}><LazyPage><CustomerDetailPage /></LazyPage></PermissionRoute> },
      { path: '/customers/:customerId/edit', element: <PermissionRoute permission={PERMISSION_CODES.CUSTOMER_UPDATE}><LazyPage><CustomerFormPage /></LazyPage></PermissionRoute> },
      { path: '/employees', element: <PermissionRoute permission={PERMISSION_CODES.EMPLOYEE_READ}><LazyPage><EmployeeListPage /></LazyPage></PermissionRoute> },
      { path: '/employees/new', element: <PermissionRoute permission={PERMISSION_CODES.EMPLOYEE_CREATE}><LazyPage><EmployeeFormPage /></LazyPage></PermissionRoute> },
      { path: '/employees/me', element: <PermissionRoute permission={PERMISSION_CODES.EMPLOYEE_READ_SELF}><LazyPage><EmployeeSelfPage /></LazyPage></PermissionRoute> },
      { path: '/employees/positions', element: <PermissionRoute permission={PERMISSION_CODES.EMPLOYEE_POSITION_MANAGE}><LazyPage><EmployeePositionsPage /></LazyPage></PermissionRoute> },
      { path: '/employees/:employeeId', element: <PermissionRoute permission={PERMISSION_CODES.EMPLOYEE_READ}><LazyPage><EmployeeDetailPage /></LazyPage></PermissionRoute> },
      { path: '/employees/:employeeId/edit', element: <PermissionRoute permission={PERMISSION_CODES.EMPLOYEE_UPDATE}><LazyPage><EmployeeFormPage /></LazyPage></PermissionRoute> },
      { path: '/notifications', element: <PermissionRoute permission={PERMISSION_CODES.NOTIFICATION_READ_OWN}><LazyPage><NotificationCenterPage /></LazyPage></PermissionRoute> },
      { path: '/catalog/services', element: <PermissionRoute permission={PERMISSION_CODES.SERVICE_READ}><LazyPage><ServiceCatalogPage /></LazyPage></PermissionRoute> },
      { path: '/catalog/item-types', element: <PermissionRoute permission={PERMISSION_CODES.ITEM_TYPE_READ}><LazyPage><ItemTypeCatalogPage /></LazyPage></PermissionRoute> },
      { path: '/catalog/price-lists', element: <PermissionRoute permission={PERMISSION_CODES.PRICE_LIST_READ}><LazyPage><PriceListPage /></LazyPage></PermissionRoute> },
      { path: '/catalog/price-lists/:priceListId', element: <PermissionRoute permission={PERMISSION_CODES.PRICE_LIST_READ}><PermissionRoute permission={PERMISSION_CODES.PRICE_RULE_READ}><LazyPage><PriceListDetailPage /></LazyPage></PermissionRoute></PermissionRoute> },
      { path: '/overview', element: <LazyPage><OverviewPage /></LazyPage> },
      { path: '/orders', element: <LazyPage><OrdersUnavailablePage /></LazyPage> },
      { path: '/more', element: <LazyPage><MorePage /></LazyPage> },
      { path: '/settings/preferences', element: <LazyPage><AppearanceSettingsPage /></LazyPage> },
      { path: '/settings/access', element: <AnyPermissionRoute permissions={[PERMISSION_CODES.ACCESS_ROLE_READ, PERMISSION_CODES.ACCESS_USER_READ, PERMISSION_CODES.ACCESS_PERMISSION_READ, PERMISSION_CODES.ACCESS_AUDIT_READ]}><LazyPage><AccessLandingPage /></LazyPage></AnyPermissionRoute> },
      { path: '/settings/access/roles', element: <PermissionRoute permission={PERMISSION_CODES.ACCESS_ROLE_READ}><LazyPage><RoleListPage /></LazyPage></PermissionRoute> },
      { path: '/settings/access/roles/new', element: <PermissionRoute permission={PERMISSION_CODES.ACCESS_ROLE_CREATE}><LazyPage><RoleFormPage /></LazyPage></PermissionRoute> },
      { path: '/settings/access/roles/:roleId', element: <PermissionRoute permission={PERMISSION_CODES.ACCESS_ROLE_READ}><LazyPage><RoleDetailPage /></LazyPage></PermissionRoute> },
      { path: '/settings/access/roles/:roleId/edit', element: <PermissionRoute permission={PERMISSION_CODES.ACCESS_ROLE_UPDATE}><LazyPage><RoleFormPage /></LazyPage></PermissionRoute> },
      { path: '/settings/access/roles/:roleId/permissions', element: <PermissionRoute permission={PERMISSION_CODES.ACCESS_ROLE_PERMISSION_ASSIGN}><LazyPage><RoleMatrixPage /></LazyPage></PermissionRoute> },
      { path: '/settings/access/users', element: <PermissionRoute permission={PERMISSION_CODES.ACCESS_USER_READ}><LazyPage><UserListPage /></LazyPage></PermissionRoute> },
      { path: '/settings/access/users/:userId', element: <PermissionRoute permission={PERMISSION_CODES.ACCESS_USER_READ}><LazyPage><UserAccessPage /></LazyPage></PermissionRoute> },
      { path: '/settings/access/permissions', element: <PermissionRoute permission={PERMISSION_CODES.ACCESS_PERMISSION_READ}><LazyPage><PermissionCatalogPage /></LazyPage></PermissionRoute> },
      { path: '/settings/access/audit', element: <PermissionRoute permission={PERMISSION_CODES.ACCESS_AUDIT_READ}><LazyPage><AccessAuditPage /></LazyPage></PermissionRoute> },
      { path: '/forbidden', element: <LazyPage><ForbiddenPage /></LazyPage> },
      { path: '*', element: <LazyPage><NotFoundPage /></LazyPage> },
    ] },
  ] },
])

export default function App() { return <RouterProvider router={router} /> }
