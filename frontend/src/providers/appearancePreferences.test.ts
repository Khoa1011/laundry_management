import { describe, expect, it } from 'vitest'
import {
  contrastRatio,
  DEFAULT_APPEARANCE,
  normalizeHex,
  persistAppearance,
  readAppearancePreferences,
  readableForeground,
} from './appearancePreferences'

describe('appearance preferences', () => {
  it('normalizes valid colors and falls back for invalid values', () => {
    expect(normalizeHex(' #147a5b ')).toBe('#147A5B')
    expect(normalizeHex('not-a-color')).toBe(DEFAULT_APPEARANCE.customPrimary)
  })

  it('chooses the more readable button foreground', () => {
    expect(readableForeground('#147A5B')).toBe('#FFFFFF')
    expect(readableForeground('#F4C84A')).toBe('#17261F')
    expect(contrastRatio('#147A5B', readableForeground('#147A5B'))).toBeGreaterThanOrEqual(4.5)
  })

  it('persists and reads every supported appearance preference', () => {
    const preferences = {
      ...DEFAULT_APPEARANCE,
      palette: 'royal-violet' as const,
      brandIntensity: 'prominent' as const,
      glassStrength: 'strong' as const,
      motionLevel: 'reduced' as const,
      reduceTransparency: true,
      advancedEffects: false,
      autoReduceEffects: false,
    }

    persistAppearance(preferences)

    expect(readAppearancePreferences()).toEqual(preferences)
  })
})
