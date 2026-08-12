import { Construction, LockKeyhole, SearchX } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { StatePanel } from '../components/States'

export function PlaceholderPage() {
  const { t } = useTranslation()
  return <div className="page-container standalone-content-state"><StatePanel icon={<Construction />} title={t('navigation:placeholderTitle')} body={t('navigation:placeholderBody')} /></div>
}

export function ForbiddenPage() {
  const { t } = useTranslation()
  return <div className="page-container standalone-content-state"><StatePanel icon={<LockKeyhole />} title={t('permissions:title')} body={t('permissions:body')} action={<Link className="button button--secondary" to="/">{t('back')}</Link>} /></div>
}

export function NotFoundPage() {
  const { t } = useTranslation()
  return <div className="page-container standalone-content-state"><StatePanel icon={<SearchX />} title={t('errors:genericTitle')} body={t('errors:genericBody')} action={<Link className="button button--secondary" to="/">{t('goHome')}</Link>} /></div>
}
