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
const PlaceholderPage = lazy(() => import('./pages/PlaceholderPage').then((module) => ({ default: module.PlaceholderPage })))

function LazyPage({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  return <Suspense fallback={<div className="route-loading" role="status">{t('loading')}</div>}>{children}</Suspense>
}

function ProtectedRoute() {
  const { user } = useAuth()
  const location = useLocation()
  return user ? <Outlet /> : <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />
}

function PermissionRoute({ permission, children }: { permission: PermissionCode; children: ReactNode }) {
  const { hasPermission } = useAuth()
  return hasPermission(permission) ? children : <Navigate to="/forbidden" replace />
}

function RouteError() {
  const { t } = useTranslation()
  return <main className="standalone-state"><StatePanel title={t('errors:genericTitle')} body={t('errors:genericBody')} action={<a className="button button--secondary" href="/customers">{t('goHome')}</a>} /></main>
}

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage />, errorElement: <RouteError /> },
  { element: <ProtectedRoute />, errorElement: <RouteError />, children: [
    { element: <AppShell />, children: [
      { index: true, element: <Navigate to="/customers" replace /> },
      { path: '/customers', element: <PermissionRoute permission={PERMISSION_CODES.CUSTOMER_READ}><LazyPage><CustomerListPage /></LazyPage></PermissionRoute> },
      { path: '/customers/new', element: <PermissionRoute permission={PERMISSION_CODES.CUSTOMER_CREATE}><LazyPage><CustomerFormPage /></LazyPage></PermissionRoute> },
      { path: '/customers/:customerId', element: <PermissionRoute permission={PERMISSION_CODES.CUSTOMER_READ}><LazyPage><CustomerDetailPage /></LazyPage></PermissionRoute> },
      { path: '/customers/:customerId/edit', element: <PermissionRoute permission={PERMISSION_CODES.CUSTOMER_UPDATE}><LazyPage><CustomerFormPage /></LazyPage></PermissionRoute> },
      { path: '/overview', element: <LazyPage><PlaceholderPage /></LazyPage> },
      { path: '/orders', element: <LazyPage><PlaceholderPage /></LazyPage> },
      { path: '/more', element: <LazyPage><PlaceholderPage /></LazyPage> },
      { path: '/settings/preferences', element: <LazyPage><PlaceholderPage /></LazyPage> },
      { path: '/forbidden', element: <LazyPage><PlaceholderPage /></LazyPage> },
      { path: '*', element: <LazyPage><PlaceholderPage /></LazyPage> },
    ] },
  ] },
])

export default function App() { return <RouterProvider router={router} /> }
