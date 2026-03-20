'use client'

import { useState, useCallback } from 'react'
import type {
  CheckDistributorData,
  CheckDistributorFilters,
  DistributorDetailData,
} from '@/lib/admin/services/check-distributor'
import { SectionHeader } from '@/components/admin/SectionHeader'
import { ColorPivotTable } from '@/components/admin/ColorPivotTable'
import { DistributorDetailModal } from '@/components/admin/DistributorDetailModal'
import { Search } from 'lucide-react'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CheckDistributorClientProps {
  initialData: CheckDistributorData
  initialFilters: CheckDistributorFilters
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CheckDistributorClient({
  initialData,
  initialFilters,
}: CheckDistributorClientProps) {
  const [data, setData] = useState<CheckDistributorData>(initialData)
  const [filters, setFilters] = useState<CheckDistributorFilters>(initialFilters)
  const [loading, setLoading] = useState(false)

  // Detail modal state
  const [selectedDistributor, setSelectedDistributor] = useState<{
    id: string
    month: number
  } | null>(null)
  const [detailData, setDetailData] = useState<DistributorDetailData | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const updateFilter = useCallback(
    <K extends keyof CheckDistributorFilters>(key: K, value: CheckDistributorFilters[K]) => {
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
      if (filters.system_type) params.set('system_type', filters.system_type)
      if (filters.ship_from) params.set('ship_from', filters.ship_from)
      if (filters.category) params.set('category', filters.category)
      if (filters.brand) params.set('brand', filters.brand)
      if (filters.search) params.set('search', filters.search)
      params.set('page', '1')
      params.set('page_size', String(filters.page_size))
      const res = await fetch(`/api/admin/check-distributor?${params}`)
      const newData = await res.json()
      setData(newData)
    } finally {
      setLoading(false)
    }
  }, [filters])

  const handleRowClick = useCallback(
    async (rowId: string, columnKey?: string) => {
      const month = columnKey ? parseInt(columnKey) : new Date().getMonth() + 1
      setSelectedDistributor({ id: rowId, month })
      setDetailLoading(true)
      setDetailData(null)
      try {
        const res = await fetch(
          `/api/admin/check-distributor/${rowId}/detail?month=${month}&year=${filters.year}`
        )
        const detail: DistributorDetailData = await res.json()
        setDetailData(detail)
      } catch (err) {
        console.error('Failed to load distributor detail:', err)
      } finally {
        setDetailLoading(false)
      }
    },
    [filters.year]
  )

  const closeModal = useCallback(() => {
    setSelectedDistributor(null)
    setDetailData(null)
  }, [])

  // ---------------------------------------------------------------------------
  // Pivot table data mapping
  // ---------------------------------------------------------------------------

  const pivotRows = data.distributors.data.map(d => ({
    id: d.distributor_id,
    label: d.distributor_name,
    dimColumns: {
      region: d.region,
      zone: d.zone,
      province: d.province,
      distributor_code: d.distributor_code,
      distributor_name: d.distributor_name,
    },
    values: d.monthly_data,
  }))

  const monthColumns = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']

  const dimColumnLabels = [
    { key: 'region', label: 'Mien', sticky: true },
    { key: 'zone', label: 'Vung', sticky: true },
    { key: 'province', label: 'Tinh', sticky: true },
    { key: 'distributor_code', label: 'Ma NPP', sticky: true },
    { key: 'distributor_name', label: 'Ten NPP', sticky: true },
  ]

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
      <h1 className="text-xl font-bold text-white">Check Distributor</h1>

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
          <option value="revenue">Doanh so</option>
          <option value="retail_revenue">Doanh so le</option>
        </select>

        {/* Systemtype */}
        <select
          value={filters.system_type}
          onChange={e => updateFilter('system_type', e.target.value)}
          className={selectClass}
        >
          <option value="">All Systemtype</option>
          {data.filter_options.system_types
            .filter(v => v !== 'All Systemtype')
            .map(v => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
        </select>

        {/* Shipfrom */}
        <select
          value={filters.ship_from}
          onChange={e => updateFilter('ship_from', e.target.value)}
          className={selectClass}
        >
          <option value="">All Shipfrom</option>
          {data.filter_options.ship_froms
            .filter(v => v !== 'All Shipfrom')
            .map(v => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
        </select>

        {/* Category */}
        <select
          value={filters.category}
          onChange={e => updateFilter('category', e.target.value)}
          className={selectClass}
        >
          <option value="">All Category</option>
          {data.filter_options.categories
            .filter(v => v !== 'All Category')
            .map(v => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
        </select>

        {/* Brands */}
        <select
          value={filters.brand}
          onChange={e => updateFilter('brand', e.target.value)}
          className={selectClass}
        >
          <option value="">All Brands</option>
          {data.filter_options.brands
            .filter(v => v !== 'All Brands')
            .map(v => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
        </select>

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
          <span className="text-sm">Dang tai...</span>
        </div>
      )}

      {/* Doanh so nam pivot section */}
      <SectionHeader title={`Doanh so nam ${filters.year}`}>
        <ColorPivotTable
          rows={pivotRows}
          columns={monthColumns}
          dimColumnLabels={dimColumnLabels}
          onRowClick={handleRowClick}
          showColumnVisibility={true}
          showPageSizeDropdown={true}
          exportConfig={{ copy: true, excel: true, csv: true, pdf: true, print: true }}
          searchPlaceholder="Tim kiem"
          columnHeaderPrefix="Thang "
        />
      </SectionHeader>

      {/* Detail modal */}
      <DistributorDetailModal
        isOpen={selectedDistributor !== null}
        onClose={closeModal}
        data={detailData}
        loading={detailLoading}
      />
    </div>
  )
}
