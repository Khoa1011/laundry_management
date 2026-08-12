import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import i18n from '../../i18n'
import { EmployeeAccountBadge, EmployeeStatusBadge, PositionStatusBadge } from './EmployeeBadges'

describe('employee semantic badges', () => {
  it('renders text and an icon for work status', () => {
    const { container } = render(<EmployeeStatusBadge status="SUSPENDED" t={i18n.t} />)
    expect(screen.getByText(i18n.t('employee:suspended'))).toBeInTheDocument()
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('keeps locked account state separate from employee work status', () => {
    render(<EmployeeAccountBadge status="ACCOUNT_LOCKED" t={i18n.t} />)
    expect(screen.getByText(i18n.t('employee:accountLocked'))).toBeInTheDocument()
  })

  it('uses the neutral mapping for an inactive position', () => {
    render(<PositionStatusBadge active={false} t={i18n.t} />)
    expect(screen.getByText(i18n.t('employee:positionInactive'))).toBeInTheDocument()
  })
})
