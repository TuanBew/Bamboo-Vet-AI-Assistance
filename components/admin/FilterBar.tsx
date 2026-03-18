'use client'

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

export function FilterBar(props: FilterBarProps) {
  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800 p-3 flex items-center gap-3">
      <p className="text-sm text-gray-400">FilterBar — filters configured</p>
      <p className="text-xs text-gray-500">Component stub — wired in Phase 3+</p>
    </div>
  )
}
