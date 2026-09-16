import { describe, expect, it } from 'vitest'
import { localDayStartIso, nextLocalDayStartIso } from './dateFilters'

describe('order date filters', () => {
  it('uses the local start of the selected from date', () => {
    expect(localDayStartIso('2026-09-16')).toBe(new Date(2026, 8, 16).toISOString())
  })

  it('uses the local start of the next day as the exclusive to boundary', () => {
    expect(nextLocalDayStartIso('2026-09-16')).toBe(new Date(2026, 8, 17).toISOString())
    expect(nextLocalDayStartIso('2026-09-16')).not.toContain('23:59:59.999')
  })
})
