import type { ComponentProps } from 'react'
import { useTranslation } from 'react-i18next'
import { DatePickerField, type DatePickerLabels } from '../../components/ui/DatePickerField'

export function StockDatePicker(props: Omit<ComponentProps<typeof DatePickerField>, 'labels' | 'locale'>) {
  const { t, i18n } = useTranslation('stock')
  const labels = t('calendar', { returnObjects: true }) as DatePickerLabels
  return <DatePickerField {...props} labels={labels} locale={i18n.language.startsWith('en') ? 'en-GB' : 'vi-VN'} />
}
