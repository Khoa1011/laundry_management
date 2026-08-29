export type MotionLevel = 'full' | 'balanced' | 'reduced' | 'off'

export interface AppearancePreferences {
  motionLevel: MotionLevel
}

const MOTION_STORAGE_KEY = 'laundry.ui.motionLevel'
const motionLevels = new Set<MotionLevel>(['full', 'balanced', 'reduced', 'off'])

export const DEFAULT_APPEARANCE: AppearancePreferences = {
  motionLevel: 'balanced',
}

export function readAppearancePreferences(): AppearancePreferences {
  try {
    const stored = localStorage.getItem(MOTION_STORAGE_KEY)
    return {
      motionLevel: motionLevels.has(stored as MotionLevel)
        ? stored as MotionLevel
        : DEFAULT_APPEARANCE.motionLevel,
    }
  } catch {
    return DEFAULT_APPEARANCE
  }
}

export function applyAppearanceToRoot(preferences: AppearancePreferences) {
  const root = document.documentElement
  root.dataset.motionLevel = preferences.motionLevel
  root.dataset.theme = 'solid-admin'
}

export function persistAppearance(preferences: AppearancePreferences) {
  localStorage.setItem(MOTION_STORAGE_KEY, preferences.motionLevel)
}
