function localDayBoundary(value: string, dayOffset: number) {
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return undefined
  return new Date(year, month - 1, day + dayOffset).toISOString()
}

export const localDayStartIso = (value: string) => localDayBoundary(value, 0)
export const nextLocalDayStartIso = (value: string) => localDayBoundary(value, 1)
