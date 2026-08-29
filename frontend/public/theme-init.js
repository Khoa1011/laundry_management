(() => {
  try {
    const allowedMotion = new Set(['full', 'balanced', 'reduced', 'off'])
    const storedMotion = localStorage.getItem('laundry.ui.motionLevel')
    document.documentElement.dataset.theme = 'solid-admin'
    document.documentElement.dataset.motionLevel = allowedMotion.has(storedMotion)
      ? storedMotion
      : 'balanced'
  } catch {
    document.documentElement.dataset.theme = 'solid-admin'
    document.documentElement.dataset.motionLevel = 'balanced'
  }
})()
