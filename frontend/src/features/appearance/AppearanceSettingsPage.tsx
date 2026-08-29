import { Check, Gauge, Palette, RotateCcw, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../../components/ui/Button'
import { Surface } from '../../components/ui/Surface'
import {
  DEFAULT_APPEARANCE,
  type AppearancePreferences,
  type MotionLevel,
} from '../../providers/appearancePreferences'
import { useTheme } from '../../providers/ThemeProvider'
import { useToast } from '../../providers/ToastProvider'

const motionOptions: MotionLevel[] = ['full', 'balanced', 'reduced', 'off']

export function AppearanceSettingsPage() {
  const { t } = useTranslation()
  const {
    appliedPreferences,
    applyPreferences,
    previewPreferences,
    cancelPreview,
    hasPreview,
  } = useTheme()
  const { notify } = useToast()
  const [draft, setDraft] = useState<AppearancePreferences>(appliedPreferences)
  const [savedMessage, setSavedMessage] = useState(false)
  const hasChanges = draft.motionLevel !== appliedPreferences.motionLevel

  useEffect(() => () => cancelPreview(), [cancelPreview])

  const updateMotion = (motionLevel: MotionLevel) => {
    const next = { motionLevel }
    setSavedMessage(false)
    setDraft(next)
    previewPreferences(next)
  }

  const cancel = () => {
    cancelPreview()
    setDraft(appliedPreferences)
    setSavedMessage(false)
  }

  const restore = () => {
    setDraft(DEFAULT_APPEARANCE)
    previewPreferences(DEFAULT_APPEARANCE)
    setSavedMessage(false)
  }

  const apply = () => {
    if (!hasChanges) return
    applyPreferences(draft)
    setSavedMessage(true)
    notify(t('appearance:applied'), 'success')
  }

  return (
    <div className="page-container page appearance-page">
      <header className="page-header appearance-header">
        <div>
          <span className="page-header__icon" aria-hidden="true"><Palette size={20} /></span>
          <h1>{t('appearance:title')}</h1>
          <p>{t('appearance:subtitle')}</p>
        </div>
      </header>

      {(hasPreview || savedMessage) && (
        <div className={`appearance-notice${savedMessage ? ' appearance-notice--success' : ''}`} role="status">
          {savedMessage ? <Check size={18} aria-hidden="true" /> : <Sparkles size={18} aria-hidden="true" />}
          <span>{t(savedMessage ? 'appearance:applied' : 'appearance:previewing')}</span>
        </div>
      )}

      <Surface as="section" className="appearance-section appearance-system" aria-labelledby="system-heading">
        <div className="section-heading">
          <div>
            <h2 id="system-heading">{t('appearance:systemTitle')}</h2>
            <p>{t('appearance:systemDescription')}</p>
          </div>
        </div>
        <div className="appearance-system__preview" aria-label={t('appearance:palettePreview')}>
          <span className="appearance-swatch appearance-swatch--primary" />
          <span className="appearance-swatch appearance-swatch--operational" />
          <span className="appearance-swatch appearance-swatch--warning" />
          <span className="appearance-swatch appearance-swatch--attention" />
          <span className="appearance-swatch appearance-swatch--canvas" />
          <span className="appearance-swatch appearance-swatch--surface" />
        </div>
      </Surface>

      <Surface as="section" variant="subtle" className="preference-group appearance-motion">
        <h2><span aria-hidden="true"><Gauge size={19} /></span>{t('appearance:motionTitle')}</h2>
        <p>{t('appearance:motionDescription')}</p>
        <div className="segmented-control" role="radiogroup" aria-label={t('appearance:motionTitle')}>
          {motionOptions.map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={draft.motionLevel === option}
              className={draft.motionLevel === option ? 'is-selected' : ''}
              onClick={() => updateMotion(option)}
            >
              {t(`appearance:${option}`)}
            </button>
          ))}
        </div>
      </Surface>

      <div className="appearance-actions sticky-action-bar">
        <Button type="button" variant="ghost" onClick={restore}>
          <RotateCcw size={18} aria-hidden="true" />{t('appearance:restoreDefault')}
        </Button>
        <Button type="button" variant="secondary" onClick={cancel} disabled={!hasPreview}>
          {t('appearance:cancelPreview')}
        </Button>
        <Button type="button" onClick={apply} disabled={!hasChanges}>
          <Check size={18} aria-hidden="true" />{t('appearance:applyChanges')}
        </Button>
      </div>
    </div>
  )
}
