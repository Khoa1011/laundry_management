import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { ApiError } from '../../api/client'
import { OverlayDialog } from '../../components/OverlayDialog'
import { useAuth } from '../../auth/AuthProvider'
import { useToast } from '../../providers/ToastProvider'
import { useCreateCustomer } from './api'
import { customerSchema, type CustomerFormValues } from './schemas'

const defaults: CustomerFormValues = { fullName: '', phone: '', email: '', birthDate: '', customerType: 'INDIVIDUAL', source: '', note: '', includeAddress: false, receiverName: '', receiverPhone: '', province: '', district: '', ward: '', addressLine: '', deliveryNote: '' }

export function QuickCustomerDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  const { branchId } = useAuth()
  const { notify } = useToast()
  const schema = useMemo(() => customerSchema(t), [t])
  const mutation = useCreateCustomer()
  const { register, handleSubmit, watch, reset, setError, formState: { errors } } = useForm<CustomerFormValues>({ resolver: zodResolver(schema), defaultValues: defaults })
  const includeAddress = watch('includeAddress')

  useEffect(() => { if (!open) reset(defaults) }, [open, reset])
  const close = () => { if (!mutation.isPending) onClose() }
  const submit = handleSubmit(async (values) => {
    try {
      await mutation.mutateAsync({
        fullName: values.fullName,
        phone: values.phone,
        customerType: values.customerType,
        note: values.note || undefined,
        branchId: branchId ?? undefined,
        initialAddress: values.includeAddress ? {
          receiverName: values.receiverName || values.fullName,
          receiverPhone: values.receiverPhone || values.phone,
          addressLine: values.addressLine,
          province: values.province || undefined,
          district: values.district || undefined,
          ward: values.ward || undefined,
          deliveryNote: values.deliveryNote || undefined,
          isDefault: true,
        } : undefined,
      })
      notify(t('customers:quickSuccess'))
      close()
    } catch (error) {
      if (error instanceof ApiError && error.problem.errorCode === 'CUSTOMER_PHONE_DUPLICATE') {
        setError('phone', { message: t('customers:duplicatePhone') }, { shouldFocus: true })
      }
    }
  })

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
        <label className="switch-row"><input type="checkbox" {...register('includeAddress')} /><span className="switch" aria-hidden="true" /><span>{t('customers:initialAddress')}</span></label>
        {includeAddress && <div className="form-subsection">
          <Field label={t('addresses:receiverName')} error={errors.receiverName?.message}><input {...register('receiverName')} /></Field>
          <Field label={t('addresses:receiverPhone')} error={errors.receiverPhone?.message}><input {...register('receiverPhone')} type="tel" inputMode="tel" /></Field>
          <Field label={t('addresses:addressLine')} error={errors.addressLine?.message} required><textarea {...register('addressLine')} rows={3} /></Field>
        </div>}
        {mutation.isError && !(mutation.error instanceof ApiError && mutation.error.problem.errorCode === 'CUSTOMER_PHONE_DUPLICATE') && <div className="inline-alert inline-alert--danger" role="alert">{t('errors:genericBody')}</div>}
      </form>
    </OverlayDialog>
  )
}

export function Field({ label, required, hint, error, children }: { label: string; required?: boolean; hint?: string; error?: string; children: React.ReactElement }) {
  return <label className={`form-field${error ? ' form-field--error' : ''}`}><span className="form-field__label">{label}{required && <span aria-hidden="true"> *</span>}</span>{children}{hint && !error && <span className="form-field__hint">{hint}</span>}{error && <span className="form-field__error" role="alert">{error}</span>}</label>
}
