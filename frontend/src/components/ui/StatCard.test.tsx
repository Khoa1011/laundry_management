import { render, screen } from '@testing-library/react'
import { Activity } from 'lucide-react'
import { describe, expect, it } from 'vitest'
import { StatCard } from './StatCard'

describe('StatCard', () => {
  it('renders a labelled metric with semantic tone and hidden decorative icon', () => {
    const { container } = render(
      <StatCard
        icon={<Activity />}
        label="Đang hoạt động"
        value="24"
        tone="success"
        supporting={<span>Cập nhật hôm nay</span>}
      />,
    )

    expect(screen.getByText('Đang hoạt động')).toBeInTheDocument()
    expect(screen.getByText('24')).toBeInTheDocument()
    expect(screen.getByText('Cập nhật hôm nay')).toBeInTheDocument()
    expect(container.querySelector('.stat-card--success')).toBeInTheDocument()
    expect(container.querySelector('.stat-card__icon')).toHaveAttribute('aria-hidden', 'true')
  })

  it('renders trend context without relying on color alone', () => {
    render(
      <StatCard
        label="Tỷ lệ hoàn thành"
        value="90%"
        trend={{ direction: 'up', value: 'Tăng 20%', label: 'so với tháng trước' }}
      />,
    )

    expect(screen.getByText('Tăng 20%')).toBeInTheDocument()
    expect(screen.getByText('so với tháng trước')).toBeInTheDocument()
  })
})
