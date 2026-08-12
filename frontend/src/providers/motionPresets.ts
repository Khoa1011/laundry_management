export const motionEase = [0.22, 1, 0.36, 1] as const

export const motionDuration = {
  primitive: 0.14,
  overlay: 0.18,
  structural: 0.22,
  emphasis: 0.24,
} as const

export const motionSpring = {
  press: { type: 'spring', stiffness: 680, damping: 38, mass: 0.45 },
  release: { type: 'spring', stiffness: 520, damping: 34, mass: 0.55 },
  sharedIndicator: { type: 'spring', stiffness: 440, damping: 38, mass: 0.65 },
} as const
