import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { ApiError } from '../../api/client'
import { Field } from '../../components/Field'
import { OverlayDialog } from '../../components/OverlayDialog'
import { useAuth } from '../../auth/AuthProvider'
import { PERMISSION_CODES } from '../../auth/permissionCodes.generated'
import { useToast } from '../../providers/ToastProvider'
import { VietnamAddressFields } from '../locations/VietnamAddressFields'
import { toVietnamAddressPayload } from '../locations/payload'
import type { VietnamAddressValue } from '../locations/types'
import { useCreateCustomer } from './api'
import { customerSchema, type CustomerFormValues } from './schemas'

const defaults: CustomerFormValues = {
  fullName: '', phone: '', email: '', birthDate: '', customerType: 'INDIVIDUAL', source: '',
  note: '', includeAddress: false, differentReceiver: false, receiverName: '', receiverPhone: '',
  administrativeVersion: 'V2', province: '', provinceCode: '', district: '', districtCode: '',
  ward: '', wardCode: '', addressLine: '', deliveryNote: '',
}

export function QuickCustomerDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  const { branchId, hasPermission } = useAuth()
  const { notify } = useToast()
  const schema = useMemo(() => customerSchema(t), [t])
  const mutation = useCreateCustomer()
  const { register, handleSubmit, watch, reset, setError, setValue, formState: { errors } } = useForm<CustomerFormValues>({ resolver: zodResolver(schema), defaultValues: defaults })
  const includeAddress = watch('includeAddress')
  const differentReceiver = watch('differentReceiver')
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

  useEffect(() => { if (!open) reset(defaults) }, [open, reset])
  const close = () => { if (!mutation.isPending) onClose() }
  const notifyValidationError = () => notify(t('validation:fixErrors'), 'error')
  const submit = handleSubmit(async (values) => {
    try {
      await mutation.mutateAsync({
        fullName: values.fullName,
        phone: values.phone,
        customerType: values.customerType,
        note: values.note || undefined,
        branchId: branchId ?? undefined,
        initialAddress: values.includeAddress ? {
          receiverName: values.differentReceiver ? values.receiverName : values.fullName,
          receiverPhone: values.differentReceiver ? values.receiverPhone : values.phone,
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
          isDefault: true,
        } : undefined,
      })
      notify(t('customers:quickSuccess'))
      close()
    } catch (error) {
      if (error instanceof ApiError && error.problem.errorCode === 'CUSTOMER_PHONE_DUPLICATE') {
        setError('phone', { message: t('customers:duplicatePhone') }, { shouldFocus: true })
        notifyValidationError()
      } else notify(t('errors:genericBody'), 'error')
    }
  }, notifyValidationError)

  return (
    <OverlayDialog open={open} onClose={close} title={t('customers:quickAdd')} description={t('customers:quickAddDescription')} variant="drawer" footer={<>
      <button type="button" className="button button--secondary" onClick={close} disabled={mutation.isPending}>{t('cancel')}</button>
      <button type="submit" form="quick-customer-form" className="button button--primary" disabled={mutation.isPending}>{mutation.isPending ? t('saving') : t('customers:add')}</button>
    </>}>
      <form id="quick-customer-form" className="form-stack" onSubmit={(event) => void submit(event)} noValidate>
        <Field label={t('customers:fullName')} error={errors.fullName?.message} required><input {...register('fullName')} autoComplete="name" /></Field>
        <Field label={t('customers:phone')} hint={t('customers:phoneHint')} error={errors.phone?.message} required><input {...register('phone')} type="tel" inputMode="tel" autoComplete="tel" /></Field>
        <Field label={t('customers:customerType')} required><select {...register('customerType')}><option value="INDIVIDUAL">{t('individual')}</option><option value="BUSINESS">{t('business')}</option></select></Field>
        <Field label={t('customers:note')} error={errors.note?.message}><textarea {...register('note')} rows={3} /></Field>
        <label className="switch-row"><input type="checkbox" {...register('includeAddress')} /><span className="switch" aria-hidden="true" /><span>{t('customers:deliveryNeeded')}</span></label>
        {includeAddress && <div className="form-subsection">
          <VietnamAddressFields
            idPrefix="quick-customer-address"
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
            addressRequired
          />
          <label className="switch-row"><input type="checkbox" {...register('differentReceiver')} /><span className="switch" aria-hidden="true" /><span>{t('addresses:differentReceiver')}</span></label>
          {!differentReceiver && <p className="form-field__hint">{t('addresses:sameReceiverHint')}</p>}
          {differentReceiver && <>
            <Field label={t('addresses:receiverName')} error={errors.receiverName?.message} required><input {...register('receiverName')} autoComplete="name" /></Field>
            <Field label={t('addresses:receiverPhone')} error={errors.receiverPhone?.message} required><input {...register('receiverPhone')} type="tel" inputMode="tel" autoComplete="tel" /></Field>
          </>}
        </div>}
      </form>
    </OverlayDialog>
  )
}
