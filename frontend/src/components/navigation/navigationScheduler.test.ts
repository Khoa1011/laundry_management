import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  NAVIGATION_SETTLE_MS,
  resetNavigationScheduler,
  scheduleNavigation,
} from './navigationScheduler'

describe('navigationScheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    resetNavigationScheduler()
  })

  afterEach(() => {
    resetNavigationScheduler()
    vi.useRealTimers()
  })

  it('runs the first navigation immediately and coalesces a burst to the latest destination', () => {
    const visited: string[] = []

    scheduleNavigation(() => visited.push('/orders'))
    scheduleNavigation(() => visited.push('/customers'))
    scheduleNavigation(() => visited.push('/employees'))
    scheduleNavigation(() => visited.push('/catalog/services'))

    expect(visited).toEqual(['/orders'])

    vi.advanceTimersByTime(NAVIGATION_SETTLE_MS)

    expect(visited).toEqual(['/orders', '/catalog/services'])
  })

  it('allows a normal navigation after the settle window ends', () => {
    const navigate = vi.fn()

    scheduleNavigation(navigate)
    vi.advanceTimersByTime(NAVIGATION_SETTLE_MS)
    scheduleNavigation(navigate)

    expect(navigate).toHaveBeenCalledTimes(2)
  })
})
