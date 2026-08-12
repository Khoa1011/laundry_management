import { BellRing, FileAudio, Play, Trash2, Upload, Volume2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../../auth/AuthProvider'
import { Button } from '../../../components/ui/Button'
import { IconButton } from '../../../components/ui/IconButton'
import { useToast } from '../../../providers/ToastProvider'
import { useNotificationPreferences, useUpdateNotificationPreferences } from '../hooks/useNotifications'
import type { NotificationPreferences, NotificationSoundKey } from '../model/types'
import {
  CUSTOM_NOTIFICATION_SOUND_ACCEPT,
  CustomNotificationSoundError,
  deleteCustomNotificationSound,
  loadCustomNotificationSound,
  saveCustomNotificationSound,
  setCustomNotificationSoundActive,
  type CustomNotificationSoundRecord,
} from '../sound/customNotificationSound'
import { notificationSoundCatalog, notificationSoundEngine } from '../sound/notificationSound'

const DEFAULTS: NotificationPreferences = {
  soundEnabled: true,
  soundKey: 'SOFT_CHIME',
  soundVolume: 65,
  toastEnabled: true,
  bellAnimationEnabled: true,
  version: 0,
}

export function NotificationPreferencesPanel() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { notify } = useToast()
  const query = useNotificationPreferences()
  const update = useUpdateNotificationPreferences()
  const [draft, setDraft] = useState<NotificationPreferences>(DEFAULTS)
  const [customSound, setCustomSound] = useState<CustomNotificationSoundRecord | null>(null)
  const [customSelected, setCustomSelected] = useState(false)
  const [customPending, setCustomPending] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const customSoundScope = `user:${user?.id ?? 'device'}`

  useEffect(() => {
    if (query.data) setDraft(query.data)
  }, [query.data])

  useEffect(() => {
    let active = true
    void loadCustomNotificationSound(customSoundScope).then((record) => {
      if (!active) return
      setCustomSound(record ?? null)
      setCustomSelected(record?.active ?? false)
      if (record) notificationSoundEngine.prepareCustomSound(customSoundScope, record)
    }).catch(() => {
      if (active) setCustomSound(null)
    })
    return () => {
      active = false
    }
  }, [customSoundScope])

  const patch = (value: Partial<NotificationPreferences>) => setDraft((current) => ({ ...current, ...value }))
  const preview = async (soundKey: NotificationSoundKey) => {
    const result = await notificationSoundEngine.previewPreset(soundKey, draft.soundVolume)
    if (result === 'blocked') notify(t('notification:settings.audioBlocked'), 'info')
  }
  const previewCustom = async () => {
    if (!customSound) return
    const result = await notificationSoundEngine.previewCustom(
      customSoundScope,
      draft.soundVolume,
      customSound,
    )
    if (result === 'blocked') notify(t('notification:settings.audioBlocked'), 'info')
    if (result === 'disabled') notify(t('notification:settings.customSoundInvalid'), 'error')
  }
  const importCustomSound = async (file: File) => {
    setCustomPending(true)
    try {
      const record = await saveCustomNotificationSound(customSoundScope, file)
      notificationSoundEngine.prepareCustomSound(customSoundScope, record)
      setCustomSound(record)
      setCustomSelected(true)
      notify(t('notification:settings.customSoundImported'), 'success')
    } catch (error) {
      const key = error instanceof CustomNotificationSoundError
        ? error.code === 'FILE_TOO_LARGE'
          ? 'notification:settings.customSoundTooLarge'
          : error.code === 'INVALID_FILE_TYPE'
            ? 'notification:settings.customSoundInvalidType'
            : 'notification:settings.customSoundStorageError'
        : 'notification:settings.customSoundStorageError'
      notify(t(key), 'error')
    } finally {
      setCustomPending(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }
  const removeCustomSound = async () => {
    setCustomPending(true)
    try {
      await deleteCustomNotificationSound(customSoundScope)
      notificationSoundEngine.clearCustomSound(customSoundScope)
      setCustomSound(null)
      setCustomSelected(false)
      notify(t('notification:settings.customSoundRemoved'), 'success')
    } catch {
      notify(t('notification:settings.customSoundStorageError'), 'error')
    } finally {
      setCustomPending(false)
    }
  }
  const save = async () => {
    const previousCustomActive = customSound?.active ?? false
    try {
      const updatedCustomSound = await setCustomNotificationSoundActive(
        customSoundScope,
        Boolean(customSound && customSelected),
      )
      await update.mutateAsync({
        soundEnabled: draft.soundEnabled,
        soundKey: draft.soundKey,
        soundVolume: draft.soundVolume,
        toastEnabled: draft.toastEnabled,
        bellAnimationEnabled: draft.bellAnimationEnabled,
      })
      if (updatedCustomSound) {
        notificationSoundEngine.prepareCustomSound(customSoundScope, updatedCustomSound)
        setCustomSound(updatedCustomSound)
      }
      notify(t('notification:settings.saved'), 'success')
    } catch {
      await setCustomNotificationSoundActive(customSoundScope, previousCustomActive).catch(() => undefined)
      notify(t('notification:settings.saveError'), 'error')
    }
  }

  if (query.isLoading) return <div className="notification-settings-skeleton" aria-label={t('common:loading')} />
  return (
    <section className="notification-settings" aria-labelledby="notification-sound-heading">
      <div className="notification-settings__heading">
        <span className="notification-settings__heading-icon"><Volume2 size={20} aria-hidden="true" /></span>
        <span><h2 id="notification-sound-heading">{t('notification:settings.soundTitle')}</h2>
          <p>{t('notification:settings.soundDescription')}</p></span>
      </div>
      <label className="setting-switch switch-row">
        <span className="setting-switch__copy"><strong>{t('notification:settings.soundEnabled')}</strong><small>{t('notification:settings.soundEnabledHint')}</small></span>
        <input type="checkbox" role="switch" checked={draft.soundEnabled}
          onChange={(event) => patch({ soundEnabled: event.target.checked })} />
        <span className="switch" aria-hidden="true" />
      </label>
      <fieldset className="sound-picker" disabled={!draft.soundEnabled}>
        <legend>{t('notification:settings.sound')}</legend>
        {notificationSoundCatalog.map((sound) => (
          <div key={sound.key} className={`sound-option${!customSelected && draft.soundKey === sound.key ? ' sound-option--selected' : ''}`}>
            <input id={`notification-sound-${sound.key}`} type="radio" name="notification-sound"
              value={sound.key} checked={!customSelected && draft.soundKey === sound.key}
              onChange={() => {
                setCustomSelected(false)
                patch({ soundKey: sound.key })
              }} />
            <label className="sound-option__label" htmlFor={`notification-sound-${sound.key}`}>
              <span className="sound-option__icon"><BellRing size={18} aria-hidden="true" /></span>
              <span className="sound-option__copy"><strong>{t(sound.labelKey)}</strong><small>{t(sound.descriptionKey)}</small></span>
            </label>
            {sound.key !== 'NONE' && <IconButton type="button" size="sm"
              onClick={() => { void preview(sound.key) }}
              label={`${t('notification:settings.preview')} ${t(sound.labelKey)}`}>
              <Play size={17} aria-hidden="true" />
            </IconButton>}
          </div>
        ))}
        <div className={`sound-option${customSelected ? ' sound-option--selected' : ''}`}>
          <input id="notification-sound-custom" type="radio" name="notification-sound"
            checked={customSelected} disabled={!customSound}
            onChange={() => setCustomSelected(true)} />
          <label className="sound-option__label" htmlFor="notification-sound-custom">
            <span className="sound-option__icon"><FileAudio size={18} aria-hidden="true" /></span>
            <span className="sound-option__copy">
              <strong>{t('notification:sound.custom')}</strong>
              <small>{customSound?.fileName ?? t('notification:sound.customDescription')}</small>
            </span>
          </label>
          {customSound && <IconButton type="button" size="sm"
            onClick={() => { void previewCustom() }}
            label={`${t('notification:settings.preview')} ${t('notification:sound.custom')}`}>
            <Play size={17} aria-hidden="true" />
          </IconButton>}
        </div>
        <div className="custom-sound-import">
          <input ref={fileInputRef} type="file" hidden accept={CUSTOM_NOTIFICATION_SOUND_ACCEPT}
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void importCustomSound(file)
            }} />
          <div className="custom-sound-import__copy">
            <span>{customSound
              ? t('notification:settings.customSoundFile', {
                name: customSound.fileName,
                size: formatFileSize(customSound.size),
              })
              : t('notification:settings.customSoundLocalHint')}</span>
          </div>
          <div className="custom-sound-import__actions">
            <Button type="button" variant="secondary"
              onClick={() => fileInputRef.current?.click()} disabled={customPending}>
              <Upload size={17} aria-hidden="true" />
              {customSound
                ? t('notification:settings.customSoundReplace')
                : t('notification:settings.customSoundChoose')}
            </Button>
            {customSound && <IconButton type="button" variant="danger"
              onClick={() => { void removeCustomSound() }} disabled={customPending}
              title={t('notification:settings.customSoundRemove')}
              label={t('notification:settings.customSoundRemove')}>
              <Trash2 size={18} aria-hidden="true" />
            </IconButton>}
          </div>
        </div>
      </fieldset>
      <label className="volume-control">
        <span>{t('notification:settings.volume', { value: draft.soundVolume })}</span>
        <input type="range" min="0" max="100" step="5" value={draft.soundVolume}
          onChange={(event) => patch({ soundVolume: Number(event.target.value) })}
          aria-valuetext={`${draft.soundVolume}%`} disabled={!draft.soundEnabled} />
      </label>
      <label className="setting-switch switch-row">
        <span className="setting-switch__copy"><strong>{t('notification:settings.toastEnabled')}</strong><small>{t('notification:settings.toastHint')}</small></span>
        <input type="checkbox" role="switch" checked={draft.toastEnabled}
          onChange={(event) => patch({ toastEnabled: event.target.checked })} />
        <span className="switch" aria-hidden="true" />
      </label>
      <label className="setting-switch switch-row">
        <span className="setting-switch__copy"><strong>{t('notification:settings.bellAnimationEnabled')}</strong><small>{t('notification:settings.bellHint')}</small></span>
        <input type="checkbox" role="switch" checked={draft.bellAnimationEnabled}
          onChange={(event) => patch({ bellAnimationEnabled: event.target.checked })} />
        <span className="switch" aria-hidden="true" />
      </label>
      <Button type="button" className="notification-settings__save"
        onClick={() => void save()} disabled={update.isPending || customPending}>
        {update.isPending ? t('common:saving') : t('common:save')}
      </Button>
    </section>
  )
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
