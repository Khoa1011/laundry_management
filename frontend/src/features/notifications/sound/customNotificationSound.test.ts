import { describe, expect, it } from 'vitest'
import {
  CustomNotificationSoundError,
  MAX_CUSTOM_NOTIFICATION_SOUND_BYTES,
  validateCustomNotificationSound,
} from './customNotificationSound'

describe('validateCustomNotificationSound', () => {
  it('accepts supported notification audio files', () => {
    expect(() => validateCustomNotificationSound(
      new File(['audio'], 'notification.mp3', { type: 'audio/mpeg' }),
    )).not.toThrow()
  })

  it('rejects unsupported files and files over five megabytes', () => {
    expect(() => validateCustomNotificationSound(
      new File(['text'], 'notification.txt', { type: 'text/plain' }),
    )).toThrowError(new CustomNotificationSoundError('INVALID_FILE_TYPE'))

    const oversized = new File(
      [new Uint8Array(MAX_CUSTOM_NOTIFICATION_SOUND_BYTES + 1)],
      'notification.wav',
      { type: 'audio/wav' },
    )
    expect(() => validateCustomNotificationSound(oversized))
      .toThrowError(new CustomNotificationSoundError('FILE_TOO_LARGE'))
  })
})
