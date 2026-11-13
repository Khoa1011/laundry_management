import { useTranslation } from 'react-i18next'
import { useAuth } from '../../auth/AuthProvider'
import { PERMISSION_CODES as P } from '../../auth/permissionCodes.generated'
import { AppNavLink } from '../../components/navigation/AppNavLink'
import { Surface } from '../../components/ui/Surface'
import { createPermissions, kinds, stockPages } from './types'

export function StockNavigation() {
  const { hasPermission } = useAuth()
  const { t } = useTranslation('stock')
  return <Surface as="nav" variant="subtle" className="catalog-module-tabs operations-tabs" aria-label={t('title')}>
    {stockPages.filter((p) => hasPermission(p.permission) || (kinds[p.path] && hasPermission(createPermissions[kinds[p.path]]))).map(({ path }) => <AppNavLink key={path} to={`/inventory/${path}`} className="catalog-module-tab" activeClassName="catalog-module-tab--active" indicatorId="stock-nav">{t(path)}</AppNavLink>)}
    {hasPermission(P.INVENTORY_ITEM_READ) && <AppNavLink to="/inventory/items" className="catalog-module-tab" activeClassName="catalog-module-tab--active" indicatorId="stock-nav">{t('catalogs')}</AppNavLink>}
  </Surface>
}
