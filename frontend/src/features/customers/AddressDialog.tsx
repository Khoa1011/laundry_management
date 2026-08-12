import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { ApiError } from '../../api/client'
import type { CustomerAddress } from '../../api/types'
import { useAuth } from '../../auth/AuthProvider'
import { PERMISSION_CODES } from '../../auth/permissionCodes.generated'
import { Field } from '../../components/Field'
import { OverlayDialog } from '../../components/OverlayDialog'
import { useToast } from '../../providers/ToastProvider'
import { VietnamAddressFields } from '../locations/VietnamAddressFields'
import { toVietnamAddressPayload } from '../locations/payload'
import type { VietnamAddressValue } from '../locations/types'
import { useCreateAddress, useUpdateAddress } from './api'
import { addressSchema, type AddressFormValues } from './schemas'

const emptyAddress: AddressFormValues = {
  receiverName: '', receiverPhone: '', administrativeVersion: 'V2', province: '', provinceCode: '',
  district: '', districtCode: '', ward: '', wardCode: '', addressLine: '', deliveryNote: '',
  isDefault: false,
}

export function AddressDialog({ open, onClose, customerId, branchId, address }: { open: boolean; onClose: () => void; customerId: number; branchId: number; address?: CustomerAddress | null }) {
  const { t } = useTranslation()
  const { hasPermission } = useAuth()
  const { notify } = useToast()
  const schema = useMemo(() => addressSchema(t), [t])
  const createMutation = useCreateAddress(customerId, branchId)
  const updateMutation = useUpdateAddress(customerId, branchId, address?.id ?? 0)
  const { register, handleSubmit, reset, setError, setValue, watch, formState: { errors } } = useForm<AddressFormValues>({ resolver: zodResolver(schema), defaultValues: emptyAddress })
  const editing = Boolean(address)
  const pending = createMutation.isPending || updateMutation.isPending
  const addressValue: VietnamAddressValue = {
    administrativeVersion: watch('administrativeVersion'),
    province: watch('province'),
    provinceCode: watch('provinceCode'),
    district: watch('district'),
    districtCode: watch('districtCode'),
    ward: watch('ward'),
    wardCode: watch('wardCode'),
    addressLine: watch('addressLine'),
  }
  const applyAddressPatch = (patch: Partial<VietnamAddressValue>) => {
    const options = { shouldDirty: true, shouldValidate: true }
    if (patch.administrativeVersion !== undefined) setValue('administrativeVersion', patch.administrativeVersion, options)
    if (patch.province !== undefined) setValue('province', patch.province, options)
    if (patch.provinceCode !== undefined) setValue('provinceCode', patch.provinceCode, options)
    if (patch.district !== undefined) setValue('district', patch.district, options)
    if (patch.districtCode !== undefined) setValue('districtCode', patch.districtCode, options)
    if (patch.ward !== undefined) setValue('ward', patch.ward, options)
    if (patch.wardCode !== undefined) setValue('wardCode', patch.wardCode, options)
    if (patch.addressLine !== undefined) setValue('addressLine', patch.addressLine, options)
  }

  useEffect(() => {
    if (!open) return
    reset(address ? {
      receiverName: address.receiverName,
      receiverPhone: address.receiverPhone,
      administrativeVersion: address.administrativeVersion ?? '',
      province: address.province ?? '',
      provinceCode: address.provinceCode ? String(address.provinceCode) : '',
      district: address.district ?? '',
      districtCode: address.districtCode ? String(address.districtCode) : '',
      ward: address.ward ?? '',
      wardCode: address.wardCode ? String(address.wardCode) : '',
      addressLine: address.addressLine,
      deliveryNote: address.deliveryNote ?? '',
      isDefault: address.isDefault,
    } : emptyAddress)
  }, [open, address, reset])

  const notifyValidationError = () => notify(t('validation:fixErrors'), 'error')
  const submit = handleSubmit(async (values) => {
    try {
      const input = {
        receiverName: values.receiverName,
        receiverPhone: values.receiverPhone,
        ...toVietnamAddressPayload({
          administrativeVersion: values.administrativeVersion,
          province: values.province,
          provinceCode: values.provinceCode,
          district: values.district,
          districtCode: values.districtCode,
          ward: values.ward,
          wardCode: values.wardCode,
          addressLine: values.addressLine,
        }),
        addressLine: values.addressLine,
        deliveryNote: values.deliveryNote || undefined,
        isDefault: values.isDefault,
      }
      if (address) await updateMutation.mutateAsync({ ...input, version: address.version })
      else await createMutation.mutateAsync(input)
      notify(t(address ? 'addresses:updateSuccess' : 'addresses:addSuccess'))
      onClose()
    } catch (error) {
      if (error instanceof ApiError && error.problem.fieldErrors) {
        Object.entries(error.problem.fieldErrors).forEach(([field, messages]) => setError(field as keyof AddressFormValues, { message: messages[0] }))
        notifyValidationError()
      } else if (!(error instanceof ApiError && error.problem.errorCode === 'CUSTOMER_VERSION_CONFLICT')) notify(t('errors:genericBody'), 'error')
    }
  }, notifyValidationError)
  const mutationError = createMutation.error ?? updateMutation.error
  const conflict = mutationError instanceof ApiError && mutationError.problem.errorCode === 'CUSTOMER_VERSION_CONFLICT'

  return <OverlayDialog open={open} onClose={() => !pending && onClose()} title={t(editing ? 'addresses:editTitle' : 'addresses:addTitle')} description={t('addresses:formDescription')} variant="drawer" footer={<><button type="button" className="button button--secondary" onClick={onClose} disabled={pending}>{t('cancel')}</button><button type="submit" form="address-form" className="button button--primary" disabled={pending}>{pending ? t('saving') : t(editing ? 'addresses:saveEdit' : 'addresses:saveAdd')}</button></>}>
    <form id="address-form" className="form-stack" onSubmit={(event) => void submit(event)} noValidate>
      {conflict && <div className="inline-alert inline-alert--warning" role="alert">{t('customers:conflictBody')}</div>}
      <Field label={t('addresses:receiverName')} error={errors.receiverName?.message} required><input {...register('receiverName')} autoComplete="name" /></Field>
      <Field label={t('addresses:receiverPhone')} error={errors.receiverPhone?.message} required><input {...register('receiverPhone')} type="tel" inputMode="tel" autoComplete="tel" /></Field>
      <VietnamAddressFields
        key={`${open}-${address?.id ?? 'new'}`}
        idPrefix={`customer-address-${address?.id ?? 'new'}`}
        value={addressValue}
        errors={{
          province: errors.province?.message,
          provinceCode: errors.provinceCode?.message,
          district: errors.district?.message,
          districtCode: errors.districtCode?.message,
          ward: errors.ward?.message,
          wardCode: errors.wardCode?.message,
          addressLine: errors.addressLine?.message,
        }}
        onChange={applyAddressPatch}
        canUseCatalog={hasPermission(PERMISSION_CODES.LOCATION_READ)}
        disabled={pending}
        addressRequired
      />
      <Field label={t('addresses:deliveryNote')} error={errors.deliveryNote?.message}><textarea {...register('deliveryNote')} rows={3} /></Field>
      <label className="switch-row"><input type="checkbox" {...register('isDefault')} disabled={address?.status === 'INACTIVE'} /><span className="switch" aria-hidden="true" /><span>{t('addresses:default')}</span></label>
      {address?.status === 'INACTIVE' && <p className="form-field__hint">{t('addresses:activeOnlyDefault')}</p>}
    </form>
  </OverlayDialog>
}
