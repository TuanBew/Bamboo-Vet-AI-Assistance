'use client'

import { useState, useRef, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, MapPin as MapPinIcon, ImageIcon } from 'lucide-react'
import { MapView, type MapHandle, type MapPin } from '@/components/admin/MapView'
import { SectionHeader } from '@/components/admin/SectionHeader'
import { DataTable, type DataTableColumn } from '@/components/admin/DataTable'
import type {
  CheckCustomersData,
  CheckCustomersFilters,
} from '@/lib/admin/services/check-customers'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CheckCustomersClientProps {
  initialData: CheckCustomersData
  initialFilters: CheckCustomersFilters
}

// Flat row type for the customer DataTable
type CustomerRow = CheckCustomersData['customers']['data'][number] & {
  // render-only column key
  check_location: string
}

// Flat row type for revenue pivot DataTable
type PivotRow = Record<string, unknown>

// ---------------------------------------------------------------------------
// NPP options (hardcoded matching seed data)
// ---------------------------------------------------------------------------

const NPP_OPTIONS = [
  { value: '', label: 'Tat ca NPP' },
  { value: 'NPP001', label: 'NPP KIEN PHUC' },
  { value: 'NPP002', label: 'NPP DAI PHAT' },
  { value: 'NPP003', label: 'NPP THANH CONG' },
  { value: 'NPP004', label: 'NPP HOANG GIA' },
  { value: 'NPP005', label: 'NPP MINH ANH' },
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CheckCustomersClient({
  initialData,
  initialFilters,
}: CheckCustomersClientProps) {
  const router = useRouter()
  const [data, setData] = useState<CheckCustomersData>(initialData)
  const [filters, setFilters] = useState({
    distributor_id: initialFilters.distributor_id,
    search: initialFilters.search,
  })
  const [loading, setLoading] = useState(false)
  const mapHandleRef = useRef<MapHandle | null>(null)

  // -------------------------------------------------------------------------
  // Map pins
  // -------------------------------------------------------------------------

  const mapPins: MapPin[] = useMemo(
    () =>
      data.map_pins.map((p) => ({
        id: p.customer_id,
        latitude: p.latitude,
        longitude: p.longitude,
        label: p.customer_name,
        popupContent: p.customer_type,
        color: '#06b6d4',
      })),
    [data.map_pins]
  )

  // -------------------------------------------------------------------------
  // Data fetching
  // -------------------------------------------------------------------------

  const fetchData = useCallback(
    async (page: number) => {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        if (filters.distributor_id) params.set('distributor_id', filters.distributor_id)
        if (filters.search) params.set('search', filters.search)
        params.set('page', String(page))
        params.set('page_size', '10')
        const res = await fetch(`/api/admin/check-customers?${params}`)
        const newData: CheckCustomersData = await res.json()
        setData(newData)
      } finally {
        setLoading(false)
      }
    },
    [filters]
  )

  const handleSearch = useCallback(() => {
    fetchData(1)
  }, [fetchData])

  const handlePageChange = useCallback(
    (page: number) => {
      fetchData(page)
    },
    [fetchData]
  )

  // -------------------------------------------------------------------------
  // Customer table columns (11 data + 1 action)
  // -------------------------------------------------------------------------

  const customerColumns = useMemo<DataTableColumn<CustomerRow>[]>(
    () => [
      { key: 'customer_code', label: 'Ma', sortable: true },
      {
        key: 'customer_name',
        label: 'Ten KH',
        sortable: true,
        render: (_v, row) => (
          <span className="text-cyan-400 hover:underline cursor-pointer">
            {row.customer_name}
          </span>
        ),
      },
      { key: 'address', label: 'Dia chi' },
      { key: 'street', label: 'Duong' },
      { key: 'ward', label: 'Phuong/Xa' },
      { key: 'district', label: 'Quan/Huyen' },
      { key: 'province', label: 'Tinh' },
      { key: 'customer_type', label: 'Loai cua hieu' },
      {
        key: 'image_url',
        label: 'Anh cua hieu',
        sortable: false,
        render: (v) => {
          const url = v as string | null
          return url ? (
            <img
              src={url}
              alt="Anh cua hieu"
              className="w-8 h-8 rounded object-cover"
            />
          ) : (
            <div className="w-8 h-8 rounded bg-gray-700 flex items-center justify-center">
              <ImageIcon className="w-4 h-4 text-gray-500" />
            </div>
          )
        },
      },
      {
        key: 'created_at',
        label: 'Ngay tao',
        sortable: true,
        render: (v) => {
          const d = v as string
          if (!d) return ''
          const date = new Date(d)
          return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`
        },
      },
      {
        key: 'is_geo_located' as keyof CustomerRow,
        label: 'Dinh vi',
        render: (v) => {
          const located = v as boolean
          return located ? (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">
              Da dinh vi
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-600/40 text-gray-400">
              Chua dinh vi
            </span>
          )
        },
      },
      {
        key: 'check_location',
        label: 'Check Location',
        sortable: false,
        render: (_v, row) => {
          const hasCoords = row.latitude != null && row.longitude != null
          if (!hasCoords) {
            return <span className="text-gray-500 text-xs">N/A</span>
          }
          return (
            <button
              onClick={() => {
                mapHandleRef.current?.flyTo(row.latitude!, row.longitude!)
                // Scroll to map section
                document.getElementById('map-section')?.scrollIntoView({ behavior: 'smooth' })
              }}
              className="text-cyan-400 hover:text-cyan-300 text-xs underline flex items-center gap-1"
            >
              <MapPinIcon className="w-3 h-3" />
              Da dinh vi
            </button>
          )
        },
      },
    ],
    []
  )

  // Map customer data to rows with check_location key
  const customerRows: CustomerRow[] = useMemo(
    () =>
      data.customers.data.map((c) => ({
        ...c,
        check_location: '',
      })) as CustomerRow[],
    [data.customers.data]
  )

  // -------------------------------------------------------------------------
  // Revenue pivot table
  // -------------------------------------------------------------------------

  // Collect all unique months across all brands, sorted chronologically
  const allMonths = useMemo(() => {
    const monthSet = new Set<string>()
    for (const row of data.revenue_pivot) {
      for (const key of Object.keys(row.months)) {
        monthSet.add(key)
      }
    }
    return Array.from(monthSet).sort()
  }, [data.revenue_pivot])

  // Format month key "2025-01" to "2025/01"
  const formatMonthLabel = (key: string) => key.replace('-', '/')

  const pivotColumns = useMemo<DataTableColumn<PivotRow>[]>(() => {
    const cols: DataTableColumn<PivotRow>[] = [
      { key: 'brand', label: 'Brand', sortable: true },
    ]
    for (const m of allMonths) {
      cols.push({
        key: m,
        label: formatMonthLabel(m),
        sortable: true,
        render: (v) => {
          const val = v as number | undefined
          if (!val) return ''
          return val.toLocaleString('vi-VN')
        },
      })
    }
    return cols
  }, [allMonths])

  const pivotRows: PivotRow[] = useMemo(
    () =>
      data.revenue_pivot.map((r) => {
        const row: PivotRow = { brand: r.brand }
        for (const m of allMonths) {
          row[m] = r.months[m] ?? 0
        }
        return row
      }),
    [data.revenue_pivot, allMonths]
  )

  // -------------------------------------------------------------------------
  // Display programs columns
  // -------------------------------------------------------------------------

  const displayColumns = useMemo<DataTableColumn<Record<string, unknown>>[]>(
    () => [
      { key: 'program_name', label: 'Chuong trinh' },
      { key: 'staff_name', label: 'Nhan vien' },
      { key: 'time_period', label: 'Thoi gian' },
      {
        key: 'registration_image_url',
        label: 'Anh dang ky',
        sortable: false,
        render: (v) => {
          const url = v as string | null
          return url ? (
            <img src={url} alt="Dang ky" className="w-10 h-10 rounded object-cover" />
          ) : (
            <div className="w-10 h-10 rounded bg-gray-700 flex items-center justify-center">
              <ImageIcon className="w-4 h-4 text-gray-500" />
            </div>
          )
        },
      },
      {
        key: 'execution_image_url',
        label: 'Anh thuc hien',
        sortable: false,
        render: (v) => {
          const url = v as string | null
          return url ? (
            <img src={url} alt="Thuc hien" className="w-10 h-10 rounded object-cover" />
          ) : (
            <div className="w-10 h-10 rounded bg-gray-700 flex items-center justify-center">
              <ImageIcon className="w-4 h-4 text-gray-500" />
            </div>
          )
        },
      },
    ],
    []
  )

  const displayRows = useMemo(
    () =>
      data.display_programs.map((d) => ({
        ...d,
      })) as unknown as Record<string, unknown>[],
    [data.display_programs]
  )

  // -------------------------------------------------------------------------
  // Showing X to Y of Z
  // -------------------------------------------------------------------------

  const showingFrom = (data.customers.page - 1) * data.customers.page_size + 1
  const showingTo = Math.min(
    data.customers.page * data.customers.page_size,
    data.customers.total
  )

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Page title + breadcrumb */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Check Khach hang</h1>
        <div className="text-sm text-gray-400">
          Home / <span className="text-gray-200">Checkcus</span>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3">
        <select
          value={filters.distributor_id}
          onChange={(e) =>
            setFilters((f) => ({ ...f, distributor_id: e.target.value }))
          }
          className="flex-1 bg-gray-700 text-white border border-gray-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-teal-500"
        >
          {NPP_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <button
          onClick={handleSearch}
          disabled={loading}
          className="bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white px-4 py-2 rounded-md transition-colors"
        >
          <Search className="h-5 w-5" />
        </button>
      </div>

      {/* Section 1: Map */}
      <div id="map-section">
        <SectionHeader title="Vi tri khach hang thang">
          <MapView
            pins={mapPins}
            className="h-[350px]"
            onMapReady={(handle) => {
              mapHandleRef.current = handle
            }}
          />
        </SectionHeader>
      </div>

      {/* Section 2: Customer DataTable */}
      <SectionHeader
        title="Danh sach khach hang"
        className="[&_button]:bg-amber-600/20 [&_span]:text-amber-400"
      >
        <DataTable<CustomerRow>
          data={customerRows}
          columns={customerColumns}
          exportConfig={{
            copy: true,
            excel: true,
            csv: true,
            pdf: true,
            print: true,
          }}
          showSearch
          searchPlaceholder="Search..."
          totalCount={data.customers.total}
          currentPage={data.customers.page}
          onPageChange={handlePageChange}
          showPageSizeDropdown
        />
        <div className="text-sm text-gray-400 mt-2">
          Showing {showingFrom} to {showingTo} of {data.customers.total} entries
        </div>
      </SectionHeader>

      {/* Section 3: Revenue Pivot (Doanh so) */}
      <SectionHeader
        title="Doanh so"
        className="[&_button]:bg-amber-600/20 [&_span]:text-amber-400"
      >
        <DataTable<PivotRow>
          data={pivotRows}
          columns={pivotColumns}
          exportConfig={{
            copy: true,
            excel: true,
            csv: true,
            pdf: true,
            print: true,
          }}
          showSearch
          showPageSizeDropdown
        />
      </SectionHeader>

      {/* Section 4: Display Programs (Tinh hinh trung bay) */}
      <SectionHeader
        title="Tinh hinh trung bay"
        className="[&_button]:bg-green-600/20 [&_span]:text-green-400"
      >
        {data.display_programs.length === 0 ? (
          <div className="rounded-lg border border-gray-700 bg-gray-800 p-8 text-center text-sm text-gray-400">
            Chua co du lieu trung bay
          </div>
        ) : (
          <DataTable<Record<string, unknown>>
            data={displayRows}
            columns={displayColumns}
          />
        )}
      </SectionHeader>

      {/* Loading overlay */}
      {loading && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg px-6 py-3 text-white text-sm">
            Dang tai du lieu...
          </div>
        </div>
      )}
    </div>
  )
}
