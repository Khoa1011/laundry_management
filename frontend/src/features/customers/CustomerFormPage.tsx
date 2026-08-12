import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Building2, MapPin, Save, UserRound } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, useBeforeUnload, useBlocker, useNavigate, useParams } from 'react-router-dom'
import { ApiError } from '../../api/client'
import type { CustomerDetail, CustomerInput, CustomerSource } from '../../api/types'
import { useAuth } from '../../auth/AuthProvider'
import { PERMISSION_CODES } from '../../auth/permissionCodes.generated'
import { ConfirmDialog } from '../../components/OverlayDialog'
import { Field } from '../../components/Field'
import { ErrorState, LoadingState, NotFoundState, PermissionDeniedState } from '../../components/States'
import { VietnamAddressFields } from '../locations/VietnamAddressFields'
import { toVietnamAddressPayload } from '../locations/payload'
import type { VietnamAddressValue } from '../locations/types'
import { useToast } from '../../providers/ToastProvider'
import { useCreateCustomer, useCustomer, useUpdateCustomer } from './api'
import { customerSchema, type CustomerFormValues } from './schemas'
import { sourceLabel } from './format'

const sources: CustomerSource[] = ['WALK_IN', 'REFERRAL', 'FACEBOOK', 'ZALO', 'GOOGLE', 'WEBSITE', 'PARTNER', 'OTHER']
const emptyValues: CustomerFormValues = {
  fullName: '', phone: '', email: '', birthDate: '', customerType: 'INDIVIDUAL', source: '',
  note: '', includeAddress: false, differentReceiver: false, receiverName: '', receiverPhone: '',
  administrativeVersion: 'V2', province: '', provinceCode: '', district: '', districtCode: '',
  ward: '', wardCode: '', addressLine: '', deliveryNote: '',
}

function valuesFromCustomer(customer: CustomerDetail): CustomerFormValues {
  return { ...emptyValues, fullName: customer.fullName, phone: customer.phone, email: customer.email ?? '', birthDate: customer.birthDate ?? '', customerType: customer.customerType, source: customer.source ?? '', note: customer.note ?? '' }
}

export function CustomerFormPage() {
  const { t } = useTranslation()
  const { customerId: rawId } = useParams()
  const customerId = rawId ? Number(rawId) : null
  const editing = customerId !== null
  const { branchId, hasPermission } = useAuth()
  const navigate = useNavigate()
  const { notify } = useToast()
  const schema = useMemo(() => customerSchema(t), [t])
  const query = useCustomer(customerId, branchId)
  const createMutation = useCreateCustomer()
  const updateMutation = useUpdateCustomer(customerId ?? 0, branchId ?? 0)
  const [conflictOpen, setConflictOpen] = useState(false)
  const allowLeave = useRef(false)
  const canUse = hasPermission(editing ? PERMISSION_CODES.CUSTOMER_UPDATE : PERMISSION_CODES.CUSTOMER_CREATE)
  const { register, handleSubmit, watch, reset, setError, setValue, formState: { errors, isDirty } } = useForm<CustomerFormValues>({ resolver: zodResolver(schema), defaultValues: emptyValues })
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
  const blocker = useBlocker(() => isDirty && !allowLeave.current)
  useBeforeUnload((event) => { if (isDirty && !allowLeave.current) event.preventDefault() })

  useEffect(() => { if (query.data) reset(valuesFromCustomer(query.data)) }, [query.data, reset])
  const pending = createMutation.isPending || updateMutation.isPending
  const notifyValidationError = () => notify(t('validation:fixErrors'), 'error')

  const submit = handleSubmit(async (values) => {
    const input: CustomerInput = {
      fullName: values.fullName,
      phone: values.phone,
      email: values.email || undefined,
      birthDate: values.birthDate || undefined,
      customerType: values.customerType,
      source: values.source || undefined,
      note: values.note || undefined,
      branchId: editing ? undefined : branchId ?? undefined,
      initialAddress: !editing && values.includeAddress ? {
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
    }
    try {
      const saved = editing
        ? await updateMutation.mutateAsync({ ...input, version: query.data?.version ?? 0 })
        : await createMutation.mutateAsync(input)
      reset(values)
      allowLeave.current = true
      notify(t(editing ? 'customers:updateSuccess' : 'customers:createSuccess'))
      navigate(`/customers/${saved.id}`, { replace: true })
    } catch (error) {
      if (error instanceof ApiError && error.problem.errorCode === 'CUSTOMER_PHONE_DUPLICATE') {
        setError('phone', { message: t('customers:duplicatePhone') }, { shouldFocus: true })
        notifyValidationError()
      } else if (error instanceof ApiError && error.problem.errorCode === 'CUSTOMER_VERSION_CONFLICT') {
        setConflictOpen(true)
      } else if (error instanceof ApiError && error.problem.fieldErrors) {
        for (const [field, messages] of Object.entries(error.problem.fieldErrors)) {
          if (field in emptyValues) setError(field as keyof CustomerFormValues, { message: messages[0] })
        }
        notifyValidationError()
      } else notify(t('errors:genericBody'), 'error')
    }
  }, notifyValidationError)

  if (!canUse) return <div className="page-container"><PermissionDeniedState /></div>
  if (editing && query.isPending) return <div className="page-container"><LoadingState /></div>
  if (editing && query.error instanceof ApiError && query.error.status === 404) return <div className="page-container"><NotFoundState customer /></div>
  if (editing && query.isError) return <div className="page-container"><ErrorState title={t('customers:detailErrorTitle')} body={t('customers:detailErrorBody')} onRetry={() => void query.refetch()} /></div>

  return <div className="page-container form-page">
    <header className="focused-page-header"><Link to={editing ? `/customers/${customerId}` : '/customers'} className="icon-button" aria-label={t('back')}><ArrowLeft size={20} /></Link><div><p className="eyebrow">{t('navigation:customers')}</p><h1>{t(editing ? 'customers:editTitle' : 'customers:createTitle')}</h1><p>{t(editing ? 'customers:editSubtitle' : 'customers:createSubtitle')}</p></div></header>
    <form id="customer-form" className="customer-form" onSubmit={(event) => void submit(event)} noValidate>
      <section className="form-section"><div className="section-heading"><span className="section-icon"><UserRound size={20} /></span><div><h2>{t('customers:basicInfo')}</h2><p>{t('customers:subtitle')}</p></div></div>
        <div className="form-grid">
          <Field label={t('customers:fullName')} error={errors.fullName?.message} required><input {...register('fullName')} autoComplete="name" placeholder={t('customers:fullNamePlaceholder')} /></Field>
          <Field label={t('customers:phone')} hint={t('customers:phoneHint')} error={errors.phone?.message} required><input {...register('phone')} type="tel" inputMode="tel" autoComplete="tel" /></Field>
          <Field label={t('customers:email')} error={errors.email?.message}><input {...register('email')} type="email" inputMode="email" autoComplete="email" placeholder={t('customers:emailPlaceholder')} /></Field>
          <Field label={t('customers:birthDate')} error={errors.birthDate?.message}><input {...register('birthDate')} type="date" max={new Date().toISOString().slice(0, 10)} /></Field>
          <Field label={t('customers:customerType')} error={errors.customerType?.message} required><select {...register('customerType')}><option value="INDIVIDUAL">{t('individual')}</option><option value="BUSINESS">{t('business')}</option></select></Field>
          <Field label={t('customers:customerSource')} error={errors.source?.message}><select {...register('source')}><option value="">{t('unknown')}</option>{sources.map((source) => <option key={source} value={source}>{sourceLabel(source, t)}</option>)}</select></Field>
          <div className="form-grid__full"><Field label={t('customers:note')} error={errors.note?.message}><textarea {...register('note')} rows={5} placeholder={t('customers:notePlaceholder')} /></Field></div>
        </div>
        {editing && query.data && <div className="readonly-metadata"><span><Building2 size={17} />{query.data.branch.name}</span><span>{t('customers:code')}: <strong>{query.data.customerCode}</strong></span><small>{t('customers:branchReadOnly')}</small></div>}
      </section>

      {!editing && (
        <section className="form-section">
          <div className="section-heading">
            <span className="section-icon"><MapPin size={20} /></span>
            <div>
              <h2>{t('customers:deliveryNeed')}</h2>
              <p>{t('addresses:deliveryNeedDescription')}</p>
            </div>
          </div>
          <label className="switch-row">
            <input type="checkbox" {...register('includeAddress')} />
            <span className="switch" aria-hidden="true" />
            <span>{t('customers:deliveryNeeded')}</span>
          </label>
          {includeAddress && (
            <div className="form-stack form-grid--address">
              <VietnamAddressFields
                idPrefix="customer-initial-address"
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
              <Field label={t('addresses:deliveryNote')} error={errors.deliveryNote?.message}>
                <textarea {...register('deliveryNote')} rows={3} />
              </Field>
              <div>
                <label className="switch-row">
                  <input type="checkbox" {...register('differentReceiver')} />
                  <span className="switch" aria-hidden="true" />
                  <span>{t('addresses:differentReceiver')}</span>
                </label>
                {!differentReceiver && <p className="form-field__hint">{t('addresses:sameReceiverHint')}</p>}
              </div>
              {differentReceiver && (
                <div className="form-grid">
                  <Field label={t('addresses:receiverName')} error={errors.receiverName?.message} required>
                    <input {...register('receiverName')} autoComplete="name" />
                  </Field>
                  <Field label={t('addresses:receiverPhone')} error={errors.receiverPhone?.message} required>
                    <input {...register('receiverPhone')} type="tel" inputMode="tel" autoComplete="tel" />
                  </Field>
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </form>
    <div className="sticky-action-bar"><button type="button" className="button button--secondary" onClick={() => navigate(editing ? `/customers/${customerId}` : '/customers')} disabled={pending}>{t('cancel')}</button><button type="submit" form="customer-form" className="button button--primary" disabled={pending}><Save size={18} />{pending ? t('saving') : t(editing ? 'customers:saveEdit' : 'customers:saveCreate')}</button></div>
    <ConfirmDialog open={blocker.state === 'blocked'} onClose={() => blocker.reset?.()} onConfirm={() => blocker.proceed?.()} title={t('unsavedTitle')} body={t('unsavedBody')} confirmLabel={t('leave')} tone="danger" />
    <ConfirmDialog open={conflictOpen} onClose={() => setConflictOpen(false)} onConfirm={() => { setConflictOpen(false); void query.refetch().then((result) => { if (result.data) reset(valuesFromCustomer(result.data)) }) }} title={t('customers:conflictTitle')} body={t('customers:conflictBody')} confirmLabel={t('reload')} />
  </div>
}
