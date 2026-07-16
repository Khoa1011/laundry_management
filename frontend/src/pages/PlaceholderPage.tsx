import { Construction } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { StatePanel } from '../components/States'

export function PlaceholderPage() {
  const { t } = useTranslation()
  return <div className="page-container"><StatePanel icon={<Construction />} title={t('navigation:placeholderTitle')} body={t('navigation:placeholderBody')} /></div>
}
