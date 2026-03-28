'use client'

import { useState, useCallback } from 'react'
import type {
  CheckClinicsData,
  CheckClinicsFilters,
  ClinicDetailData,
} from '@/lib/admin/services/check-clinics'
import { SectionHeader } from '@/components/admin/SectionHeader'
import { ColorPivotTable } from '@/components/admin/ColorPivotTable'
import { ClinicDetailModal } from '@/components/admin/ClinicDetailModal'
import { Search } from 'lucide-react'
import { VI } from '@/lib/i18n/vietnamese'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CheckClinicsClientProps {
  initialData: CheckClinicsData
  initialFilters: CheckClinicsFilters
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROVINCES = [
  'Ha Noi',
  'TP. Ho Chi Minh',
  'Da Nang',
  'Can Tho',
  'Hai Phong',
  'Thai Nguyen',
  'Khanh Hoa',
  'Thua Thien Hue',
  'Dong Nai',
  'Binh Duong',
]

const CLINIC_TYPES: Array<{ value: string; label: string }> = [
  { value: 'phong_kham', label: 'Phong kham' },
  { value: 'nha_thuoc', label: 'Nha thuoc' },
  { value: 'thu_y', label: 'Thu y' },
  { value: 'my_pham', label: 'My pham' },
  { value: 'khac', label: 'Khac' },
]

const MONTH_COLUMNS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']

const DIM_COLUMN_LABELS = [
  { key: 'region', label: VI.checkClinics.region, sticky: true },
  { key: 'zone', label: VI.checkClinics.zone, sticky: true },
  { key: 'province', label: VI.checkClinics.province, sticky: true },
  { key: 'facility_code', label: VI.checkClinics.code, sticky: true },
  { key: 'clinic_name', label: VI.checkClinics.name, sticky: true },
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CheckClinicsClient({
  initialData,
  initialFilters,
}: CheckClinicsClientProps) {
  const [data, setData] = useState<CheckClinicsData>(initialData)
  const [filters, setFilters] = useState<CheckClinicsFilters>(initialFilters)
  const [loading, setLoading] = useState(false)

  // Detail modal state
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailData, setDetailData] = useState<ClinicDetailData | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const updateFilter = useCallback(
    <K extends keyof CheckClinicsFilters>(key: K, value: CheckClinicsFilters[K]) => {
      setFilters(prev => ({ ...prev, [key]: value }))
    },
    []
  )

  const handleSearch = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('year', String(filters.year))
      params.set('metric', filters.metric)
      if (filters.clinic_type) params.set('clinic_type', filters.clinic_type)
      if (filters.province) params.set('province', filters.province)
      if (filters.search) params.set('search', filters.search)
      params.set('page', '1')
      params.set('page_size', String(filters.page_size))
      const res = await fetch(`/api/admin/check-clinics?${params}`)
      const newData = await res.json()
      setData(newData)
    } finally {
      setLoading(false)
    }
  }, [filters])

  const handleRowClick = useCallback(
    async (facilityCode: string, columnKey?: string) => {
      const month = columnKey ? parseInt(columnKey) : selectedMonth
      setSelectedMonth(month)
      setDetailOpen(true)
      setDetailLoading(true)
      setDetailData(null)
      try {
        const res = await fetch(
          `/api/admin/check-clinics/${facilityCode}/detail?year=${filters.year}&month=${month}`
        )
        const detail: ClinicDetailData = await res.json()
        setDetailData(detail)
      } catch (err) {
        console.error('Failed to load clinic detail:', err)
      } finally {
        setDetailLoading(false)
      }
    },
    [filters.year, selectedMonth]
  )

  // ---------------------------------------------------------------------------
  // Pivot table data mapping
  // ---------------------------------------------------------------------------

  const pivotRows = data.clinics.data.map(c => ({
    id: c.facility_code,
    label: c.clinic_name,
    dimColumns: {
      region: c.region,
      zone: c.zone,
      province: c.province,
      facility_code: c.facility_code,
      clinic_name: c.clinic_name,
    },
    values: c.monthly_data,
  }))

  // ---------------------------------------------------------------------------
  // Filter select style
  // ---------------------------------------------------------------------------

  const selectClass =
    'bg-gray-700 text-white border border-gray-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-teal-500'

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Page title */}
      <h1 className="text-xl font-bold text-white">{VI.checkClinics.title}</h1>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Year */}
        <select
          value={filters.year}
          onChange={e => updateFilter('year', parseInt(e.target.value))}
          className={selectClass}
        >
          {[2024, 2025, 2026].map(y => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>

        {/* Metric */}
        <select
          value={filters.metric}
          onChange={e => updateFilter('metric', e.target.value)}
          className={selectClass}
        >
          <option value="query_count">{VI.checkClinics.queryCount}</option>
          <option value="session_count">{VI.checkClinics.sessionCount}</option>
        </select>

        {/* Clinic type */}
        <select
          value={filters.clinic_type}
          onChange={e => updateFilter('clinic_type', e.target.value)}
          className={selectClass}
        >
          <option value="">{VI.checkClinics.allClinicTypes}</option>
          {CLINIC_TYPES.map(ct => (
            <option key={ct.value} value={ct.value}>
              {ct.label}
            </option>
          ))}
        </select>

        {/* Province */}
        <select
          value={filters.province}
          onChange={e => updateFilter('province', e.target.value)}
          className={selectClass}
        >
          <option value="">{VI.checkClinics.allProvinces}</option>
          {PROVINCES.map(p => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>

        {/* Search input */}
        <input
          type="text"
          placeholder={VI.checkClinics.searchClinic}
          value={filters.search}
          onChange={e => updateFilter('search', e.target.value)}
          className="bg-gray-700 text-white border border-gray-600 rounded-md px-3 py-2 text-sm placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-teal-500"
        />

        {/* Search button */}
        <button
          onClick={handleSearch}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-md transition-colors flex items-center gap-2 disabled:opacity-50"
        >
          <Search className="h-4 w-4" />
        </button>
      </div>

      {/* Loading overlay */}
      {loading && (
        <div className="flex items-center gap-2 text-teal-400">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-teal-400" />
          <span className="text-sm">{VI.checkClinics.loading}</span>
        </div>
      )}

      {/* Thong ke phong kham pivot section */}
      <SectionHeader title={`${VI.checkClinics.clinicStatsYear} ${filters.year}`} defaultOpen={true}>
        <ColorPivotTable
          rows={pivotRows}
          columns={MONTH_COLUMNS}
          dimColumnLabels={DIM_COLUMN_LABELS}
          onRowClick={handleRowClick}
          showColumnVisibility={true}
          showPageSizeDropdown={true}
          exportConfig={{ copy: true, excel: true }}
          searchPlaceholder={VI.checkClinics.searchClinic}
          columnHeaderPrefix={`${VI.filter.month} `}
        />
      </SectionHeader>

      {/* Clinic detail modal */}
      <ClinicDetailModal
        open={detailOpen}
        onOpenChange={setDetailOpen}
        clinicName={detailData?.clinic_name ?? ''}
        facilityCode={detailData?.facility_code ?? ''}
        year={filters.year}
        month={selectedMonth}
        users={detailData?.users ?? []}
        loading={detailLoading}
      />
    </div>
  )
}
