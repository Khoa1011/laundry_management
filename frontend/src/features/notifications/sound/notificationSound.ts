import type { NotificationSoundKey } from '../model/types'
import {
  loadCustomNotificationSound,
  type CustomNotificationSoundRecord,
} from './customNotificationSound'

export const notificationSoundCatalog: Array<{
  key: NotificationSoundKey
  labelKey: string
  descriptionKey: string
}> = [
  { key: 'NONE', labelKey: 'notification:sound.none', descriptionKey: 'notification:sound.noneDescription' },
  { key: 'SOFT_CHIME', labelKey: 'notification:sound.softChime', descriptionKey: 'notification:sound.softChimeDescription' },
  { key: 'CLEAR_BELL', labelKey: 'notification:sound.clearBell', descriptionKey: 'notification:sound.clearBellDescription' },
  { key: 'DIGITAL_PING', labelKey: 'notification:sound.digitalPing', descriptionKey: 'notification:sound.digitalPingDescription' },
  { key: 'DOUBLE_TONE', labelKey: 'notification:sound.doubleTone', descriptionKey: 'notification:sound.doubleToneDescription' },
  { key: 'URGENT_ALERT', labelKey: 'notification:sound.urgentAlert', descriptionKey: 'notification:sound.urgentAlertDescription' },
]

type PlayResult = 'played' | 'blocked' | 'disabled'
type AudibleSoundKey = Exclude<NotificationSoundKey, 'NONE'>
type AssetPlayResult = 'played' | 'blocked' | 'unavailable'

export const notificationSoundAssetUrls: Record<AudibleSoundKey, string> = {
  SOFT_CHIME: '/sounds/notifications/soft-chime.wav',
  CLEAR_BELL: '/sounds/notifications/clear-bell.wav',
  DIGITAL_PING: '/sounds/notifications/digital-ping.wav',
  DOUBLE_TONE: '/sounds/notifications/double-tone.wav',
  URGENT_ALERT: '/sounds/notifications/urgent-alert.wav',
}

class NotificationSoundEngine {
  private context: AudioContext | null = null
  private audioAssets = new Map<AudibleSoundKey, HTMLAudioElement>()
  private unavailableAssets = new Set<AudibleSoundKey>()
  private customAudioAssets = new Map<string, {
    audio: HTMLAudioElement
    objectUrl: string
    fingerprint: string
    active: boolean
  }>()

  async play(key: NotificationSoundKey, volume: number, scope = 'device'): Promise<PlayResult> {
    if (volume <= 0) return 'disabled'
    const normalizedVolume = Math.min(1, Math.max(0, volume / 100))
    const cachedCustom = this.customAudioAssets.get(scope)
    if (cachedCustom?.active) {
      const cachedResult = await this.playCachedCustom(cachedCustom.audio, normalizedVolume)
      if (cachedResult !== 'unavailable') return cachedResult
      this.clearCustomSound(scope)
    }
    const customResult = await this.playStoredCustom(scope, normalizedVolume, true)
    if (customResult !== 'unavailable') return customResult
    if (key === 'NONE') return 'disabled'
    return this.playPreset(key, normalizedVolume)
  }

  async previewPreset(key: NotificationSoundKey, volume: number): Promise<PlayResult> {
    if (key === 'NONE' || volume <= 0) return 'disabled'
    return this.playPreset(key, Math.min(1, Math.max(0, volume / 100)))
  }

  async previewCustom(
    scope: string,
    volume: number,
    record?: CustomNotificationSoundRecord,
  ): Promise<PlayResult> {
    if (volume <= 0) return 'disabled'
    if (record) {
      const cached = this.prepareCustomSound(scope, record)
      if (!cached) return 'disabled'
      const result = await this.playCachedCustom(
        cached.audio,
        Math.min(1, Math.max(0, volume / 100)),
      )
      return result === 'unavailable' ? 'disabled' : result
    }
    const cached = this.customAudioAssets.get(scope)
    if (cached) {
      const result = await this.playCachedCustom(
        cached.audio,
        Math.min(1, Math.max(0, volume / 100)),
      )
      return result === 'unavailable' ? 'disabled' : result
    }
    const result = await this.playStoredCustom(scope, Math.min(1, Math.max(0, volume / 100)), false)
    return result === 'unavailable' ? 'disabled' : result
  }

  prepareCustomSound(scope: string, record: CustomNotificationSoundRecord) {
    if (typeof Audio === 'undefined' || typeof URL === 'undefined'
      || typeof URL.createObjectURL !== 'function') return null
    const fingerprint = `${record.updatedAt}:${record.size}:${record.fileName}`
    let cached = this.customAudioAssets.get(scope)
    if (!cached || cached.fingerprint !== fingerprint) {
      this.clearCustomSound(scope)
      const objectUrl = URL.createObjectURL(record.blob)
      const audio = new Audio(objectUrl)
      audio.preload = 'auto'
      cached = { audio, objectUrl, fingerprint, active: record.active }
      this.customAudioAssets.set(scope, cached)
    } else {
      cached.active = record.active
    }
    return cached
  }

  async prepareStoredCustomSound(scope: string) {
    try {
      const record = await loadCustomNotificationSound(scope)
      if (record) this.prepareCustomSound(scope, record)
      return record ?? null
    } catch {
      return null
    }
  }

  async unlockAndPreview(key: NotificationSoundKey, volume: number, scope = 'device') {
    const result = await this.play(key, volume || 65, scope)
    return result === 'disabled' ? this.previewPreset('SOFT_CHIME', volume || 65) : result
  }

  clearCustomSound(scope: string) {
    const cached = this.customAudioAssets.get(scope)
    if (!cached) return
    cached.audio.pause()
    URL.revokeObjectURL(cached.objectUrl)
    this.customAudioAssets.delete(scope)
  }

  async suspend() {
    this.audioAssets.forEach((audio) => {
      audio.pause()
      audio.currentTime = 0
    })
    this.customAudioAssets.forEach(({ audio }) => {
      audio.pause()
      audio.currentTime = 0
    })
    if (this.context?.state === 'running') await this.context.suspend().catch(() => undefined)
  }

  private async playPreset(key: AudibleSoundKey, normalizedVolume: number): Promise<PlayResult> {
    const assetResult = await this.playAsset(key, normalizedVolume)
    if (assetResult !== 'unavailable') return assetResult

    const context = this.context ?? this.createContext()
    if (!context) return 'blocked'
    try {
      if (context.state === 'suspended') await context.resume()
      if (context.state !== 'running') return 'blocked'
      this.render(context, key, normalizedVolume)
      return 'played'
    } catch {
      return 'blocked'
    }
  }

  private async playAsset(key: AudibleSoundKey, volume: number): Promise<AssetPlayResult> {
    if (this.unavailableAssets.has(key) || typeof Audio === 'undefined') return 'unavailable'
    const audio = this.audioAssets.get(key) ?? this.createAudioAsset(key)
    try {
      audio.pause()
      audio.currentTime = 0
      audio.volume = volume
      await audio.play()
      return 'played'
    } catch (error) {
      if (audio.error || (error instanceof DOMException && error.name === 'NotSupportedError')) {
        this.audioAssets.delete(key)
        this.unavailableAssets.add(key)
        return 'unavailable'
      }
      return 'blocked'
    }
  }

  private createAudioAsset(key: AudibleSoundKey) {
    const audio = new Audio(notificationSoundAssetUrls[key])
    audio.preload = 'auto'
    this.audioAssets.set(key, audio)
    return audio
  }

  private async playStoredCustom(
    scope: string,
    volume: number,
    requireActive: boolean,
  ): Promise<AssetPlayResult> {
    if (typeof Audio === 'undefined' || typeof URL === 'undefined'
      || typeof URL.createObjectURL !== 'function') return 'unavailable'
    try {
      const record = await loadCustomNotificationSound(scope)
      if (!record || (requireActive && !record.active)) return 'unavailable'
      const cached = this.prepareCustomSound(scope, record)
      return cached ? this.playCachedCustom(cached.audio, volume) : 'unavailable'
    } catch (error) {
      if (isAudioError(error, 'NotAllowedError')) return 'blocked'
      return 'unavailable'
    }
  }

  private async playCachedCustom(audio: HTMLAudioElement, volume: number): Promise<AssetPlayResult> {
    try {
      audio.pause()
      audio.currentTime = 0
      audio.volume = volume
      const playRequest = audio.play()
      await playRequest
      return 'played'
    } catch (error) {
      if (isAudioError(error, 'NotAllowedError')) return 'blocked'
      return 'unavailable'
    }
  }

  private createContext() {
    const Context = window.AudioContext
    if (!Context) return null
    this.context = new Context()
    return this.context
  }

  private render(context: AudioContext, key: AudibleSoundKey, volume: number) {
    const now = context.currentTime
    const master = context.createGain()
    const compressor = context.createDynamicsCompressor()
    const delay = context.createDelay(0.5)
    const ambience = context.createGain()
    master.gain.setValueAtTime(Math.max(0.0001, volume * 0.24), now)
    compressor.threshold.setValueAtTime(-20, now)
    compressor.knee.setValueAtTime(18, now)
    compressor.ratio.setValueAtTime(4, now)
    compressor.attack.setValueAtTime(0.004, now)
    compressor.release.setValueAtTime(0.16, now)
    delay.delayTime.setValueAtTime(0.075, now)
    ambience.gain.setValueAtTime(0.12, now)
    master.connect(compressor)
    master.connect(delay)
    delay.connect(ambience)
    ambience.connect(compressor)
    compressor.connect(context.destination)

    const presets: Record<AudibleSoundKey, Array<[number, number, number, number]>> = {
      SOFT_CHIME: [[659.25, 0, 0.58, 0.72], [783.99, 0.09, 0.58, 0.58], [987.77, 0.18, 0.62, 0.44]],
      CLEAR_BELL: [[987.77, 0, 0.72, 0.82], [1318.51, 0.075, 0.62, 0.5]],
      DIGITAL_PING: [[1318.51, 0, 0.34, 0.78], [1975.53, 0.018, 0.24, 0.24]],
      DOUBLE_TONE: [[698.46, 0, 0.42, 0.7], [1046.5, 0.24, 0.5, 0.74]],
      URGENT_ALERT: [[783.99, 0, 0.3, 0.72], [1046.5, 0.13, 0.32, 0.62], [783.99, 0.38, 0.3, 0.72], [1174.66, 0.51, 0.38, 0.66]],
    }
    let end = now
    presets[key].forEach(([frequency, offset, duration, level]) => {
      const start = now + offset
      const stop = start + duration
      ;[[1, 1], [2.005, 0.2], [3.01, 0.07]].forEach(([ratio, partialLevel], index) => {
        const oscillator = context.createOscillator()
        const gain = context.createGain()
        oscillator.type = 'sine'
        oscillator.frequency.setValueAtTime(frequency * ratio, start)
        oscillator.detune.setValueAtTime(index === 0 ? 0 : index * 1.5, start)
        gain.gain.setValueAtTime(0.0001, start)
        gain.gain.linearRampToValueAtTime(level * partialLevel, start + 0.012)
        gain.gain.exponentialRampToValueAtTime(0.0001, stop)
        oscillator.connect(gain)
        gain.connect(master)
        oscillator.start(start)
        oscillator.stop(stop + 0.02)
      })
      end = Math.max(end, stop)
    })
    master.gain.setValueAtTime(Math.max(0.0001, volume * 0.24), end)
    master.gain.exponentialRampToValueAtTime(0.0001, end + 0.12)
  }
}

export const notificationSoundEngine = new NotificationSoundEngine()

function isAudioError(error: unknown, name: string) {
  return typeof error === 'object' && error !== null && 'name' in error
    && (error as { name?: unknown }).name === name
}
