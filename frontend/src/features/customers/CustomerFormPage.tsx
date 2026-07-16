import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Building2, MapPin, Save, UserRound } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, useBeforeUnload, useBlocker, useNavigate, useParams } from 'react-router-dom'
import { ApiError } from '../../api/client'
import type { CustomerDetail, CustomerInput, CustomerSource } from '../../api/types'
import { useAuth } from '../../auth/AuthProvider'
import { ConfirmDialog } from '../../components/OverlayDialog'
import { ErrorState, LoadingState, NotFoundState, PermissionDeniedState } from '../../components/States'
import { useToast } from '../../providers/ToastProvider'
import { Field } from './QuickCustomerDialog'
import { useCreateCustomer, useCustomer, useUpdateCustomer } from './api'
import { customerSchema, type CustomerFormValues } from './schemas'
import { sourceLabel } from './format'

const sources: CustomerSource[] = ['WALK_IN', 'REFERRAL', 'FACEBOOK', 'ZALO', 'GOOGLE', 'WEBSITE', 'PARTNER', 'OTHER']
const emptyValues: CustomerFormValues = { fullName: '', phone: '', email: '', birthDate: '', customerType: 'INDIVIDUAL', source: '', note: '', includeAddress: false, receiverName: '', receiverPhone: '', province: '', district: '', ward: '', addressLine: '', deliveryNote: '' }

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
  const canUse = hasPermission(editing ? 'customer.update' : 'customer.create')
  const { register, handleSubmit, watch, reset, setError, formState: { errors, isDirty } } = useForm<CustomerFormValues>({ resolver: zodResolver(schema), defaultValues: emptyValues })
  const includeAddress = watch('includeAddress')
  const blocker = useBlocker(() => isDirty && !allowLeave.current)
  useBeforeUnload((event) => { if (isDirty && !allowLeave.current) event.preventDefault() })

  useEffect(() => { if (query.data) reset(valuesFromCustomer(query.data)) }, [query.data, reset])
  const pending = createMutation.isPending || updateMutation.isPending

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
        receiverName: values.receiverName,
        receiverPhone: values.receiverPhone,
        province: values.province || undefined,
        district: values.district || undefined,
        ward: values.ward || undefined,
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
      } else if (error instanceof ApiError && error.problem.errorCode === 'CUSTOMER_VERSION_CONFLICT') {
        setConflictOpen(true)
      } else if (error instanceof ApiError && error.problem.fieldErrors) {
        for (const [field, messages] of Object.entries(error.problem.fieldErrors)) {
          if (field in emptyValues) setError(field as keyof CustomerFormValues, { message: messages[0] })
        }
      }
    }
  })

  if (!canUse) return <div className="page-container"><PermissionDeniedState /></div>
  if (editing && query.isPending) return <div className="page-container"><LoadingState /></div>
  if (editing && query.error instanceof ApiError && query.error.status === 404) return <div className="page-container"><NotFoundState customer /></div>
  if (editing && query.isError) return <div className="page-container"><ErrorState title={t('customers:detailErrorTitle')} body={t('customers:detailErrorBody')} onRetry={() => void query.refetch()} /></div>

  return <div className="page-container form-page">
    <header className="focused-page-header"><Link to={editing ? `/customers/${customerId}` : '/customers'} className="icon-button" aria-label={t('back')}><ArrowLeft size={20} /></Link><div><p className="eyebrow">{t('navigation:customers')}</p><h1>{t(editing ? 'customers:editTitle' : 'customers:createTitle')}</h1><p>{t(editing ? 'customers:editSubtitle' : 'customers:createSubtitle')}</p></div></header>
    {Object.keys(errors).length > 0 && <div className="error-summary" role="alert"><strong>{t('validation:fixErrors')}</strong></div>}
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

      {!editing && <section className="form-section"><div className="section-heading"><span className="section-icon"><MapPin size={20} /></span><div><h2>{t('customers:initialAddress')}</h2><p>{t('addresses:formDescription')}</p></div></div><label className="switch-row"><input type="checkbox" {...register('includeAddress')} /><span className="switch" aria-hidden="true" /><span>{t('customers:initialAddress')}</span></label>{includeAddress && <div className="form-grid form-grid--address"><Field label={t('addresses:receiverName')} error={errors.receiverName?.message} required><input {...register('receiverName')} autoComplete="name" /></Field><Field label={t('addresses:receiverPhone')} error={errors.receiverPhone?.message} required><input {...register('receiverPhone')} type="tel" inputMode="tel" /></Field><Field label={t('addresses:province')} error={errors.province?.message}><input {...register('province')} /></Field><Field label={t('addresses:district')} error={errors.district?.message}><input {...register('district')} /></Field><Field label={t('addresses:ward')} error={errors.ward?.message}><input {...register('ward')} /></Field><div className="form-grid__full"><Field label={t('addresses:addressLine')} error={errors.addressLine?.message} required><textarea {...register('addressLine')} rows={3} /></Field></div><div className="form-grid__full"><Field label={t('addresses:deliveryNote')} error={errors.deliveryNote?.message}><textarea {...register('deliveryNote')} rows={3} /></Field></div></div>}</section>}
      {(createMutation.isError || updateMutation.isError) && !errors.phone && !conflictOpen && <div className="inline-alert inline-alert--danger" role="alert">{t('errors:genericBody')}</div>}
    </form>
    <div className="sticky-action-bar"><button type="button" className="button button--secondary" onClick={() => navigate(editing ? `/customers/${customerId}` : '/customers')} disabled={pending}>{t('cancel')}</button><button type="submit" form="customer-form" className="button button--primary" disabled={pending}><Save size={18} />{pending ? t('saving') : t(editing ? 'customers:saveEdit' : 'customers:saveCreate')}</button></div>
    <ConfirmDialog open={blocker.state === 'blocked'} onClose={() => blocker.reset?.()} onConfirm={() => blocker.proceed?.()} title={t('unsavedTitle')} body={t('unsavedBody')} confirmLabel={t('leave')} tone="danger" />
    <ConfirmDialog open={conflictOpen} onClose={() => setConflictOpen(false)} onConfirm={() => { setConflictOpen(false); void query.refetch().then((result) => { if (result.data) reset(valuesFromCustomer(result.data)) }) }} title={t('customers:conflictTitle')} body={t('customers:conflictBody')} confirmLabel={t('reload')} />
  </div>
}
