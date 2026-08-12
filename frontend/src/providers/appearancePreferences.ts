export type PaletteName =
  | 'laundry-green'
  | 'ocean-blue'
  | 'aqua-teal'
  | 'royal-violet'
  | 'warm-amber'
  | 'rose-red'
  | 'custom'
export type BrandIntensity = 'subtle' | 'balanced' | 'prominent'
export type GlassStrength = 'subtle' | 'medium' | 'strong'
export type MotionLevel = 'full' | 'balanced' | 'reduced' | 'off'
export type ThemeName = 'laundry-teal' | 'laundry-indigo'

export interface AppearancePreferences {
  palette: PaletteName
  customPrimary: string
  customAccent: string
  brandIntensity: BrandIntensity
  glassStrength: GlassStrength
  motionLevel: MotionLevel
  reduceTransparency: boolean
  advancedEffects: boolean
  autoReduceEffects: boolean
}

const STORAGE = {
  palette: 'laundry.ui.palette',
  customPalette: 'laundry.ui.customPalette',
  brandIntensity: 'laundry.ui.brandIntensity',
  glassStrength: 'laundry.ui.glassStrength',
  motionLevel: 'laundry.ui.motionLevel',
  reduceTransparency: 'laundry.ui.reduceTransparency',
  advancedEffects: 'laundry.ui.advancedEffects',
  autoReduceEffects: 'laundry.ui.autoReduceEffects',
} as const

export const DEFAULT_APPEARANCE: AppearancePreferences = {
  palette: 'laundry-green',
  customPrimary: '#147A5B',
  customAccent: '#0F7C80',
  brandIntensity: 'balanced',
  glassStrength: 'medium',
  motionLevel: 'balanced',
  reduceTransparency: false,
  advancedEffects: true,
  autoReduceEffects: true,
}

const palettes = new Set<PaletteName>([
  'laundry-green', 'ocean-blue', 'aqua-teal', 'royal-violet', 'warm-amber', 'rose-red', 'custom',
])
const intensities = new Set<BrandIntensity>(['subtle', 'balanced', 'prominent'])
const glassStrengths = new Set<GlassStrength>(['subtle', 'medium', 'strong'])
const motionLevels = new Set<MotionLevel>(['full', 'balanced', 'reduced', 'off'])

function readBoolean(key: string, fallback: boolean) {
  const value = localStorage.getItem(key)
  return value === null ? fallback : value === 'true'
}

export function normalizeHex(value: string, fallback = DEFAULT_APPEARANCE.customPrimary) {
  const normalized = value.trim().toUpperCase()
  return /^#[0-9A-F]{6}$/.test(normalized) ? normalized : fallback
}

export function readAppearancePreferences(): AppearancePreferences {
  try {
    const legacy = localStorage.getItem('laundry.theme')
    const storedPalette = localStorage.getItem(STORAGE.palette)
    const custom = JSON.parse(localStorage.getItem(STORAGE.customPalette) ?? '{}') as {
      primary?: string
      accent?: string
    }
    const paletteCandidate = storedPalette
      ?? (legacy === 'laundry-indigo' ? 'aqua-teal' : DEFAULT_APPEARANCE.palette)
    const intensityCandidate = localStorage.getItem(STORAGE.brandIntensity)
    const glassCandidate = localStorage.getItem(STORAGE.glassStrength)
    const motionCandidate = localStorage.getItem(STORAGE.motionLevel)

    return {
      palette: palettes.has(paletteCandidate as PaletteName)
        ? paletteCandidate as PaletteName
        : DEFAULT_APPEARANCE.palette,
      customPrimary: normalizeHex(custom.primary ?? DEFAULT_APPEARANCE.customPrimary),
      customAccent: normalizeHex(custom.accent ?? DEFAULT_APPEARANCE.customAccent, DEFAULT_APPEARANCE.customAccent),
      brandIntensity: intensities.has(intensityCandidate as BrandIntensity)
        ? intensityCandidate as BrandIntensity
        : DEFAULT_APPEARANCE.brandIntensity,
      glassStrength: glassStrengths.has(glassCandidate as GlassStrength)
        ? glassCandidate as GlassStrength
        : DEFAULT_APPEARANCE.glassStrength,
      motionLevel: motionLevels.has(motionCandidate as MotionLevel)
        ? motionCandidate as MotionLevel
        : DEFAULT_APPEARANCE.motionLevel,
      reduceTransparency: readBoolean(STORAGE.reduceTransparency, DEFAULT_APPEARANCE.reduceTransparency),
      advancedEffects: readBoolean(STORAGE.advancedEffects, DEFAULT_APPEARANCE.advancedEffects),
      autoReduceEffects: readBoolean(STORAGE.autoReduceEffects, DEFAULT_APPEARANCE.autoReduceEffects),
    }
  } catch {
    return DEFAULT_APPEARANCE
  }
}

function relativeLuminance(hex: string) {
  const channels = [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16) / 255)
  const linear = channels.map((channel) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]
}

export function contrastRatio(first: string, second: string) {
  const firstLuminance = relativeLuminance(normalizeHex(first))
  const secondLuminance = relativeLuminance(normalizeHex(second))
  const light = Math.max(firstLuminance, secondLuminance)
  const dark = Math.min(firstLuminance, secondLuminance)
  return (light + 0.05) / (dark + 0.05)
}

export function readableForeground(background: string) {
  const normalized = normalizeHex(background)
  return contrastRatio(normalized, '#FFFFFF') >= contrastRatio(normalized, '#17261F')
    ? '#FFFFFF'
    : '#17261F'
}

function isWeakDevice() {
  const hardwareConcurrency = navigator.hardwareConcurrency || 8
  const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8
  return hardwareConcurrency <= 4 || deviceMemory <= 4
}

export function applyAppearanceToRoot(preferences: AppearancePreferences) {
  const root = document.documentElement
  root.dataset.palette = preferences.palette
  root.dataset.theme = preferences.palette === 'aqua-teal' ? 'laundry-indigo' : 'laundry-teal'
  root.dataset.brandIntensity = preferences.brandIntensity
  root.dataset.glassStrength = preferences.glassStrength
  root.dataset.motionLevel = preferences.motionLevel
  root.dataset.reduceTransparency = String(preferences.reduceTransparency)
  root.dataset.advancedEffects = String(preferences.advancedEffects)
  root.dataset.weakDevice = String(preferences.autoReduceEffects && isWeakDevice())
  root.style.setProperty('--custom-primary', normalizeHex(preferences.customPrimary))
  root.style.setProperty('--custom-accent', normalizeHex(preferences.customAccent, DEFAULT_APPEARANCE.customAccent))
  root.style.setProperty('--custom-primary-foreground', readableForeground(preferences.customPrimary))
}

export function persistAppearance(preferences: AppearancePreferences) {
  localStorage.setItem(STORAGE.palette, preferences.palette)
  localStorage.setItem(STORAGE.customPalette, JSON.stringify({
    primary: preferences.customPrimary,
    accent: preferences.customAccent,
  }))
  localStorage.setItem(STORAGE.brandIntensity, preferences.brandIntensity)
  localStorage.setItem(STORAGE.glassStrength, preferences.glassStrength)
  localStorage.setItem(STORAGE.motionLevel, preferences.motionLevel)
  localStorage.setItem(STORAGE.reduceTransparency, String(preferences.reduceTransparency))
  localStorage.setItem(STORAGE.advancedEffects, String(preferences.advancedEffects))
  localStorage.setItem(STORAGE.autoReduceEffects, String(preferences.autoReduceEffects))
}
