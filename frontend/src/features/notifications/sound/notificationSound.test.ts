import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CustomNotificationSoundRecord } from './customNotificationSound'
import {
  notificationSoundAssetUrls,
  notificationSoundCatalog,
  notificationSoundEngine,
} from './notificationSound'

describe('notificationSoundCatalog', () => {
  it('contains the six built-in allowlisted presets', () => {
    expect(notificationSoundCatalog.map((item) => item.key)).toEqual([
      'NONE',
      'SOFT_CHIME',
      'CLEAR_BELL',
      'DIGITAL_PING',
      'DOUBLE_TONE',
      'URGENT_ALERT',
    ])
  })

  it('maps every audible preset to a replaceable local WAV asset', () => {
    expect(Object.keys(notificationSoundAssetUrls)).toEqual([
      'SOFT_CHIME',
      'CLEAR_BELL',
      'DIGITAL_PING',
      'DOUBLE_TONE',
      'URGENT_ALERT',
    ])
    expect(Object.values(notificationSoundAssetUrls).every((url) =>
      url.startsWith('/sounds/notifications/') && url.endsWith('.wav'))).toBe(true)
  })
})

describe('notificationSoundEngine custom preview', () => {
  const scope = 'user:preview-test'

  afterEach(() => {
    notificationSoundEngine.clearCustomSound(scope)
    vi.unstubAllGlobals()
  })

  it('plays an imported blob directly without waiting for IndexedDB', async () => {
    const play = vi.fn().mockResolvedValue(undefined)
    class AudioMock {
      preload = ''
      currentTime = 0
      volume = 1
      pause = vi.fn()
      play = play
    }
    vi.stubGlobal('Audio', AudioMock)
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:custom-sound'),
      revokeObjectURL: vi.fn(),
    })
    const record: CustomNotificationSoundRecord = {
      scope,
      blob: new Blob(['audio'], { type: 'audio/mpeg' }),
      fileName: 'custom.mp3',
      mimeType: 'audio/mpeg',
      size: 5,
      updatedAt: 1,
      active: false,
    }

    await expect(notificationSoundEngine.previewCustom(scope, 80, record))
      .resolves.toBe('played')
    expect(play).toHaveBeenCalledOnce()
  })
})
