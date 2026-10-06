const MINUTE_MS = 60_000
const RECENT_WINDOW_MS = 60 * MINUTE_MS
const OPERATIONAL_TIME_ZONE = 'Asia/Ho_Chi_Minh'

const dateTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: OPERATIONAL_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hourCycle: 'h23',
})

export function formatDateTime(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'

  const parts = Object.fromEntries(dateTimeFormatter.formatToParts(date).map((part) => [part.type, part.value]))
  return `${parts.hour}:${parts.minute} ${parts.day}/${parts.month}/${parts.year}`
}

export function formatRecentDateTime(value: string | Date, now = Date.now()) {
  const date = value instanceof Date ? value : new Date(value)
  const createdAt = date.getTime()
  if (Number.isNaN(createdAt)) return '—'

  const elapsed = now - createdAt
  if (elapsed < 0 || elapsed >= RECENT_WINDOW_MS) return formatDateTime(date)
  if (elapsed < MINUTE_MS) return 'Vừa xong'

  return `${Math.floor(elapsed / MINUTE_MS)} phút trước`
}

export function nextRecentDateTimeRefresh(value: string | Date, now = Date.now()) {
  const date = value instanceof Date ? value : new Date(value)
  const elapsed = now - date.getTime()
  if (Number.isNaN(elapsed) || elapsed < 0 || elapsed >= RECENT_WINDOW_MS) return null

  return MINUTE_MS - (elapsed % MINUTE_MS) + 50
}
