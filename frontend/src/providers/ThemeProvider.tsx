import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type ThemeName = 'laundry-teal' | 'laundry-indigo'

interface ThemeContextValue {
  theme: ThemeName
  setTheme: (theme: ThemeName) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const initial = document.documentElement.dataset.theme === 'laundry-indigo'
    ? 'laundry-indigo'
    : 'laundry-teal'
  const [theme, setTheme] = useState<ThemeName>(initial)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('laundry.theme', theme)
  }, [theme])

  const value = useMemo(() => ({ theme, setTheme }), [theme])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used within ThemeProvider')
  return context
}
