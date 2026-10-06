import { describe, expect, it } from 'vitest'
import { formatDateTime, formatRecentDateTime, nextRecentDateTimeRefresh } from './dateTime'

describe('operational date and time formatting', () => {
  const localInstant = new Date('2026-09-30T22:07:00Z')
  const now = new Date('2026-10-01T05:00:00Z').getTime()

  it('uses the requested HH:mm dd/MM/yyyy format', () => {
    expect(formatDateTime(localInstant)).toBe('05:07 01/10/2026')
  })

  it('labels newly created records by elapsed minutes', () => {
    expect(formatRecentDateTime(new Date(now - 30_000), now)).toBe('Vừa xong')
    expect(formatRecentDateTime(new Date(now - 60_000), now)).toBe('1 phút trước')
    expect(formatRecentDateTime(new Date(now - 2 * 60_000), now)).toBe('2 phút trước')
  })

  it('falls back to the absolute format outside the recent window', () => {
    expect(formatRecentDateTime(new Date(now - 60 * 60_000), now)).toBe('11:00 01/10/2026')
    expect(formatRecentDateTime(new Date(now + 60_000), now)).toBe('12:01 01/10/2026')
  })

  it('provides safe invalid values and a minute-boundary refresh delay', () => {
    expect(formatDateTime('not-a-date')).toBe('—')
    expect(formatRecentDateTime('not-a-date', now)).toBe('—')
    expect(nextRecentDateTimeRefresh(new Date(now - 90_000), now)).toBe(30_050)
    expect(nextRecentDateTimeRefresh(new Date(now - 60 * 60_000), now)).toBeNull()
  })
})
