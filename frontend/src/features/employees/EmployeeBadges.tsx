import { Ban, CheckCircle2, CirclePause, LockKeyhole, ShieldAlert, UserRoundCheck, UserRoundX } from 'lucide-react'
import type { TFunction } from 'i18next'
import type { EmployeeAccountState, EmployeeStatus } from './types'

export function EmployeeStatusBadge({ status, t }: { status: EmployeeStatus; t: TFunction }) {
  const config = {
    ACTIVE: { label: t('employee:active'), icon: CheckCircle2 },
    INACTIVE: { label: t('employee:inactive'), icon: CirclePause },
    SUSPENDED: { label: t('employee:suspended'), icon: ShieldAlert },
    TERMINATED: { label: t('employee:terminated'), icon: Ban },
  }[status]
  const Icon = config.icon
  return <span className={`employee-badge employee-badge--${status.toLowerCase()}`}><Icon size={14} aria-hidden="true" />{config.label}</span>
}

export function EmployeeAccountBadge({ status, t }: { status: EmployeeAccountState; t: TFunction }) {
  const config = {
    NO_ACCOUNT: { label: t('employee:noAccount'), icon: UserRoundX },
    ACCOUNT_ACTIVE: { label: t('employee:accountActive'), icon: UserRoundCheck },
    ACCOUNT_INACTIVE: { label: t('employee:accountInactive'), icon: CirclePause },
    ACCOUNT_LOCKED: { label: t('employee:accountLocked'), icon: LockKeyhole },
  }[status]
  const Icon = config.icon
  return <span className={`employee-badge employee-badge--${status.toLowerCase()}`}><Icon size={14} aria-hidden="true" />{config.label}</span>
}

export function PositionStatusBadge({ active, t }: { active: boolean; t: TFunction }) {
  const Icon = active ? CheckCircle2 : CirclePause
  return <span className={`employee-badge employee-badge--${active ? 'active' : 'inactive'}`}><Icon size={14} aria-hidden="true" />{t(active ? 'employee:positionActive' : 'employee:positionInactive')}</span>
}
