import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  applyAppearanceToRoot,
  persistAppearance,
  readAppearancePreferences,
  type AppearancePreferences,
} from './appearancePreferences'

interface ThemeContextValue {
  preferences: AppearancePreferences
  appliedPreferences: AppearancePreferences
  hasPreview: boolean
  previewPreferences: (preferences: AppearancePreferences) => void
  applyPreferences: (preferences: AppearancePreferences) => void
  cancelPreview: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [appliedPreferences, setAppliedPreferences] = useState<AppearancePreferences>(readAppearancePreferences)
  const [preview, setPreview] = useState<AppearancePreferences | null>(null)
  const preferences = preview ?? appliedPreferences

  useEffect(() => {
    applyAppearanceToRoot(preferences)
  }, [preferences])

  const previewPreferences = useCallback((next: AppearancePreferences) => setPreview(next), [])

  const applyPreferences = useCallback((next: AppearancePreferences) => {
    persistAppearance(next)
    setAppliedPreferences(next)
    setPreview(null)
  }, [])

  const cancelPreview = useCallback(() => setPreview(null), [])

  const value = useMemo<ThemeContextValue>(() => ({
    preferences,
    appliedPreferences,
    hasPreview: preview !== null,
    previewPreferences,
    applyPreferences,
    cancelPreview,
  }), [appliedPreferences, applyPreferences, cancelPreview, preferences, preview, previewPreferences])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used within ThemeProvider')
  return context
}
