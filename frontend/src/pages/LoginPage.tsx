import { Eye, EyeOff, LockKeyhole, Shirt } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { ApiError } from '../api/client'
import { useAuth } from '../auth/AuthProvider'

export function LoginPage() {
  const { t } = useTranslation()
  const { user, login, sessionExpired, clearExpiredNotice } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (user) return <Navigate to="/customers" replace />

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setPending(true); setError(null); clearExpiredNotice()
    try {
      await login(username, password)
      const intended = (location.state as { from?: string } | null)?.from
      navigate(intended?.startsWith('/') ? intended : '/customers', { replace: true })
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) setError(t('auth:invalid'))
      else if (caught instanceof ApiError && caught.status === 429) setError(t('errors:rateLimited'))
      else setError(t('auth:serverError'))
    } finally { setPending(false) }
  }

  return <main className="login-page"><section className="login-brand-panel"><div className="login-brand"><span className="brand__mark brand__mark--large"><Shirt size={30} /></span><h1>{t('appName')}</h1><p>{t('auth:subtitle')}</p></div></section><section className="login-form-panel"><form className="login-card" onSubmit={(event) => void submit(event)}><div className="login-card__heading"><span className="login-lock"><LockKeyhole size={22} /></span><h2>{t('auth:title')}</h2><p>{t('auth:subtitle')}</p></div>{sessionExpired && <div className="inline-alert inline-alert--warning" role="status">{t('auth:sessionExpired')}</div>}{error && <div className="inline-alert inline-alert--danger" role="alert">{error}</div>}<label className="form-field"><span className="form-field__label">{t('auth:username')}</span><input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" placeholder={t('auth:usernamePlaceholder')} required autoFocus /></label><label className="form-field"><span className="form-field__label">{t('auth:password')}</span><span className="password-input"><input value={password} onChange={(event) => setPassword(event.target.value)} type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder={t('auth:passwordPlaceholder')} required /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? t('hidePassword') : t('showPassword')}>{showPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button></span></label><button type="submit" className="button button--primary button--wide" disabled={pending}>{pending ? t('loading') : t('auth:submit')}</button><p className="secure-note"><LockKeyhole size={14} />{t('auth:secureNote')}</p></form></section></main>
}
