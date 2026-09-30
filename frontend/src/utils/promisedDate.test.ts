import { describe, expect, it } from 'vitest'
import { promisedDateInstant, promisedDateKey, promisedDateLabel } from './promisedDate'

describe('promised date helpers', () => {
  it('keeps the selected calendar date when adapting it to the existing timestamp API', () => {
    const instant = promisedDateInstant('2026-09-18')
    expect(promisedDateKey(instant)).toBe('2026-09-18')
    const local = new Date(instant)
    expect(local.getHours()).toBe(23)
    expect(local.getMinutes()).toBe(59)
  })

  it('formats promised dates without a time', () => {
    const label = promisedDateLabel(promisedDateInstant('2026-09-18'))
    expect(label).toContain('18/09/2026')
    expect(label).not.toMatch(/\d{1,2}:\d{2}/)
  })

  it('returns an empty key for missing values', () => {
    expect(promisedDateKey()).toBe('')
  })
})
