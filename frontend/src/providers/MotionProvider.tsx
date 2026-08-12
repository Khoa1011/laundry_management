import { domAnimation, LazyMotion, MotionConfig } from 'motion/react'
import type { ReactNode } from 'react'
import { useTheme } from './ThemeProvider'
import { motionDuration, motionEase } from './motionPresets'

export function MotionProvider({ children }: { children: ReactNode }) {
  const { preferences } = useTheme()
  const reduced = preferences.motionLevel === 'reduced' || preferences.motionLevel === 'off'
  const duration = preferences.motionLevel === 'full'
    ? motionDuration.structural
    : preferences.motionLevel === 'balanced'
      ? motionDuration.overlay
      : 0.01

  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig
        reducedMotion={reduced ? 'always' : 'user'}
        transition={{ duration, ease: motionEase }}
      >
        {children}
      </MotionConfig>
    </LazyMotion>
  )
}
