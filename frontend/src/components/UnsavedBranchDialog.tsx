import { useEffect, useLayoutEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthProvider'
import type { BranchChangeRequest } from '../auth/branchChangeGuards'
import { ConfirmDialog } from './OverlayDialog'

export function UnsavedBranchDialog({ dirty, busy = false }: { dirty: boolean; busy?: boolean }) {
  const { registerBranchChangeGuard } = useAuth()
  const { t } = useTranslation('operations')
  const [request, setRequest] = useState<BranchChangeRequest | null>(null)
  const active = dirty || busy

  useLayoutEffect(() => {
    if (!active) return
    return registerBranchChangeGuard(setRequest)
  }, [active, registerBranchChangeGuard])

  useEffect(() => { if (!active) setRequest(null) }, [active])

  return <ConfirmDialog open={active && request !== null} pending={busy}
    onClose={() => { if (!busy) setRequest(null) }}
    onConfirm={() => { if (!busy && request) { request.proceed(); setRequest(null) } }}
    title={t('common:unsavedTitle')} body={t('unsavedBranchBody')} confirmLabel={t('changeBranch')} />
}
