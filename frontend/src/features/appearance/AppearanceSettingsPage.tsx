import { Check, Palette, RotateCcw, SlidersHorizontal, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { GlassSurface } from '../../components/GlassSurface'
import {
  DEFAULT_APPEARANCE,
  normalizeHex,
  type AppearancePreferences,
  type BrandIntensity,
  type GlassStrength,
  type MotionLevel,
  type PaletteName,
} from '../../providers/appearancePreferences'
import { useTheme } from '../../providers/ThemeProvider'
import { useToast } from '../../providers/ToastProvider'

const paletteOptions: Array<{ value: PaletteName; label: string }> = [
  { value: 'laundry-green', label: 'laundryGreen' },
  { value: 'ocean-blue', label: 'oceanBlue' },
  { value: 'aqua-teal', label: 'aquaTeal' },
  { value: 'royal-violet', label: 'royalViolet' },
  { value: 'warm-amber', label: 'warmAmber' },
  { value: 'rose-red', label: 'roseRed' },
]

const validHex = (value: string) => /^#[0-9A-F]{6}$/i.test(value.trim())

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
  const colorsValid = validHex(draft.customPrimary) && validHex(draft.customAccent)
  const hasChanges = JSON.stringify(draft) !== JSON.stringify(appliedPreferences)

  useEffect(() => () => cancelPreview(), [cancelPreview])

  const update = (patch: Partial<AppearancePreferences>) => {
    setSavedMessage(false)
    const next = { ...draft, ...patch }
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
    if (!colorsValid || !hasChanges) return
    const normalized = {
      ...draft,
      customPrimary: normalizeHex(draft.customPrimary),
      customAccent: normalizeHex(draft.customAccent, DEFAULT_APPEARANCE.customAccent),
    }
    applyPreferences(normalized)
    setDraft(normalized)
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
          <Sparkles size={18} aria-hidden="true" />
          <span>{t(savedMessage ? 'appearance:applied' : 'appearance:previewing')}</span>
        </div>
      )}

      <section className="appearance-section" aria-labelledby="palette-heading">
        <div className="section-heading">
          <div>
            <h2 id="palette-heading">{t('appearance:paletteTitle')}</h2>
            <p>{t('appearance:paletteDescription')}</p>
          </div>
        </div>
        <div className="palette-grid" role="radiogroup" aria-label={t('appearance:paletteTitle')}>
          {paletteOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={draft.palette === option.value}
              className={`palette-card${draft.palette === option.value ? ' palette-card--selected' : ''}`}
              data-palette-preview={option.value}
              onClick={() => update({ palette: option.value })}
            >
              <span className="palette-card__preview" aria-hidden="true">
                <span className="palette-card__sidebar" />
                <span className="palette-card__content">
                  <span className="palette-card__nav" />
                  <span className="palette-card__glass" />
                  <span className="palette-card__button" />
                  <span className="palette-card__chart" />
                </span>
              </span>
              <span className="palette-card__label">{t(`appearance:${option.label}`)}</span>
              {draft.palette === option.value && <Check size={18} aria-hidden="true" />}
            </button>
          ))}
        </div>
      </section>

      <GlassSurface as="section" variant="opaque" className="appearance-section appearance-custom" aria-labelledby="custom-heading">
        <div className="section-heading">
          <div>
            <h2 id="custom-heading">{t('appearance:customTitle')}</h2>
            <p>{t('appearance:customDescription')}</p>
          </div>
        </div>
        <div className="custom-color-grid">
          <ColorField
            label={t('appearance:primaryColor')}
            value={draft.customPrimary}
            invalid={!validHex(draft.customPrimary)}
            onChange={(value) => update({ customPrimary: value, palette: 'custom' })}
          />
          <ColorField
            label={t('appearance:accentColor')}
            value={draft.customAccent}
            invalid={!validHex(draft.customAccent)}
            onChange={(value) => update({ customAccent: value, palette: 'custom' })}
          />
        </div>
        {!colorsValid
          ? <p className="field-error" role="alert">{t('appearance:invalidHex')}</p>
          : <p className="field-hint"><Check size={15} aria-hidden="true" />{t('appearance:contrastReady')}</p>}
      </GlassSurface>

      <div className="appearance-controls-grid">
        <PreferenceGroup
          icon={<SlidersHorizontal size={19} />}
          title={t('appearance:intensityTitle')}
          value={draft.brandIntensity}
          options={['subtle', 'balanced', 'prominent']}
          onChange={(value) => update({ brandIntensity: value as BrandIntensity })}
        />
        <PreferenceGroup
          icon={<Sparkles size={19} />}
          title={t('appearance:glassTitle')}
          value={draft.glassStrength}
          options={['subtle', 'medium', 'strong']}
          onChange={(value) => update({ glassStrength: value as GlassStrength })}
        />
        <PreferenceGroup
          icon={<SlidersHorizontal size={19} />}
          title={t('appearance:motionTitle')}
          value={draft.motionLevel}
          options={['full', 'balanced', 'reduced', 'off']}
          onChange={(value) => update({ motionLevel: value as MotionLevel })}
        />
      </div>

      <section className="appearance-section appearance-effects" aria-labelledby="effects-heading">
        <div className="section-heading">
          <div>
            <h2 id="effects-heading">{t('appearance:effectsTitle')}</h2>
          </div>
        </div>
        <ToggleRow
          checked={draft.reduceTransparency}
          onChange={(checked) => update({ reduceTransparency: checked })}
          label={t('appearance:reduceTransparency')}
          hint={t('appearance:reduceTransparencyHint')}
        />
        <ToggleRow
          checked={draft.advancedEffects}
          onChange={(checked) => update({ advancedEffects: checked })}
          label={t('appearance:advancedEffects')}
          hint={t('appearance:advancedEffectsHint')}
        />
        <ToggleRow
          checked={draft.autoReduceEffects}
          onChange={(checked) => update({ autoReduceEffects: checked })}
          label={t('appearance:autoReduceEffects')}
          hint={t('appearance:autoReduceEffectsHint')}
        />
      </section>

      <div className="appearance-actions sticky-action-bar">
        <button type="button" className="button button--ghost" onClick={restore}>
          <RotateCcw size={18} aria-hidden="true" />{t('appearance:restoreDefault')}
        </button>
        <button type="button" className="button button--secondary" onClick={cancel} disabled={!hasPreview}>
          {t('appearance:cancelPreview')}
        </button>
        <button type="button" className="button button--primary" onClick={apply} disabled={!colorsValid || !hasChanges}>
          <Check size={18} aria-hidden="true" />{t('appearance:applyChanges')}
        </button>
      </div>
    </div>
  )
}

function ColorField({
  label,
  value,
  invalid,
  onChange,
}: {
  label: string
  value: string
  invalid: boolean
  onChange: (value: string) => void
}) {
  return (
    <label className="color-field">
      <span className="form-field__label">{label}</span>
      <span className={`color-field__control${invalid ? ' color-field__control--invalid' : ''}`}>
        <input
          className="color-field__picker"
          type="color"
          value={validHex(value) ? value : DEFAULT_APPEARANCE.customPrimary}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
          aria-label={label}
        />
        <input
          value={value}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
          spellCheck={false}
          inputMode="text"
          aria-invalid={invalid}
        />
      </span>
    </label>
  )
}

function PreferenceGroup({
  icon,
  title,
  value,
  options,
  onChange,
}: {
  icon: React.ReactNode
  title: string
  value: string
  options: string[]
  onChange: (value: string) => void
}) {
  const { t } = useTranslation()
  return (
    <GlassSurface as="section" variant="subtle" className="preference-group">
      <h2><span aria-hidden="true">{icon}</span>{title}</h2>
      <div className="segmented-control" role="radiogroup" aria-label={title}>
        {options.map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={value === option}
            className={value === option ? 'is-selected' : ''}
            onClick={() => onChange(option)}
          >
            {t(`appearance:${option}`)}
          </button>
        ))}
      </div>
    </GlassSurface>
  )
}

function ToggleRow({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  hint: string
}) {
  return (
    <label className="toggle-row">
      <span><strong>{label}</strong><small>{hint}</small></span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span className="toggle-control" aria-hidden="true"><span /></span>
    </label>
  )
}
