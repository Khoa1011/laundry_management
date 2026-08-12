import { AlertTriangle, Database, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Field } from '../../components/Field'
import { Button } from '../../components/ui/Button'
import { SearchableSelect } from '../../components/ui/SearchableSelect'
import { useVietnamDistricts, useVietnamProvinces, useVietnamWards } from './api'
import type {
  AdministrativeDivision,
  VietnamAddressErrors,
  VietnamAddressValue,
} from './types'

interface VietnamAddressFieldsProps {
  value: VietnamAddressValue
  errors?: VietnamAddressErrors
  onChange: (patch: Partial<VietnamAddressValue>) => void
  canUseCatalog: boolean
  disabled?: boolean
  addressRequired?: boolean
  idPrefix: string
}

export function VietnamAddressFields({
  value,
  errors = {},
  onChange,
  canUseCatalog,
  disabled = false,
  addressRequired = false,
  idPrefix,
}: VietnamAddressFieldsProps) {
  const { t } = useTranslation()
  const [manualMode, setManualMode] = useState(
    value.administrativeVersion === ''
      || Boolean(value.province && !value.provinceCode)
      || Boolean(value.district && !value.districtCode)
      || Boolean(value.ward && !value.wardCode),
  )
  const catalogEnabled = canUseCatalog && !manualMode && value.administrativeVersion !== ''
  const provinces = useVietnamProvinces(value.administrativeVersion, catalogEnabled)
  const districts = useVietnamDistricts(
    value.provinceCode,
    catalogEnabled && value.administrativeVersion === 'V1',
  )
  const wards = useVietnamWards(
    value.administrativeVersion,
    value.provinceCode,
    value.districtCode,
    catalogEnabled,
  )
  const districtReady = value.administrativeVersion === 'V1' && Boolean(value.provinceCode)
  const wardReady = value.administrativeVersion === 'V1'
    ? Boolean(value.districtCode)
    : Boolean(value.provinceCode)
  const catalogError = provinces.isError || districts.isError || wards.isError
  const manual = !canUseCatalog || manualMode || catalogError || value.administrativeVersion === ''

  const selectDivision = (
    options: AdministrativeDivision[] | undefined,
    selectedCode: string,
    nameField: 'province' | 'district' | 'ward',
    codeField: 'provinceCode' | 'districtCode' | 'wardCode',
    dependentPatch: Partial<VietnamAddressValue>,
  ) => {
    const selected = options?.find((item) => String(item.code) === selectedCode)
    onChange({
      [nameField]: selected?.name ?? '',
      [codeField]: selected ? String(selected.code) : '',
      ...dependentPatch,
    })
  }

  const searchableOptions = (options: AdministrativeDivision[] | undefined) =>
    options?.map((option) => ({ value: String(option.code), label: option.name })) ?? []

  const switchVersion = (legacy: boolean) => {
    setManualMode(false)
    onChange({
      administrativeVersion: legacy ? 'V1' : 'V2',
      province: '',
      provinceCode: '',
      district: '',
      districtCode: '',
      ward: '',
      wardCode: '',
    })
  }

  const enterManualMode = () => {
    setManualMode(true)
    onChange({
      administrativeVersion: '',
      provinceCode: '',
      districtCode: '',
      wardCode: '',
    })
  }

  const useCurrentCatalog = () => {
    setManualMode(false)
    onChange({
      administrativeVersion: 'V2',
      province: '',
      provinceCode: '',
      district: '',
      districtCode: '',
      ward: '',
      wardCode: '',
    })
  }

  const retryCatalog = async () => {
    setManualMode(false)
    await Promise.all([
      provinces.refetch(),
      value.administrativeVersion === 'V1' && value.provinceCode ? districts.refetch() : undefined,
      (value.administrativeVersion === 'V2' && value.provinceCode)
        || (value.administrativeVersion === 'V1' && value.districtCode)
        ? wards.refetch()
        : undefined,
    ])
  }

  return (
    <div className="vietnam-address-fields">
      {!manual && (
        <div className="vietnam-address-fields__mode">
          <label className="switch-row" htmlFor={`${idPrefix}-legacy`}>
            <input
              id={`${idPrefix}-legacy`}
              type="checkbox"
              checked={value.administrativeVersion === 'V1'}
              onChange={(event) => switchVersion(event.target.checked)}
              disabled={disabled}
            />
            <span className="switch" aria-hidden="true" />
            <span>{t('addresses:legacyToggle')}</span>
          </label>
          <p className="form-field__hint">
            {t(value.administrativeVersion === 'V1'
              ? 'addresses:legacyHint'
              : 'addresses:currentHint')}
          </p>
        </div>
      )}

      {catalogError && (
        <div className="vietnam-address-fields__notice" role="status">
          <AlertTriangle size={18} aria-hidden="true" />
          <span>{t('addresses:catalogError')}</span>
          <Button type="button" variant="outline" size="sm" onClick={() => void retryCatalog()}>
            <RefreshCw size={16} />
            {t('retry')}
          </Button>
        </div>
      )}

      {manual ? (
        <div className="vietnam-address-fields__manual">
          <div className="vietnam-address-fields__manual-heading">
            <span><Database size={17} aria-hidden="true" />{t('addresses:manualMode')}</span>
            {canUseCatalog && !catalogError && (
              <Button type="button" variant="outline" size="sm" onClick={useCurrentCatalog}>
                {t('addresses:useCatalog')}
              </Button>
            )}
          </div>
          <div className="vietnam-address-fields__grid">
            <Field label={t('addresses:province')} error={errors.province}>
              <input
                value={value.province}
                onChange={(event) => {
                  enterManualMode()
                  onChange({ province: event.target.value })
                }}
                disabled={disabled}
                autoComplete="address-level1"
              />
            </Field>
            <Field label={t('addresses:district')} error={errors.district}>
              <input
                value={value.district}
                onChange={(event) => {
                  enterManualMode()
                  onChange({ district: event.target.value })
                }}
                disabled={disabled}
                autoComplete="address-level2"
              />
            </Field>
            <Field label={t('addresses:ward')} error={errors.ward}>
              <input
                value={value.ward}
                onChange={(event) => {
                  enterManualMode()
                  onChange({ ward: event.target.value })
                }}
                disabled={disabled}
                autoComplete="address-level3"
              />
            </Field>
          </div>
        </div>
      ) : (
        <div className="vietnam-address-fields__grid">
          <Field label={t('addresses:province')} error={errors.provinceCode}>
            <SearchableSelect
              value={value.provinceCode}
              options={searchableOptions(provinces.data)}
              placeholder={t('addresses:selectProvince')}
              selectAriaLabel={t('addresses:province')}
              searchPlaceholder={t('addresses:searchProvince')}
              noResultsText={t('addresses:noSearchResults')}
              loading={provinces.isPending}
              loadingText={t('addresses:catalogLoading')}
              onChange={(selectedCode) => selectDivision(
                provinces.data,
                selectedCode,
                'province',
                'provinceCode',
                { district: '', districtCode: '', ward: '', wardCode: '' },
              )}
              disabled={disabled || provinces.isPending}
              autoComplete="address-level1"
            />
          </Field>

          {value.administrativeVersion === 'V1' && (
            <Field label={t('addresses:district')} error={errors.districtCode}>
              <SearchableSelect
                value={value.districtCode}
                options={searchableOptions(districts.data)}
                placeholder={t('addresses:selectDistrict')}
                selectAriaLabel={t('addresses:district')}
                searchPlaceholder={t('addresses:searchDistrict')}
                noResultsText={t('addresses:noSearchResults')}
                loading={districtReady && districts.isPending}
                loadingText={t('addresses:catalogLoading')}
                onChange={(selectedCode) => selectDivision(
                  districts.data,
                  selectedCode,
                  'district',
                  'districtCode',
                  { ward: '', wardCode: '' },
                )}
                disabled={disabled || !districtReady || districts.isPending}
                autoComplete="address-level2"
              />
            </Field>
          )}

          <Field label={t('addresses:ward')} error={errors.wardCode}>
            <SearchableSelect
              value={value.wardCode}
              options={searchableOptions(wards.data)}
              placeholder={t('addresses:selectWard')}
              selectAriaLabel={t('addresses:ward')}
              searchPlaceholder={t('addresses:searchWard')}
              noResultsText={t('addresses:noSearchResults')}
              loading={wardReady && wards.isPending}
              loadingText={t('addresses:catalogLoading')}
              onChange={(selectedCode) => selectDivision(
                wards.data,
                selectedCode,
                'ward',
                'wardCode',
                {},
              )}
              disabled={
                disabled
                || !wardReady
                || wards.isPending
              }
              autoComplete="address-level3"
            />
          </Field>
        </div>
      )}

      {!manual && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="vietnam-address-fields__manual-action"
          onClick={enterManualMode}
        >
          {t('addresses:enterManually')}
        </Button>
      )}

      <Field label={t('addresses:addressLine')} error={errors.addressLine} required={addressRequired}>
        <textarea
          value={value.addressLine}
          onChange={(event) => onChange({ addressLine: event.target.value })}
          rows={3}
          disabled={disabled}
          autoComplete="street-address"
          placeholder={t('addresses:addressLinePlaceholder')}
        />
      </Field>
    </div>
  )
}
