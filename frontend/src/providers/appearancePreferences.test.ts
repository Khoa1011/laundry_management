import { describe, expect, it } from 'vitest'
import {
  DEFAULT_APPEARANCE,
  applyAppearanceToRoot,
  persistAppearance,
  readAppearancePreferences,
} from './appearancePreferences'

describe('appearance preferences', () => {
  it('falls back to balanced motion for unsupported stored values', () => {
    localStorage.setItem('laundry.ui.motionLevel', 'elastic')
    expect(readAppearancePreferences()).toEqual(DEFAULT_APPEARANCE)
  })

  it('persists and reads the supported motion preference', () => {
    persistAppearance({ motionLevel: 'reduced' })
    expect(readAppearancePreferences()).toEqual({ motionLevel: 'reduced' })
  })

  it('applies the solid admin contract', () => {
    applyAppearanceToRoot({ motionLevel: 'off' })

    expect(document.documentElement.dataset.theme).toBe('solid-admin')
    expect(document.documentElement.dataset.motionLevel).toBe('off')
  })
})
