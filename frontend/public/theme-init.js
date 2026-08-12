(() => {
  try {
    const palette = localStorage.getItem('laundry.ui.palette')
    const allowed = ['laundry-green', 'ocean-blue', 'aqua-teal', 'royal-violet', 'warm-amber', 'rose-red', 'custom']
    const root = document.documentElement
    const selectedPalette = allowed.includes(palette) ? palette : 'laundry-green'
    const customPalette = JSON.parse(localStorage.getItem('laundry.ui.customPalette') || '{}')
    const normalizeHex = (value, fallback) => /^#[0-9A-F]{6}$/i.test(value || '') ? value.toUpperCase() : fallback
    const primary = normalizeHex(customPalette.primary, '#147A5B')
    const accent = normalizeHex(customPalette.accent, '#0F7C80')
    const luminance = (hex) => {
      const channels = [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16) / 255)
      const linear = channels.map((channel) => channel <= 0.03928
        ? channel / 12.92
        : ((channel + 0.055) / 1.055) ** 2.4)
      return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]
    }
    const primaryLuminance = luminance(primary)
    const whiteContrast = 1.05 / (primaryLuminance + 0.05)
    const darkLuminance = luminance('#17261F')
    const darkContrast = (Math.max(primaryLuminance, darkLuminance) + 0.05)
      / (Math.min(primaryLuminance, darkLuminance) + 0.05)

    root.dataset.palette = selectedPalette
    document.documentElement.dataset.theme = palette === 'aqua-teal' ? 'laundry-indigo' : 'laundry-teal'
    root.dataset.brandIntensity = localStorage.getItem('laundry.ui.brandIntensity') || 'balanced'
    root.dataset.glassStrength = localStorage.getItem('laundry.ui.glassStrength') || 'medium'
    root.dataset.motionLevel = localStorage.getItem('laundry.ui.motionLevel') || 'balanced'
    root.dataset.reduceTransparency = localStorage.getItem('laundry.ui.reduceTransparency') || 'false'
    root.dataset.advancedEffects = localStorage.getItem('laundry.ui.advancedEffects') || 'true'
    root.style.setProperty('--custom-primary', primary)
    root.style.setProperty('--custom-accent', accent)
    root.style.setProperty('--custom-primary-foreground', whiteContrast >= darkContrast ? '#FFFFFF' : '#17261F')
  } catch {
    document.documentElement.dataset.palette = 'laundry-green'
    document.documentElement.dataset.theme = 'laundry-teal'
  }
})()
