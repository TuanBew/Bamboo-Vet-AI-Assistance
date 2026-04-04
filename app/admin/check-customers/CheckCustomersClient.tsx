'use client'

import { useState, useRef, useMemo, useCallback } from 'react'
import { Search, MapPin as MapPinIcon } from 'lucide-react'
import { MapView, type MapHandle, type MapPin } from '@/components/admin/MapView'
import { SectionHeader } from '@/components/admin/SectionHeader'
import { DataTable, type DataTableColumn } from '@/components/admin/DataTable'
import { getCustomerTypeConfig } from '@/lib/admin/customer-types'
import type {
  CheckCustomersData,
  CheckCustomersFilters,
  CustomerRow as CustomerRowBase,
  RevenuePivotRow,
} from '@/lib/admin/services/check-customers'

type CustomerRow = CustomerRowBase & Record<string, unknown>
import { VI } from '@/lib/i18n/vietnamese'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CheckCustomersClientProps {
  initialData: CheckCustomersData
  initialFilters: CheckCustomersFilters
}

type PivotRow = Record<string, unknown>

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CheckCustomersClient({
  initialData,
  initialFilters,
}: CheckCustomersClientProps) {
  const [data, setData] = useState<CheckCustomersData>(initialData)
  const [filters, setFilters] = useState({
    distributor_id: initialFilters.distributor_id,
    search: initialFilters.search,
  })
  const [loading, setLoading] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<{
    key: string
    name: string
  } | null>(null)
  const [revenueRows, setRevenueRows] = useState<RevenuePivotRow[]>([])
  const [revenueLoading, setRevenueLoading] = useState(false)
  const mapHandleRef = useRef<MapHandle | null>(null)

  // -------------------------------------------------------------------------
  // NPP options: use real data from DB + "All" option
  // -------------------------------------------------------------------------

  const nppOptions = useMemo(() => {
    return [
      { value: '', label: VI.nhapHang.allNpp },
      ...data.npp_options.map((o) => ({
        value: o.ship_from_code,
        label: o.ship_from_name,
      })),
    ]
  }, [data.npp_options])

  // -------------------------------------------------------------------------
  // Map pins — use customerTypeCode for SVG icons
  // -------------------------------------------------------------------------

  const mapPins: MapPin[] = useMemo(
    () =>
      data.map_pins.map((p) => ({
        id: p.customer_key,
        latitude: p.lat,
        longitude: p.long,
        label: p.customer_name,
        popupContent: p.cust_class_name,
        customerTypeCode: p.cust_class_key,
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

  const handleSearch = useCallback(() => fetchData(1), [fetchData])
  const handlePageChange = useCallback((page: number) => fetchData(page), [fetchData])

  // -------------------------------------------------------------------------
  // Customer name click → load revenue for that customer
  // -------------------------------------------------------------------------

  const handleCustomerClick = useCallback(async (row: CustomerRow) => {
    setSelectedCustomer({ key: row.customer_key, name: row.customer_name })
    setRevenueLoading(true)
    try {
      const res = await fetch(
        `/api/admin/check-customers/revenue?customer_key=${encodeURIComponent(row.customer_key)}`
      )
      const rows: RevenuePivotRow[] = await res.json()
      setRevenueRows(rows)
    } finally {
      setRevenueLoading(false)
    }
  }, [])

  // -------------------------------------------------------------------------
  // Định vị click → fly map to location
  // -------------------------------------------------------------------------

  const handleLocateClick = useCallback((row: CustomerRow) => {
    if (row.lat == null || row.long == null) return
    mapHandleRef.current?.flyTo(row.lat, row.long, 15)
    document.getElementById('map-section')?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  // -------------------------------------------------------------------------
  // Customer table columns
  // -------------------------------------------------------------------------

  const customerColumns = useMemo<DataTableColumn<CustomerRow>[]>(
    () => [
      { key: 'customer_key', label: 'Mã KH', sortable: true },
      {
        key: 'customer_name',
        label: 'Tên KH',
        sortable: true,
        render: (_v, row) => (
          <button
            onClick={() => handleCustomerClick(row)}
            className={`text-left hover:underline cursor-pointer font-medium transition-colors ${
              selectedCustomer?.key === row.customer_key
                ? 'text-cyan-300'
                : 'text-cyan-400 hover:text-cyan-300'
            }`}
          >
            {row.customer_name}
          </button>
        ),
      },
      { key: 'address', label: 'Địa chỉ' },
      { key: 'town_name', label: 'Phường/Xã' },
      { key: 'dist_province', label: 'Quận/Huyện' },
      { key: 'province_name', label: 'Tỉnh' },
      {
        key: 'cust_class_name',
        label: 'Loại cơ sở',
        render: (v, row) => {
          const cfg = getCustomerTypeConfig(row.cust_class_key)
          return (
            <span
              className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${cfg.bgClass}/20 ${cfg.textClass}`}
            >
              {v as string}
            </span>
          )
        },
      },
      {
        key: 'lat',
        label: 'Định vị',
        sortable: false,
        render: (_v, row) => {
          const hasCoords = row.lat != null && row.long != null
          return hasCoords ? (
            <button
              onClick={() => handleLocateClick(row)}
              className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 hover:bg-green-500/40 transition-colors cursor-pointer"
            >
              <MapPinIcon className="w-3 h-3" />
              Đã định vị
            </button>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-600/40 text-gray-400">
              Chưa định vị
            </span>
          )
        },
      },
    ],
    [selectedCustomer, handleCustomerClick, handleLocateClick]
  )

  // -------------------------------------------------------------------------
  // Revenue pivot table (brand × month)
  // -------------------------------------------------------------------------

  const allMonths = useMemo(() => {
    const monthSet = new Set<string>()
    for (const row of revenueRows) monthSet.add(row.month)
    return Array.from(monthSet).sort()
  }, [revenueRows])

  // Group rows by brand
  const pivotRows: PivotRow[] = useMemo(() => {
    const brandMap = new Map<string, PivotRow>()
    for (const row of revenueRows) {
      if (!brandMap.has(row.brand)) {
        brandMap.set(row.brand, { brand: row.brand })
      }
      const entry = brandMap.get(row.brand)!
      entry[row.month] = row.revenue
    }
    return Array.from(brandMap.values()).sort((a, b) =>
      String(a.brand).localeCompare(String(b.brand))
    )
  }, [revenueRows])

  const pivotColumns = useMemo<DataTableColumn<PivotRow>[]>(() => {
    const cols: DataTableColumn<PivotRow>[] = [
      { key: 'brand', label: 'Thương hiệu', sortable: true },
    ]
    for (const m of allMonths) {
      cols.push({
        key: m,
        label: m.replace('-', '/'),
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

  // -------------------------------------------------------------------------
  // Pagination info
  // -------------------------------------------------------------------------

  const showingFrom = data.customers.total === 0
    ? 0
    : (data.customers.page - 1) * data.customers.page_size + 1
  const showingTo = Math.min(
    data.customers.page * data.customers.page_size,
    data.customers.total
  )

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Page title */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">{VI.checkCustomers.title}</h1>
        <div className="text-sm text-gray-400">
          Home / <span className="text-gray-200">Checkcus</span>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3">
        <select
          value={filters.distributor_id}
          onChange={(e) => setFilters((f) => ({ ...f, distributor_id: e.target.value }))}
          className="flex-1 bg-gray-700 text-white border border-gray-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-teal-500"
        >
          {nppOptions.map((opt) => (
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
        <SectionHeader title={VI.checkCustomers.customerLocationMonth}>
          <MapView
            pins={mapPins}
            className="h-[400px]"
            onMapReady={(handle) => {
              mapHandleRef.current = handle
            }}
          />
        </SectionHeader>
      </div>

      {/* Section 2: Customer list */}
      <SectionHeader
        title={VI.checkCustomers.customerList}
        className="[&_button]:bg-amber-600/20 [&_span]:text-amber-400"
      >
        <DataTable<CustomerRow>
          data={data.customers.data as CustomerRow[]}
          columns={customerColumns}
          exportConfig={{ copy: true, excel: true, csv: true, pdf: true, print: true }}
          showSearch
          searchPlaceholder="Search..."
          totalCount={data.customers.total}
          currentPage={data.customers.page}
          onPageChange={handlePageChange}
          showPageSizeDropdown
        />
        {data.customers.total > 0 && (
          <div className="text-sm text-gray-400 mt-2">
            Showing {showingFrom} to {showingTo} of {data.customers.total} entries
          </div>
        )}
      </SectionHeader>

      {/* Section 3: Doanh số — loads when customer is selected */}
      <SectionHeader
        title={
          selectedCustomer
            ? `Doanh số — ${selectedCustomer.name}`
            : VI.checkCustomers.revenue
        }
        className="[&_button]:bg-amber-600/20 [&_span]:text-amber-400"
      >
        {!selectedCustomer ? (
          <div className="rounded-lg border border-gray-700 bg-gray-800 p-8 text-center text-sm text-gray-400">
            Nhấn vào tên khách hàng ở bảng trên để xem doanh số theo thương hiệu
          </div>
        ) : revenueLoading ? (
          <div className="rounded-lg border border-gray-700 bg-gray-800 p-8 text-center text-sm text-gray-400">
            Đang tải doanh số...
          </div>
        ) : pivotRows.length === 0 ? (
          <div className="rounded-lg border border-gray-700 bg-gray-800 p-8 text-center text-sm text-gray-400">
            Không có dữ liệu doanh số cho khách hàng này
          </div>
        ) : (
          <DataTable<PivotRow>
            data={pivotRows}
            columns={pivotColumns}
            exportConfig={{ copy: true, excel: true, csv: true, pdf: true, print: true }}
            showSearch
            showPageSizeDropdown
          />
        )}
      </SectionHeader>

      {/* Loading overlay */}
      {loading && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg px-6 py-3 text-white text-sm">
            {VI.checkCustomers.loadingData}
          </div>
        </div>
      )}
    </div>
  )
}
