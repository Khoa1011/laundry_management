import { Eye, EyeOff, LoaderCircle, LockKeyhole, ShieldCheck, Shirt } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { ApiError } from '../api/client'
import { useAuth } from '../auth/AuthProvider'
import { useToast } from '../providers/ToastProvider'

export function LoginPage() {
  const { t } = useTranslation()
  const { user, login, sessionExpired, isRestoring, clearExpiredNotice } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const { notify } = useToast()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [pending, setPending] = useState(false)
  const [formError, setFormError] = useState('')
  if (isRestoring) return <main className="standalone-state"><div className="route-loading" role="status">{t('loading')}</div></main>
  if (user) return <Navigate to="/customers" replace />

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setPending(true)
    setFormError('')
    clearExpiredNotice()
    try {
      await login(username, password)
      const intended = (location.state as { from?: string } | null)?.from
      navigate(intended?.startsWith('/') ? intended : '/customers', { replace: true })
    } catch (caught) {
      const message = caught instanceof ApiError && caught.status === 401
        ? t('auth:invalid')
        : caught instanceof ApiError && caught.status === 429
          ? t('errors:rateLimited')
          : t('auth:serverError')
      setFormError(message)
      notify(message, 'error')
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="login-page">
      <section className="login-shell" aria-labelledby="login-title">
        <div className="login-context">
          <div className="login-brand">
            <span className="brand__mark brand__mark--large"><Shirt size={28} aria-hidden="true" /></span>
            <span><strong>{t('appName')}</strong><small>{t('appMode')}</small></span>
          </div>
          <div className="login-context__message">
            <ShieldCheck size={20} aria-hidden="true" />
            <p>{t('auth:secureNote')}</p>
          </div>
        </div>
        <form className="login-card" onSubmit={(event) => void submit(event)}>
          <div className="login-card__heading">
            <span className="login-lock"><LockKeyhole size={22} /></span>
            <h1 id="login-title">{t('auth:title')}</h1>
            <p>{t('auth:subtitle')}</p>
          </div>
          {sessionExpired && <div className="inline-alert inline-alert--warning" role="status">{t('auth:sessionExpired')}</div>}
          {formError && <div className="inline-alert inline-alert--danger" role="alert">{formError}</div>}
          <label className="form-field">
            <span className="form-field__label">{t('auth:username')}</span>
            <input value={username} onChange={(event) => { setUsername(event.target.value); setFormError('') }} autoComplete="username" placeholder={t('auth:usernamePlaceholder')} required autoFocus aria-invalid={Boolean(formError)} />
          </label>
          <label className="form-field">
            <span className="form-field__label">{t('auth:password')}</span>
            <span className="password-input">
              <input value={password} onChange={(event) => { setPassword(event.target.value); setFormError('') }} type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder={t('auth:passwordPlaceholder')} required aria-invalid={Boolean(formError)} />
              <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? t('hidePassword') : t('showPassword')}>
                {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
              </button>
            </span>
          </label>
          <button type="submit" className="button button--primary button--wide" disabled={pending || !username.trim() || !password}>
            {pending && <LoaderCircle className="spin" size={18} aria-hidden="true" />}
            {pending ? t('loading') : t('auth:submit')}
          </button>
        </form>
      </section>
    </main>
  )
}
