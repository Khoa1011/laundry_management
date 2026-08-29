import { Shirt, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export function LoginBrandScene() {
  const { t } = useTranslation()

  return (
    <aside className="login-context" aria-label={t('appName')}>
      <div className="login-context__top login-spatial-layer login-spatial-layer--near">
        <div className="login-brand">
          <span className="login-brand__mark" aria-hidden="true">
            <Shirt size={30} />
          </span>
          <span className="login-brand__copy">
            <strong>{t('appName')}</strong>
            <small>{t('appMode')}</small>
          </span>
        </div>
        <span className="login-brand__signal" aria-hidden="true"><Sparkles size={18} /></span>
      </div>

      <div className="login-context__hero login-spatial-layer login-spatial-layer--mid">
        <h2>{t('auth:heroTitle')} <span>{t('auth:heroAccent')}</span></h2>
        <p>{t('auth:heroDescription')}</p>
      </div>

      <div className="login-laundry-scene" aria-hidden="true">
        <span className="login-bubble login-bubble--one" />
        <span className="login-bubble login-bubble--two" />
        <span className="login-bubble login-bubble--three" />

        <div className="login-plant login-spatial-layer login-spatial-layer--mid">
          <span className="login-plant__leaf login-plant__leaf--one" />
          <span className="login-plant__leaf login-plant__leaf--two" />
          <span className="login-plant__leaf login-plant__leaf--three" />
          <span className="login-plant__pot" />
        </div>

        <div className="login-machine login-spatial-layer login-spatial-layer--far">
          <div className="login-machine__controls">
            <span className="login-machine__slot" />
            <span className="login-machine__knob" />
            <span className="login-machine__display" />
          </div>
          <span className="login-machine__door" />
        </div>

        <span className="login-shirt login-spatial-layer login-spatial-layer--front" />
        <span className="login-basket login-spatial-layer login-spatial-layer--near" />
        <span className="login-towels login-spatial-layer login-spatial-layer--front">
          <i /><i /><i /><i />
        </span>
      </div>
    </aside>
  )
}
