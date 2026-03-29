'use client'

import { memo, useMemo } from 'react'
import { VI } from '@/lib/i18n/vietnamese'

export interface FilterBarProps {
  provinces?: string[]
  districts?: string[]
  clinicTypes?: string[]
  selectedProvince?: string
  selectedDistrict?: string
  selectedClinicType?: string
  selectedYear?: number
  selectedMonth?: number
  searchValue?: string
  onProvinceChange?: (value: string) => void
  onDistrictChange?: (value: string) => void
  onClinicTypeChange?: (value: string) => void
  onYearChange?: (value: number) => void
  onMonthChange?: (value: number) => void
  onSearchChange?: (value: string) => void
  showProvince?: boolean
  showDistrict?: boolean
  showClinicType?: boolean
  showDate?: boolean
  showSearch?: boolean
}

const selectClasses =
  'bg-gray-700 text-white border border-gray-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-teal-500'

export const FilterBar = memo(function FilterBar({
  provinces = [],
  districts = [],
  clinicTypes = [],
  selectedProvince = '',
  selectedDistrict = '',
  selectedClinicType = '',
  selectedYear,
  selectedMonth,
  searchValue = '',
  onProvinceChange,
  onDistrictChange,
  onClinicTypeChange,
  onYearChange,
  onMonthChange,
  onSearchChange,
  showProvince = false,
  showDistrict = false,
  showClinicType = false,
  showDate = false,
  showSearch = false,
}: FilterBarProps) {
  const currentYear = new Date().getFullYear()
  const years = useMemo(() => [currentYear - 2, currentYear - 1, currentYear], [currentYear])

  return (
    <div>
      <div className="rounded-lg border border-gray-700 bg-gray-800 p-3 flex flex-wrap items-center gap-3">
        {showProvince && (
          <select
            className={selectClasses}
            value={selectedProvince}
            onChange={(e) => onProvinceChange?.(e.target.value)}
          >
            <option value="">{VI.filter.allProvinces}</option>
            {provinces.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        )}

        {showDistrict && (
          <select
            className={selectClasses}
            value={selectedDistrict}
            onChange={(e) => onDistrictChange?.(e.target.value)}
          >
            <option value="">{VI.filter.allDistricts}</option>
            {districts.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        )}

        {showClinicType && (
          <select
            className={selectClasses}
            value={selectedClinicType}
            onChange={(e) => onClinicTypeChange?.(e.target.value)}
          >
            <option value="">{VI.filter.allClinicTypes}</option>
            {clinicTypes.map((ct) => (
              <option key={ct} value={ct}>
                {ct}
              </option>
            ))}
          </select>
        )}

        {showDate && (
          <div className="flex items-center gap-1">
            <select
              className={selectClasses}
              value={selectedYear ?? currentYear}
              onChange={(e) => onYearChange?.(Number(e.target.value))}
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <select
              className={selectClasses}
              value={selectedMonth ?? new Date().getMonth() + 1}
              onChange={(e) => onMonthChange?.(Number(e.target.value))}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {VI.filter.month} {m}
                </option>
              ))}
            </select>
          </div>
        )}

        {showSearch && (
          <input
            type="text"
            className="bg-gray-700 text-white border border-gray-600 rounded-md px-3 py-2 text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            placeholder={VI.table.search}
            value={searchValue}
            onChange={(e) => onSearchChange?.(e.target.value)}
          />
        )}
      </div>

      {(showProvince || showClinicType) && (
        <p className="text-xs text-gray-500 italic mt-1">
          {VI.filter.filterHint}
        </p>
      )}
    </div>
  )
})
