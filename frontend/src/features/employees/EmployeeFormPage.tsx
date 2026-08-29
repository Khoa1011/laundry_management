import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, BriefcaseBusiness, Building2, KeyRound, Plus, Save, UserRound } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, useBeforeUnload, useBlocker, useNavigate, useParams } from 'react-router-dom'
import { ApiError } from '../../api/client'
import { useAuth } from '../../auth/AuthProvider'
import { PERMISSION_CODES } from '../../auth/permissionCodes.generated'
import { ConfirmDialog } from '../../components/OverlayDialog'
import { Field } from '../../components/Field'
import { ErrorState, LoadingState, PermissionDeniedState, StatePanel } from '../../components/States'
import { useToast } from '../../providers/ToastProvider'
import { VietnamAddressFields } from '../locations/VietnamAddressFields'
import { toVietnamAddressPayload } from '../locations/payload'
import type { VietnamAddressValue } from '../locations/types'
import { useCreateEmployee, useEmployee, useEmployeeAccountOptions, useEmployeeBranchOptions, useEmployeePositions, useUpdateEmployee } from './api'
import { employeePositionName } from './format'
import { employeeSchema, type EmployeeFormValues } from './schemas'
import type { EmployeeInput } from './types'

const emptyValues: EmployeeFormValues = {
  fullName: '', phone: '', email: '', birthDate: '', addressLine: '', administrativeVersion: 'V2',
  province: '', provinceCode: '', district: '', districtCode: '', ward: '', wardCode: '',
  hireDate: new Date().toISOString().slice(0, 10),
  positionId: 0, status: 'ACTIVE', linkedUserId: '',
}

export function EmployeeFormPage() {
  const { t, i18n } = useTranslation()
  const { employeeId: rawId } = useParams()
  const employeeId = rawId ? Number(rawId) : null
  const editing = employeeId !== null
  const { hasPermission } = useAuth()
  const navigate = useNavigate()
  const { notify } = useToast()
  const schema = useMemo(() => employeeSchema(t), [t])
  const query = useEmployee(employeeId)
  const positions = useEmployeePositions()
  const branchOptions = useEmployeeBranchOptions()
  const canLinkAccount = !editing && hasPermission(PERMISSION_CODES.EMPLOYEE_ACCOUNT_LINK)
  const [accountSearch, setAccountSearch] = useState('')
  const accounts = useEmployeeAccountOptions(null, accountSearch, canLinkAccount)
  const createMutation = useCreateEmployee()
  const updateMutation = useUpdateEmployee(employeeId ?? 0)
  const [selectedBranches, setSelectedBranches] = useState<number[]>([])
  const [primaryBranchId, setPrimaryBranchId] = useState<number | null>(null)
  const [branchError, setBranchError] = useState(false)
  const [conflictOpen, setConflictOpen] = useState(false)
  const allowLeave = useRef(false)
  const canUse = hasPermission(editing ? PERMISSION_CODES.EMPLOYEE_UPDATE : PERMISSION_CODES.EMPLOYEE_CREATE)
  const { register, handleSubmit, reset, setError, setValue, watch, formState: { errors, isDirty } } = useForm<EmployeeFormValues>({ resolver: zodResolver(schema), defaultValues: emptyValues })
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
  const branchDirty = !editing && selectedBranches.length > 0
  const blocker = useBlocker(() => (isDirty || branchDirty) && !allowLeave.current)
  useBeforeUnload((event) => { if ((isDirty || branchDirty) && !allowLeave.current) event.preventDefault() })

  useEffect(() => {
    if (!query.data) return
    reset({
      fullName: query.data.fullName, phone: query.data.phone ?? '', email: query.data.email ?? '',
      birthDate: query.data.birthDate ?? '', addressLine: query.data.address ?? '',
      administrativeVersion: query.data.administrativeVersion ?? '',
      province: query.data.province ?? '',
      provinceCode: query.data.provinceCode ? String(query.data.provinceCode) : '',
      district: query.data.district ?? '',
      districtCode: query.data.districtCode ? String(query.data.districtCode) : '',
      ward: query.data.ward ?? '',
      wardCode: query.data.wardCode ? String(query.data.wardCode) : '',
      hireDate: query.data.hireDate,
      positionId: query.data.position.id, status: query.data.status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE', linkedUserId: '',
    })
  }, [query.data, reset])

  const toggleBranch = (branchId: number, checked: boolean) => {
    setBranchError(false)
    setSelectedBranches((current) => checked ? [...current, branchId] : current.filter((id) => id !== branchId))
    if (!checked && primaryBranchId === branchId) setPrimaryBranchId(null)
    if (checked && primaryBranchId === null) setPrimaryBranchId(branchId)
  }

  const notifyValidationError = () => notify(t('validation:fixErrors'), 'error')
  const submit = handleSubmit(async (values) => {
    if (!editing && (selectedBranches.length === 0 || primaryBranchId === null || !selectedBranches.includes(primaryBranchId))) {
      setBranchError(true)
      notifyValidationError()
      document.getElementById('employee-branch-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    try {
      const base = {
        fullName: values.fullName, phone: values.phone || undefined, email: values.email || undefined,
        birthDate: values.birthDate || undefined,
        address: values.addressLine || undefined,
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
        hireDate: values.hireDate,
      }
      const saved = editing
        ? await updateMutation.mutateAsync({ ...base, version: query.data?.version ?? 0 })
        : await createMutation.mutateAsync({
          ...base, positionId: Number(values.positionId), status: values.status,
          branchIds: selectedBranches, primaryBranchId: primaryBranchId as number,
          linkedUserId: values.linkedUserId === '' ? undefined : Number(values.linkedUserId),
        } satisfies EmployeeInput)
      reset(values)
      allowLeave.current = true
      notify(t(editing ? 'employee:updateSuccess' : 'employee:createSuccess'))
      navigate(`/employees/${saved.id}`, { replace: true })
    } catch (error) {
      if (error instanceof ApiError && error.problem.errorCode === 'EMPLOYEE_VERSION_CONFLICT') setConflictOpen(true)
      else if (error instanceof ApiError && error.problem.fieldErrors) {
        for (const [field, messages] of Object.entries(error.problem.fieldErrors)) {
          const formField = field === 'address' ? 'addressLine' : field
          if (formField in emptyValues) {
            setError(formField as keyof EmployeeFormValues, { message: messages[0] }, { shouldFocus: true })
          }
        }
        notifyValidationError()
      } else notify(t('errors:genericBody'), 'error')
    }
  }, notifyValidationError)

  const pending = createMutation.isPending || updateMutation.isPending
  if (!canUse) return <div className="page-container"><PermissionDeniedState /></div>
  if (editing && query.isPending) return <div className="page-container"><LoadingState /></div>
  if (editing && query.error instanceof ApiError && query.error.status === 404) return <div className="page-container"><StatePanel title={t('employee:notFoundTitle')} body={t('employee:notFoundBody')} /></div>
  if (editing && query.isError) return <div className="page-container"><ErrorState title={t('employee:detailErrorTitle')} body={t('employee:detailErrorBody')} onRetry={() => void query.refetch()} /></div>

  return <div className="page-container form-page employee-form-page">
    <header className="focused-page-header"><Link to={editing ? `/employees/${employeeId}` : '/employees'} className="icon-button" aria-label={t('back')}><ArrowLeft size={20} /></Link><div><p className="eyebrow">{t('employee:title')}</p><h1>{t(editing ? 'employee:editTitle' : 'employee:createTitle')}</h1><p>{t(editing ? 'employee:editSubtitle' : 'employee:createSubtitle')}</p></div></header>
    <form id="employee-form" className="employee-form" onSubmit={(event) => void submit(event)} noValidate>
      <section className="form-section"><div className="section-heading"><span className="section-icon"><UserRound size={20} /></span><div><h2>{t('employee:basicInfo')}</h2><p>{t('employee:autoCode')}</p></div></div><div className="form-grid">
        <Field label={t('employee:fullName')} error={errors.fullName?.message} required><input {...register('fullName')} autoComplete="name" /></Field>
        <Field label={t('employee:phone')} error={errors.phone?.message}><input {...register('phone')} type="tel" inputMode="tel" autoComplete="tel" /></Field>
        <Field label={t('employee:email')} error={errors.email?.message}><input {...register('email')} type="email" inputMode="email" autoComplete="email" /></Field>
        <Field label={t('employee:birthDate')} error={errors.birthDate?.message}><input {...register('birthDate')} type="date" max={new Date().toISOString().slice(0, 10)} /></Field>
        <div className="form-grid__full">
          <VietnamAddressFields
            key={`${editing}-${query.data?.id ?? 'new'}`}
            idPrefix={`employee-address-${query.data?.id ?? 'new'}`}
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
          />
        </div>
      </div></section>

      <section className="form-section"><div className="section-heading"><span className="section-icon"><BriefcaseBusiness size={20} /></span><div><h2>{t('employee:workInfo')}</h2><p>{editing ? t('employee:editSubtitle') : t('employee:createSubtitle')}</p></div></div><div className="form-grid">
        <Field label={t('employee:hireDate')} error={errors.hireDate?.message} required><input {...register('hireDate')} type="date" /></Field>
        {editing && query.data ? <Field label={t('employee:position')}><input value={employeePositionName(query.data.position, i18n.language)} readOnly /></Field> : <Field label={t('employee:position')} error={errors.positionId?.message} required><select {...register('positionId', { valueAsNumber: true })}><option value={0}>{t('employee:allPositions')}</option>{positions.data?.map((position) => <option key={position.id} value={position.id}>{employeePositionName(position, i18n.language)}</option>)}</select></Field>}
        {!editing && <Field label={t('status')} error={errors.status?.message} required><select {...register('status')}><option value="ACTIVE">{t('employee:active')}</option><option value="INACTIVE">{t('employee:inactive')}</option></select></Field>}
      </div></section>

      {!editing && <section id="employee-branch-section" className="form-section"><div className="section-heading"><span className="section-icon"><Building2 size={20} /></span><div><h2>{t('employee:branches')}</h2><p>{t('employee:validation.branches')}</p></div></div>{branchOptions.isPending ? <LoadingState rows={2} /> : branchOptions.isError ? <ErrorState title={t('employee:loadErrorTitle')} body={t('employee:loadErrorBody')} onRetry={() => void branchOptions.refetch()} /> : <div className="employee-branch-picker">{branchOptions.data?.map((branch) => { const selected = selectedBranches.includes(branch.id); return <div className={`employee-branch-option${selected ? ' employee-branch-option--selected' : ''}`} key={branch.id}><label><input type="checkbox" checked={selected} onChange={(event) => toggleBranch(branch.id, event.target.checked)} /><span><strong>{branch.name}</strong><small>{branch.code}</small></span></label><label className="employee-primary-choice"><input type="radio" name="primaryBranch" checked={primaryBranchId === branch.id} disabled={!selected} onChange={() => setPrimaryBranchId(branch.id)} />{t('employee:primaryBranch')}</label></div> })}</div>}{branchError && <p className="field-error" role="alert">{t('employee:validation.branches')}</p>}</section>}

      {!editing && canLinkAccount && <section className="form-section"><div className="section-heading"><span className="section-icon"><KeyRound size={20} /></span><div><h2>{t('employee:accountInfo')}</h2><p>{t('employee:accountScopeWarning')}</p></div></div><div className="form-stack"><Field label={t('employee:accountSearch')}><input value={accountSearch} onChange={(event) => setAccountSearch(event.target.value)} /></Field><Field label={t('employee:account')} error={errors.linkedUserId?.message}><select {...register('linkedUserId')}><option value="">{t('employee:noAccount')}</option>{accounts.data?.items.map((account) => <option key={account.id} value={account.id}>{account.displayName} · {account.username}</option>)}</select></Field></div></section>}
    </form>
    <div className="sticky-action-bar"><button type="button" className="button button--secondary" onClick={() => navigate(editing ? `/employees/${employeeId}` : '/employees')} disabled={pending}>{t('cancel')}</button><button type="submit" form="employee-form" className={`button ${editing ? 'button--primary' : 'button--create'}`} disabled={pending}>{editing ? <Save size={18} aria-hidden="true" /> : <Plus size={18} aria-hidden="true" />}{pending ? t('saving') : t(editing ? 'employee:saveEdit' : 'employee:saveCreate')}</button></div>
    <ConfirmDialog open={blocker.state === 'blocked'} onClose={() => blocker.reset?.()} onConfirm={() => blocker.proceed?.()} title={t('unsavedTitle')} body={t('unsavedBody')} confirmLabel={t('leave')} tone="danger" />
    <ConfirmDialog open={conflictOpen} onClose={() => setConflictOpen(false)} onConfirm={() => { setConflictOpen(false); void query.refetch() }} title={t('customers:conflictTitle')} body={t('customers:conflictBody')} confirmLabel={t('reload')} />
  </div>
}
