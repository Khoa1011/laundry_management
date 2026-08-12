import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  applyAppearanceToRoot,
  DEFAULT_APPEARANCE,
  normalizeHex,
  persistAppearance,
  readAppearancePreferences,
  type AppearancePreferences,
  type ThemeName,
} from './appearancePreferences'

interface ThemeContextValue {
  preferences: AppearancePreferences
  appliedPreferences: AppearancePreferences
  hasPreview: boolean
  previewPreferences: (preferences: AppearancePreferences) => void
  applyPreferences: (preferences: AppearancePreferences) => void
  cancelPreview: () => void
  theme: ThemeName
  setTheme: (theme: ThemeName) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [appliedPreferences, setAppliedPreferences] = useState<AppearancePreferences>(readAppearancePreferences)
  const [preview, setPreview] = useState<AppearancePreferences | null>(null)
  const preferences = preview ?? appliedPreferences

  useEffect(() => {
    applyAppearanceToRoot(preferences)
  }, [preferences])

  const previewPreferences = useCallback((next: AppearancePreferences) => {
    setPreview(next)
  }, [])

  const applyPreferences = useCallback((next: AppearancePreferences) => {
    const normalized = {
      ...next,
      customPrimary: normalizeHex(next.customPrimary),
      customAccent: normalizeHex(next.customAccent, DEFAULT_APPEARANCE.customAccent),
    }
    persistAppearance(normalized)
    setAppliedPreferences(normalized)
    setPreview(null)
  }, [])

  const cancelPreview = useCallback(() => {
    setPreview(null)
  }, [])

  const setTheme = useCallback((theme: ThemeName) => {
    setAppliedPreferences((current) => {
      const next = {
        ...current,
        palette: theme === 'laundry-indigo' ? 'aqua-teal' as const : 'laundry-green' as const,
      }
      persistAppearance(next)
      return next
    })
    setPreview(null)
  }, [])

  const value = useMemo<ThemeContextValue>(() => ({
    preferences,
    appliedPreferences,
    hasPreview: preview !== null,
    previewPreferences,
    applyPreferences,
    cancelPreview,
    theme: preferences.palette === 'aqua-teal' ? 'laundry-indigo' : 'laundry-teal',
    setTheme,
  }), [
    appliedPreferences,
    applyPreferences,
    cancelPreview,
    preferences,
    preview,
    previewPreferences,
    setTheme,
  ])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used within ThemeProvider')
  return context
}
