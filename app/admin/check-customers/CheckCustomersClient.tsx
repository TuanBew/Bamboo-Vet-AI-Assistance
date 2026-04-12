'use client'

import { useState, useRef, useMemo, useCallback, useEffect } from 'react'
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
import { VI } from '@/lib/i18n/vietnamese'

// Extend CustomerRow with computed has_geo field for sortable "Định vị" column
type CustomerRow = CustomerRowBase & { has_geo: boolean } & Record<string, unknown>

type PivotRow = Record<string, unknown>

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toMapPins(raw: CheckCustomersData['map_pins']): MapPin[] {
  return raw.map(p => ({
    id: p.customer_key,
    latitude: p.lat,
    longitude: p.long,
    label: p.customer_name,
    popupContent: p.cust_class_name,
    customerTypeCode: p.cust_class_key,
  }))
}

function addHasGeo(rows: CustomerRowBase[]): CustomerRow[] {
  return rows.map(r => ({ ...r, has_geo: r.lat != null && r.long != null }))
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CheckCustomersClientProps {
  initialData: CheckCustomersData
  initialFilters: CheckCustomersFilters
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CheckCustomersClient({
  initialData,
  initialFilters,
}: CheckCustomersClientProps) {
  const [data, setData] = useState<CheckCustomersData>(initialData)
  const [mapPins, setMapPins] = useState<MapPin[]>(() => toMapPins(initialData.map_pins))
  const [loading, setLoading] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<{ key: string; name: string } | null>(null)
  const [revenueRows, setRevenueRows] = useState<RevenuePivotRow[]>([])
  const [revenueLoading, setRevenueLoading] = useState(false)
  const mapHandleRef = useRef<MapHandle | null>(null)
  const selectedCustomerRowRef = useRef<CustomerRow | null>(null)

  // -------------------------------------------------------------------------
  // Search filter state
  // -------------------------------------------------------------------------
  const [npp, setNpp] = useState(initialFilters.distributor_id)
  const [maKH, setMaKH] = useState('')
  const [tenKH, setTenKH] = useState('')
  const [tinh, setTinh] = useState('')          // province_name
  const [quanHuyen, setQuanHuyen] = useState('') // town_name (district) — actual DB filter
  const [phuongXa, setPhuongXa] = useState('')   // ward — UI cascade only, no DB column
  const [loaiCoSo, setLoaiCoSo] = useState('')
  const [dinhVi, setDinhVi] = useState('')

  // VN geo cascade options (loaded from vn-geo API)
  const [quanHuyenOptions, setQuanHuyenOptions] = useState<string[]>([])
  const [phuongXaOptions, setPhuongXaOptions] = useState<string[]>([])
  const [geoLoading, setGeoLoading] = useState(false)

  // -------------------------------------------------------------------------
  // Autocomplete state
  // -------------------------------------------------------------------------
  const [maKHSuggestions, setMaKHSuggestions] = useState<string[]>([])
  const [tenKHSuggestions, setTenKHSuggestions] = useState<string[]>([])
  const [showMaKHDrop, setShowMaKHDrop] = useState(false)
  const [showTenKHDrop, setShowTenKHDrop] = useState(false)
  const maKHTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tenKHTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // -------------------------------------------------------------------------
  // Province list (loaded once from vn-provinces library via API)
  // -------------------------------------------------------------------------
  const [provinces, setProvinces] = useState<string[]>([])

  useEffect(() => {
    fetch('/api/admin/check-customers/vn-geo?type=provinces')
      .then(r => r.json())
      .then((d: string[]) => setProvinces(d))
      .catch(() => {/* silent */})
  }, [])

  // Load Q/H districts when Tỉnh changes
  const handleTinhChange = useCallback(async (val: string) => {
    setTinh(val)
    setQuanHuyen('')
    setPhuongXa('')
    setPhuongXaOptions([])
    setQuanHuyenOptions([])
    if (!val) return
    setGeoLoading(true)
    try {
      const res = await fetch(`/api/admin/check-customers/vn-geo?type=districts&province=${encodeURIComponent(val)}`)
      const opts: string[] = await res.json()
      setQuanHuyenOptions(opts)
    } finally {
      setGeoLoading(false)
    }
  }, [])

  // Load P/X wards when Q/H changes
  const handleQuanHuyenChange = useCallback(async (val: string) => {
    setQuanHuyen(val)
    setPhuongXa('')
    setPhuongXaOptions([])
    if (!val) return
    setGeoLoading(true)
    try {
      const res = await fetch(`/api/admin/check-customers/vn-geo?type=wards&district=${encodeURIComponent(val)}`)
      const opts: string[] = await res.json()
      setPhuongXaOptions(opts)
    } finally {
      setGeoLoading(false)
    }
  }, [])

  // -------------------------------------------------------------------------
  // Autocomplete handlers
  // -------------------------------------------------------------------------
  const handleMaKHChange = useCallback((val: string) => {
    setMaKH(val)
    if (maKHTimer.current) clearTimeout(maKHTimer.current)
    if (!val.trim()) { setMaKHSuggestions([]); setShowMaKHDrop(false); return }
    maKHTimer.current = setTimeout(() => {
      fetch(`/api/admin/check-customers/autocomplete?field=customer_key&query=${encodeURIComponent(val)}`)
        .then(r => r.json())
        .then((s: string[]) => { setMaKHSuggestions(s); setShowMaKHDrop(s.length > 0) })
        .catch(() => { setMaKHSuggestions([]); setShowMaKHDrop(false) })
    }, 200)
  }, [])

  const handleTenKHChange = useCallback((val: string) => {
    setTenKH(val)
    if (tenKHTimer.current) clearTimeout(tenKHTimer.current)
    if (!val.trim()) { setTenKHSuggestions([]); setShowTenKHDrop(false); return }
    tenKHTimer.current = setTimeout(() => {
      fetch(`/api/admin/check-customers/autocomplete?field=customer_name&query=${encodeURIComponent(val)}`)
        .then(r => r.json())
        .then((s: string[]) => { setTenKHSuggestions(s); setShowTenKHDrop(s.length > 0) })
        .catch(() => { setTenKHSuggestions([]); setShowTenKHDrop(false) })
    }, 200)
  }, [])

  // -------------------------------------------------------------------------
  // Data fetching
  // -------------------------------------------------------------------------
  const activeFilters = useRef<CheckCustomersFilters>(initialFilters)

  const fetchData = useCallback(async (filters: CheckCustomersFilters, page: number, updatePins: boolean) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.distributor_id) params.set('distributor_id', filters.distributor_id)
      if (filters.customer_key_filter) params.set('customer_key_filter', filters.customer_key_filter)
      if (filters.customer_name_filter) params.set('customer_name_filter', filters.customer_name_filter)
      if (filters.province) params.set('province', filters.province)
      if (filters.town) params.set('town', filters.town)
      if (filters.cust_class_key) params.set('cust_class_key', filters.cust_class_key)
      if (filters.has_geo) params.set('has_geo', filters.has_geo)
      params.set('page', String(page))
      params.set('page_size', '10')
      const res = await fetch(`/api/admin/check-customers?${params}`)
      const newData: CheckCustomersData = await res.json()
      setData(newData)
      if (updatePins) setMapPins(toMapPins(newData.map_pins))
    } finally {
      setLoading(false)
    }
  }, [])

  const handleSearch = useCallback(() => {
    const filters: CheckCustomersFilters = {
      distributor_id: npp,
      search: '',
      page: 1,
      page_size: 10,
      customer_key_filter: maKH.trim(),
      customer_name_filter: tenKH.trim(),
      province: tinh,
      town: quanHuyen, // Q/H district name matches town_name in DB exactly
      cust_class_key: loaiCoSo,
      has_geo: dinhVi,
    }
    activeFilters.current = filters
    fetchData(filters, 1, true)
  }, [npp, maKH, tenKH, tinh, quanHuyen, loaiCoSo, dinhVi, fetchData])

  // Fetch ALL customers (with current filters) for export
  const fetchAllCustomers = useCallback(async (): Promise<CustomerRow[]> => {
    const f = activeFilters.current
    const params = new URLSearchParams()
    if (f.distributor_id) params.set('distributor_id', f.distributor_id)
    if (f.customer_key_filter) params.set('customer_key_filter', f.customer_key_filter)
    if (f.customer_name_filter) params.set('customer_name_filter', f.customer_name_filter)
    if (f.province) params.set('province', f.province)
    if (f.town) params.set('town', f.town)
    if (f.cust_class_key) params.set('cust_class_key', f.cust_class_key)
    if (f.has_geo) params.set('has_geo', f.has_geo)
    params.set('page', '1')
    params.set('page_size', '10000')
    const res = await fetch(`/api/admin/check-customers?${params}`)
    const d: CheckCustomersData = await res.json()
    return addHasGeo(d.customers.data)
  }, [])


  const handlePageChange = useCallback(
    (page: number) => fetchData(activeFilters.current, page, false),
    [fetchData]
  )

  // -------------------------------------------------------------------------
  // Revenue fetch
  // -------------------------------------------------------------------------
  const loadRevenue = useCallback(async (row: CustomerRow) => {
    selectedCustomerRowRef.current = row
    setSelectedCustomer({ key: row.customer_key, name: row.customer_name })
    setRevenueLoading(true)
    try {
      const res = await fetch(`/api/admin/check-customers/revenue?customer_key=${encodeURIComponent(row.customer_key)}`)
      const rows: RevenuePivotRow[] = await res.json()
      setRevenueRows(rows)
    } finally {
      setRevenueLoading(false)
    }
  }, [])

  const handleCustomerClick = useCallback((row: CustomerRow) => {
    if (row.lat != null && row.long != null) {
      mapHandleRef.current?.flyTo(row.lat, row.long, 15)
      document.getElementById('map-section')?.scrollIntoView({ behavior: 'smooth' })
    }
    loadRevenue(row)
  }, [loadRevenue])

  const handleLocateClick = useCallback((row: CustomerRow) => {
    if (row.lat == null || row.long == null) return
    mapHandleRef.current?.flyTo(row.lat, row.long, 15)
    document.getElementById('map-section')?.scrollIntoView({ behavior: 'smooth' })
    loadRevenue(row)
  }, [loadRevenue])

  // -------------------------------------------------------------------------
  // Print handler — opens a new tab with selected customer info + revenue + map
  // -------------------------------------------------------------------------
  const handlePrintCustomer = useCallback(() => {
    const row = selectedCustomerRowRef.current
    if (!row) { window.print(); return }

    const esc = (s: unknown) =>
      String(s ?? '-').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

    const hasGeo = row.lat != null && row.long != null
    const lat = row.lat ?? 0
    const lng = row.long ?? 0
    const mapSection = hasGeo
      ? `<h2>V&#7883; tr&#237; tr&#234;n b&#7843;n &#273;&#7891;</h2>
         <img src="https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lng}&zoom=14&size=500x300&markers=${lat},${lng},red-pushpin"
              style="max-width:100%;border:1px solid #ccc" alt="ban do" />`
      : ''

    const now = new Date()
    const cur = now.getFullYear()
    const last = cur - 1
    const months: string[] = []
    for (let m = 1; m <= 12; m++) months.push(`${last}-${String(m).padStart(2, '0')}`)
    for (let m = 1; m <= 12; m++) months.push(`${cur}-${String(m).padStart(2, '0')}`)

    const brandMap = new Map<string, Map<string, number>>()
    for (const r of revenueRows) {
      if (!brandMap.has(r.brand)) brandMap.set(r.brand, new Map())
      brandMap.get(r.brand)!.set(r.month, r.revenue)
    }
    const sortedBrands = Array.from(brandMap.entries()).sort((a, b) => a[0].localeCompare(b[0]))

    const monthHeaders = months.map(m => `<th>${m.replace('-', '/')}</th>`).join('')
    const brandRows = sortedBrands.map(([brand, mmap]) => {
      const cells = months.map(m => {
        const v = mmap.get(m)
        return `<td>${v ? v.toLocaleString('vi-VN') : ''}</td>`
      }).join('')
      return `<tr><td>${esc(brand)}</td>${cells}</tr>`
    }).join('')

    const revenueSection = brandMap.size > 0
      ? `<h2>Doanh s&#7889; theo th&#432;&#417;ng hi&#7879;u</h2>
         <table><thead><tr><th>Th&#432;&#417;ng hi&#7879;u</th>${monthHeaders}</tr></thead>
         <tbody>${brandRows}</tbody></table>`
      : '<p>Kh&#244;ng c&#243; d&#7919; li&#7879;u doanh s&#7889;</p>'

    const pageHtml = [
      '<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8">',
      `<title>KH: ${esc(row.customer_name)}</title>`,
      '<style>',
      'body{font-family:Arial,sans-serif;font-size:12px;padding:20px;color:#111}',
      'h1{font-size:16px;margin-bottom:12px}h2{font-size:14px;margin:16px 0 8px}',
      '.grid{display:grid;grid-template-columns:1fr 1fr;gap:6px 24px;margin-bottom:16px}',
      '.row{display:flex;gap:8px}.lbl{font-weight:bold;color:#555;min-width:110px}',
      'table{border-collapse:collapse;width:100%;font-size:10px}',
      'th,td{border:1px solid #ccc;padding:4px 6px;text-align:left}',
      'th{background:#1f2937;color:white;white-space:nowrap}td{white-space:nowrap}',
      '@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}',
      '</style></head><body>',
      `<h1>Th&#244;ng tin kh&#225;ch h&#224;ng: ${esc(row.customer_name)}</h1>`,
      '<div class="grid">',
      `<div class="row"><span class="lbl">M&#227; KH:</span><span>${esc(row.customer_key)}</span></div>`,
      `<div class="row"><span class="lbl">Lo&#7841;i c&#417; s&#7903;:</span><span>${esc(row.cust_class_name)}</span></div>`,
      `<div class="row"><span class="lbl">&#272;&#7883;a ch&#7881;:</span><span>${esc(row.address)}</span></div>`,
      `<div class="row"><span class="lbl">Qu&#7853;n/Huy&#7879;n:</span><span>${esc(row.town_name)}</span></div>`,
      `<div class="row"><span class="lbl">T&#7881;nh:</span><span>${esc(row.province_name)}</span></div>`,
      `<div class="row"><span class="lbl">NPP:</span><span>${esc(row.ship_from_name)}</span></div>`,
      '</div>',
      revenueSection,
      mapSection,
      '</body></html>',
    ].join('')

    const blob = new Blob([pageHtml], { type: 'text/html;charset=utf-8' })
    const blobUrl = URL.createObjectURL(blob)
    const win = window.open(blobUrl, '_blank')
    if (win) {
      setTimeout(() => URL.revokeObjectURL(blobUrl), 30000)
    } else {
      URL.revokeObjectURL(blobUrl)
    }
  }, [revenueRows])

  // -------------------------------------------------------------------------
  // Derived data
  // -------------------------------------------------------------------------
  const nppOptions = useMemo(() => [
    { value: '', label: VI.nhapHang.allNpp },
    ...data.npp_options.map(o => ({ value: o.ship_from_code, label: o.ship_from_name })),
  ], [data.npp_options])

  const customersWithGeo = useMemo<CustomerRow[]>(
    () => addHasGeo(data.customers.data),
    [data.customers.data]
  )

  // -------------------------------------------------------------------------
  // Customer table columns
  // -------------------------------------------------------------------------
  const customerColumns = useMemo<DataTableColumn<CustomerRow>[]>(() => [
    { key: 'customer_key', label: 'Mã KH', sortable: true },
    {
      key: 'customer_name',
      label: 'Tên KH',
      sortable: true,
      render: (_v, row) => (
        <button
          onClick={() => handleCustomerClick(row)}
          className={`text-left hover:underline cursor-pointer font-medium transition-colors ${
            selectedCustomer?.key === row.customer_key ? 'text-cyan-300' : 'text-cyan-400 hover:text-cyan-300'
          }`}
        >
          {row.customer_name}
        </button>
      ),
    },
    { key: 'address', label: 'Địa chỉ' },
    { key: 'town_name', label: 'Quận/Huyện' },
    { key: 'province_name', label: 'Tỉnh' },
    {
      key: 'cust_class_name',
      label: 'Loại cơ sở',
      render: (v, row) => {
        const cfg = getCustomerTypeConfig(row.cust_class_key)
        return (
          <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${cfg.bgClass}/20 ${cfg.textClass}`}>
            {v as string}
          </span>
        )
      },
    },
    {
      key: 'has_geo',
      label: 'Định vị',
      sortable: true,
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
  ], [selectedCustomer, handleCustomerClick, handleLocateClick])

  // -------------------------------------------------------------------------
  // Revenue pivot columns
  // -------------------------------------------------------------------------
  const allMonths = useMemo(() => {
    const now = new Date()
    const cur = now.getFullYear()
    const last = cur - 1
    const months: string[] = []
    for (let m = 1; m <= 12; m++) months.push(`${last}-${String(m).padStart(2, '0')}`)
    for (let m = 1; m <= 12; m++) months.push(`${cur}-${String(m).padStart(2, '0')}`)
    return months
  }, [])

  const pivotRows: PivotRow[] = useMemo(() => {
    const map = new Map<string, PivotRow>()
    for (const row of revenueRows) {
      if (!map.has(row.brand)) map.set(row.brand, { brand: row.brand })
      map.get(row.brand)![row.month] = row.revenue
    }
    return Array.from(map.values()).sort((a, b) => String(a.brand).localeCompare(String(b.brand)))
  }, [revenueRows])

  const pivotColumns = useMemo<DataTableColumn<PivotRow>[]>(() => {
    const cols: DataTableColumn<PivotRow>[] = [{ key: 'brand', label: 'Thương hiệu', sortable: true }]
    for (const m of allMonths) {
      cols.push({
        key: m,
        label: m.replace('-', '/'),
        sortable: true,
        render: (v) => {
          const val = v as number | undefined
          return val ? val.toLocaleString('vi-VN') : ''
        },
      })
    }
    return cols
  }, [allMonths])

  // -------------------------------------------------------------------------
  // Pagination info
  // -------------------------------------------------------------------------
  const showingFrom = data.customers.total === 0 ? 0 : (data.customers.page - 1) * data.customers.page_size + 1
  const showingTo = Math.min(data.customers.page * data.customers.page_size, data.customers.total)

  // Shared input/select class
  const cls = 'bg-gray-700 text-white border border-gray-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-teal-500 w-full'

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

      {/* Section 1: Map */}
      <div id="map-section">
        <SectionHeader title={VI.checkCustomers.customerLocationMonth}>
          <MapView
            pins={mapPins}
            className="h-[400px]"
            onMapReady={(handle) => { mapHandleRef.current = handle }}
          />
        </SectionHeader>
      </div>

      {/* Section 2: Customer list with embedded search */}
      <SectionHeader
        title={VI.checkCustomers.customerList}
        className="[&_button]:bg-amber-600/20 [&_span]:text-amber-400"
      >
        {/* ── Search bar ── */}
        <div className="space-y-2 mb-4">
          {/* Row 1: NPP */}
          <select value={npp} onChange={e => setNpp(e.target.value)} className={cls}>
            {nppOptions.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          {/* Row 2: 7 filter boxes + button */}
          <div className="flex items-start gap-2 flex-wrap">
            {/* Box 1: Mã KH */}
            <div className="relative flex-1 min-w-[110px]">
              <input
                type="text"
                placeholder="Mã KH"
                value={maKH}
                onChange={e => handleMaKHChange(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                onBlur={() => setTimeout(() => setShowMaKHDrop(false), 150)}
                className={cls}
              />
              {showMaKHDrop && maKHSuggestions.length > 0 && (
                <ul className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-600 rounded-md shadow-lg max-h-48 overflow-y-auto">
                  {maKHSuggestions.map(s => (
                    <li
                      key={s}
                      onMouseDown={() => { setMaKH(s); setShowMaKHDrop(false) }}
                      className="px-3 py-2 text-sm text-gray-200 hover:bg-gray-700 cursor-pointer"
                    >
                      {s}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Box 2: Tên KH */}
            <div className="relative flex-[2] min-w-[160px]">
              <input
                type="text"
                placeholder="Tên KH"
                value={tenKH}
                onChange={e => handleTenKHChange(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                onBlur={() => setTimeout(() => setShowTenKHDrop(false), 150)}
                className={cls}
              />
              {showTenKHDrop && tenKHSuggestions.length > 0 && (
                <ul className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-600 rounded-md shadow-lg max-h-48 overflow-y-auto">
                  {tenKHSuggestions.map(s => (
                    <li
                      key={s}
                      onMouseDown={() => { setTenKH(s); setShowTenKHDrop(false) }}
                      className="px-3 py-2 text-sm text-gray-200 hover:bg-gray-700 cursor-pointer"
                    >
                      {s}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Box 3: Tỉnh */}
            <div className="flex-1 min-w-[110px]">
              <select value={tinh} onChange={e => handleTinhChange(e.target.value)} className={cls}>
                <option value="">Tất cả Tỉnh</option>
                {provinces.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            {/* Box 4: Quận/Huyện — cascades from Tỉnh via vn-provinces */}
            <div className="flex-1 min-w-[130px]">
              <select
                value={quanHuyen}
                onChange={e => handleQuanHuyenChange(e.target.value)}
                disabled={!tinh || geoLoading}
                className={cls + (!tinh ? ' opacity-50' : '')}
              >
                <option value="">{tinh ? 'Tất cả Q/H' : 'Chọn Tỉnh trước'}</option>
                {quanHuyenOptions.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            {/* Box 5: Phường/Xã — cascades from Q/H via vn-provinces */}
            <div className="flex-1 min-w-[130px]">
              <select
                value={phuongXa}
                onChange={e => setPhuongXa(e.target.value)}
                disabled={!quanHuyen || geoLoading}
                className={cls + (!quanHuyen ? ' opacity-50' : '')}
              >
                <option value="">{quanHuyen ? 'Tất cả P/X' : 'Chọn Q/H trước'}</option>
                {phuongXaOptions.map(w => (
                  <option key={w} value={w}>{w}</option>
                ))}
              </select>
            </div>

            {/* Box 6: Loại cơ sở */}
            <div className="flex-1 min-w-[110px]">
              <select value={loaiCoSo} onChange={e => setLoaiCoSo(e.target.value)} className={cls}>
                <option value="">Tất cả loại</option>
                {data.cust_class_options.map(c => (
                  <option key={`${c.cust_class_key}||${c.cust_class_name}`} value={c.cust_class_key}>
                    {c.cust_class_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Box 7: Định vị */}
            <div className="flex-1 min-w-[100px]">
              <select value={dinhVi} onChange={e => setDinhVi(e.target.value)} className={cls}>
                <option value="">Tất cả</option>
                <option value="yes">Đã định vị</option>
                <option value="no">Chưa định vị</option>
              </select>
            </div>

            {/* Search button */}
            <button
              onClick={handleSearch}
              disabled={loading}
              className="bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white px-4 py-2 rounded-md transition-colors flex items-center gap-2 whitespace-nowrap"
            >
              <Search className="h-4 w-4" />
              <span className="text-sm">Tìm kiếm</span>
            </button>
          </div>
        </div>

        {/* ── Customer table ── */}
        <DataTable<CustomerRow>
          data={customersWithGeo}
          columns={customerColumns}
          exportConfig={{ copy: true, excel: true, csv: true, pdf: true, print: true }}
          exportAllFetcher={fetchAllCustomers}
          totalCount={data.customers.total}
          currentPage={data.customers.page}
          onPageChange={handlePageChange}
          onPrint={handlePrintCustomer}
          showPageSizeDropdown
          showPageJump
        />
        {data.customers.total > 0 && (
          <div className="text-sm text-gray-400 mt-2">
            Showing {showingFrom} to {showingTo} of {data.customers.total} entries
          </div>
        )}
      </SectionHeader>

      {/* Section 3: Doanh số */}
      <SectionHeader
        title={selectedCustomer ? `Doanh số — ${selectedCustomer.name}` : VI.checkCustomers.revenue}
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
            Không có dữ liệu doanh số trong 2025-2026 cho khách hàng này
          </div>
        ) : (
          <DataTable<PivotRow>
            data={pivotRows}
            columns={pivotColumns}
            exportConfig={{ copy: true, excel: true, csv: true, pdf: true, print: true }}
            onPrint={handlePrintCustomer}
            showSearch
            pageSize={500}
            showPageSizeDropdown={false}
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
