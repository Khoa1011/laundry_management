import {
  ArrowRight,
  Bell,
  BookOpenCheck,
  Construction,
  Palette,
  ShieldCheck,
  Sparkles,
  Tags,
  Users,
  UsersRound,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { PERMISSION_CODES, type PermissionCode } from '../auth/permissionCodes.generated'
import { StatePanel } from '../components/States'

const landingCopy = {
  vi: {
    overviewEyebrow: 'Tổng quan',
    overviewTitle: 'Không gian vận hành của bạn',
    overviewSubtitle: 'Truy cập nhanh các khu vực đã sẵn sàng theo đúng quyền hiện tại.',
    heroTitle: 'Vận hành rõ ràng, chăm sóc khách hàng tốt hơn.',
    heroBody: 'Các mô-đun đã kết nối dữ liệu được tập trung tại đây. Số liệu đơn hàng và doanh thu sẽ chỉ xuất hiện khi backend nghiệp vụ tương ứng hoàn tất.',
    ready: 'Đã sẵn sàng',
    open: 'Mở mô-đun',
    moreEyebrow: 'Tùy chọn khác',
    moreTitle: 'Mô-đun và cài đặt',
    moreSubtitle: 'Chỉ hiển thị những khu vực tài khoản của bạn được phép truy cập.',
    operations: 'Vận hành',
    administration: 'Quản trị hệ thống',
    personal: 'Cá nhân',
    customers: 'Khách hàng', customersBody: 'Hồ sơ, liên hệ và trạng thái khách hàng.',
    employees: 'Nhân viên', employeesBody: 'Nhân sự, vị trí và phạm vi chi nhánh.',
    selfEmployee: 'Hồ sơ của tôi', selfEmployeeBody: 'Xem thông tin nhân viên của tài khoản hiện tại.',
    catalog: 'Dịch vụ và bảng giá', catalogBody: 'Danh mục dịch vụ, loại đồ và chính sách giá.',
    access: 'Phân quyền', accessBody: 'Vai trò, quyền hiệu lực và nhật ký truy cập.',
    notifications: 'Thông báo', notificationsBody: 'Theo dõi cập nhật dành cho tài khoản hiện tại.',
    appearance: 'Giao diện', appearanceBody: 'Điều chỉnh mức chuyển động phù hợp thiết bị.',
    ordersTitle: 'Đơn hàng đang được hoàn thiện',
    ordersBody: 'Luồng tạo, xử lý và thanh toán đơn hàng chưa có hợp đồng backend hoàn chỉnh. Màn hình này chưa hiển thị dữ liệu mẫu để tránh gây nhầm lẫn trong vận hành.',
  },
  en: {
    overviewEyebrow: 'Overview',
    overviewTitle: 'Your operations workspace',
    overviewSubtitle: 'Open production-ready areas that match your current access.',
    heroTitle: 'Clear operations, better customer care.',
    heroBody: 'Connected modules are gathered here. Order and revenue metrics will appear only after their backend workflows are complete.',
    ready: 'Ready',
    open: 'Open module',
    moreEyebrow: 'More',
    moreTitle: 'Modules and settings',
    moreSubtitle: 'Only areas available to your account are shown.',
    operations: 'Operations',
    administration: 'Administration',
    personal: 'Personal',
    customers: 'Customers', customersBody: 'Customer profiles, contact details, and status.',
    employees: 'Employees', employeesBody: 'People, positions, and branch scope.',
    selfEmployee: 'My profile', selfEmployeeBody: 'View the employee profile linked to this account.',
    catalog: 'Services and pricing', catalogBody: 'Services, item types, and price policies.',
    access: 'Access control', accessBody: 'Roles, effective permissions, and access audit.',
    notifications: 'Notifications', notificationsBody: 'Review updates for the current account.',
    appearance: 'Appearance', appearanceBody: 'Choose a motion level suited to this device.',
    ordersTitle: 'Orders are being completed',
    ordersBody: 'Order creation, processing, and payment do not yet have complete backend contracts. Sample data is intentionally not shown to avoid operational confusion.',
  },
} as const

function useLandingCopy() {
  const { i18n } = useTranslation()
  return landingCopy[i18n.language.startsWith('en') ? 'en' : 'vi']
}

interface ModuleCard {
  to: string
  title: string
  body: string
  icon: typeof Users
  tone: 'primary' | 'operational' | 'success' | 'warning' | 'violet'
  permission?: PermissionCode
}

function ModuleGrid({ cards, openLabel }: { cards: ModuleCard[]; openLabel: string }) {
  return (
    <div className="module-launch-grid">
      {cards.map(({ to, title, body, icon: Icon, tone }) => (
        <Link className={`module-launch-card module-launch-card--${tone}`} to={to} key={to}>
          <span className="module-launch-card__icon"><Icon size={24} aria-hidden="true" /></span>
          <span className="module-launch-card__copy"><strong>{title}</strong><small>{body}</small></span>
          <span className="module-launch-card__action">{openLabel}<ArrowRight size={17} aria-hidden="true" /></span>
        </Link>
      ))}
    </div>
  )
}

function useAvailableModules() {
  const c = useLandingCopy()
  const { hasPermission } = useAuth()
  const candidates: ModuleCard[] = [
    { to: '/customers', title: c.customers, body: c.customersBody, icon: Users, tone: 'primary', permission: PERMISSION_CODES.CUSTOMER_READ },
    { to: '/employees', title: c.employees, body: c.employeesBody, icon: UsersRound, tone: 'operational', permission: PERMISSION_CODES.EMPLOYEE_READ },
    { to: '/employees/me', title: c.selfEmployee, body: c.selfEmployeeBody, icon: BookOpenCheck, tone: 'operational', permission: PERMISSION_CODES.EMPLOYEE_READ_SELF },
    { to: '/catalog/services', title: c.catalog, body: c.catalogBody, icon: Tags, tone: 'warning', permission: PERMISSION_CODES.SERVICE_READ },
    { to: '/settings/access', title: c.access, body: c.accessBody, icon: ShieldCheck, tone: 'violet' },
  ]
  const canOpenAccess = [
    PERMISSION_CODES.ACCESS_ROLE_READ,
    PERMISSION_CODES.ACCESS_USER_READ,
    PERMISSION_CODES.ACCESS_PERMISSION_READ,
    PERMISSION_CODES.ACCESS_AUDIT_READ,
  ].some(hasPermission)
  return candidates.filter((item) => {
    if (item.to === '/settings/access') return canOpenAccess
    if (item.to === '/employees/me' && hasPermission(PERMISSION_CODES.EMPLOYEE_READ)) return false
    return !item.permission || hasPermission(item.permission)
  })
}

export function OverviewPage() {
  const c = useLandingCopy()
  const modules = useAvailableModules()
  return (
    <div className="page-container landing-page">
      <header className="page-header"><div><p className="eyebrow">{c.overviewEyebrow}</p><h1>{c.overviewTitle}</h1><p>{c.overviewSubtitle}</p></div></header>
      <section className="overview-welcome" aria-labelledby="overview-welcome-title">
        <div>
          <span className="overview-welcome__badge"><Sparkles size={17} aria-hidden="true" />{c.ready}</span>
          <h2 id="overview-welcome-title">{c.heroTitle}</h2>
          <p>{c.heroBody}</p>
        </div>
        <div className="overview-welcome__scene" aria-hidden="true">
          <span><UsersRound /></span><span><Tags /></span><span><ShieldCheck /></span>
        </div>
      </section>
      <section className="landing-section" aria-labelledby="overview-modules-title">
        <div className="section-header"><div><h2 id="overview-modules-title">{c.operations}</h2><p>{c.overviewSubtitle}</p></div></div>
        <ModuleGrid cards={modules.slice(0, 4)} openLabel={c.open} />
      </section>
    </div>
  )
}

export function MorePage() {
  const c = useLandingCopy()
  const { hasPermission } = useAuth()
  const operations = useAvailableModules()
  const personal: ModuleCard[] = [
    ...(hasPermission(PERMISSION_CODES.NOTIFICATION_READ_OWN)
      ? [{ to: '/notifications', title: c.notifications, body: c.notificationsBody, icon: Bell, tone: 'success' as const }]
      : []),
    { to: '/settings/preferences', title: c.appearance, body: c.appearanceBody, icon: Palette, tone: 'violet' },
  ]
  return (
    <div className="page-container landing-page">
      <header className="page-header"><div><p className="eyebrow">{c.moreEyebrow}</p><h1>{c.moreTitle}</h1><p>{c.moreSubtitle}</p></div></header>
      {operations.length > 0 && <section className="landing-section"><div className="section-header"><div><h2>{c.operations}</h2></div></div><ModuleGrid cards={operations} openLabel={c.open} /></section>}
      <section className="landing-section"><div className="section-header"><div><h2>{c.personal}</h2></div></div><ModuleGrid cards={personal} openLabel={c.open} /></section>
    </div>
  )
}

export function OrdersUnavailablePage() {
  const c = useLandingCopy()
  return <div className="page-container standalone-content-state orders-unavailable"><StatePanel icon={<Construction />} title={c.ordersTitle} body={c.ordersBody} /></div>
}
