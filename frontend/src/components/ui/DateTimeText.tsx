import { useEffect, useState } from 'react'
import { formatDateTime, formatRecentDateTime, nextRecentDateTimeRefresh } from '../../utils/dateTime'

interface DateTimeTextProps {
  value: string
  recent?: boolean
}

export function DateTimeText({ value, recent = false }: DateTimeTextProps) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!recent) return undefined
    const delay = nextRecentDateTimeRefresh(value, now)
    if (delay === null) return undefined

    const timer = window.setTimeout(() => setNow(Date.now()), delay)
    return () => window.clearTimeout(timer)
  }, [now, recent, value])

  const absolute = formatDateTime(value)
  return <time dateTime={value} title={absolute}>{recent ? formatRecentDateTime(value, now) : absolute}</time>
}
