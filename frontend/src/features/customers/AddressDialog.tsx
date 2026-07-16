import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { ApiError } from '../../api/client'
import type { CustomerAddress } from '../../api/types'
import { OverlayDialog } from '../../components/OverlayDialog'
import { useToast } from '../../providers/ToastProvider'
import { Field } from './QuickCustomerDialog'
import { useCreateAddress, useUpdateAddress } from './api'
import { addressSchema, type AddressFormValues } from './schemas'

const emptyAddress: AddressFormValues = { receiverName: '', receiverPhone: '', province: '', district: '', ward: '', addressLine: '', deliveryNote: '', isDefault: false }

export function AddressDialog({ open, onClose, customerId, branchId, address }: { open: boolean; onClose: () => void; customerId: number; branchId: number; address?: CustomerAddress | null }) {
  const { t } = useTranslation()
  const { notify } = useToast()
  const schema = useMemo(() => addressSchema(t), [t])
  const createMutation = useCreateAddress(customerId, branchId)
  const updateMutation = useUpdateAddress(customerId, branchId, address?.id ?? 0)
  const { register, handleSubmit, reset, setError, formState: { errors } } = useForm<AddressFormValues>({ resolver: zodResolver(schema), defaultValues: emptyAddress })
  const editing = Boolean(address)
  const pending = createMutation.isPending || updateMutation.isPending

  useEffect(() => {
    if (!open) return
    reset(address ? { receiverName: address.receiverName, receiverPhone: address.receiverPhone, province: address.province ?? '', district: address.district ?? '', ward: address.ward ?? '', addressLine: address.addressLine, deliveryNote: address.deliveryNote ?? '', isDefault: address.isDefault } : emptyAddress)
  }, [open, address, reset])

  const submit = handleSubmit(async (values) => {
    try {
      if (address) await updateMutation.mutateAsync({ ...values, version: address.version })
      else await createMutation.mutateAsync(values)
      notify(t(address ? 'addresses:updateSuccess' : 'addresses:addSuccess'))
      onClose()
    } catch (error) {
      if (error instanceof ApiError && error.problem.fieldErrors) {
        Object.entries(error.problem.fieldErrors).forEach(([field, messages]) => setError(field as keyof AddressFormValues, { message: messages[0] }))
      }
    }
  })
  const mutationError = createMutation.error ?? updateMutation.error
  const conflict = mutationError instanceof ApiError && mutationError.problem.errorCode === 'CUSTOMER_VERSION_CONFLICT'

  return <OverlayDialog open={open} onClose={() => !pending && onClose()} title={t(editing ? 'addresses:editTitle' : 'addresses:addTitle')} description={t('addresses:formDescription')} variant="drawer" footer={<><button type="button" className="button button--secondary" onClick={onClose} disabled={pending}>{t('cancel')}</button><button type="submit" form="address-form" className="button button--primary" disabled={pending}>{pending ? t('saving') : t(editing ? 'addresses:saveEdit' : 'addresses:saveAdd')}</button></>}>
    <form id="address-form" className="form-stack" onSubmit={(event) => void submit(event)} noValidate>
      {conflict && <div className="inline-alert inline-alert--warning" role="alert">{t('customers:conflictBody')}</div>}
      {mutationError && !conflict && <div className="inline-alert inline-alert--danger" role="alert">{t('errors:genericBody')}</div>}
      <Field label={t('addresses:receiverName')} error={errors.receiverName?.message} required><input {...register('receiverName')} autoComplete="name" /></Field>
      <Field label={t('addresses:receiverPhone')} error={errors.receiverPhone?.message} required><input {...register('receiverPhone')} type="tel" inputMode="tel" autoComplete="tel" /></Field>
      <div className="form-grid"><Field label={t('addresses:province')} error={errors.province?.message}><input {...register('province')} /></Field><Field label={t('addresses:district')} error={errors.district?.message}><input {...register('district')} /></Field><Field label={t('addresses:ward')} error={errors.ward?.message}><input {...register('ward')} /></Field></div>
      <Field label={t('addresses:addressLine')} error={errors.addressLine?.message} required><textarea {...register('addressLine')} rows={3} /></Field>
      <Field label={t('addresses:deliveryNote')} error={errors.deliveryNote?.message}><textarea {...register('deliveryNote')} rows={3} /></Field>
      <label className="switch-row"><input type="checkbox" {...register('isDefault')} disabled={address?.status === 'INACTIVE'} /><span className="switch" aria-hidden="true" /><span>{t('addresses:default')}</span></label>
      {address?.status === 'INACTIVE' && <p className="form-field__hint">{t('addresses:activeOnlyDefault')}</p>}
    </form>
  </OverlayDialog>
}
