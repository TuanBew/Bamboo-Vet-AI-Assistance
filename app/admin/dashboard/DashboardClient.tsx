'use client'

import { useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  BarChart, Bar, ComposedChart, Area, Line, LineChart,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import type { DashboardData, DashboardFilters } from '@/lib/admin/services/dashboard'
import { SectionHeader } from '@/components/admin/SectionHeader'
import { KpiCard } from '@/components/admin/KpiCard'
import { VI } from '@/lib/i18n/vietnamese'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CHART_COLORS = ['#06b6d4', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#6366f1']
const AXIS_TICK = { fill: '#9ca3af', fontSize: 12 }
const TOOLTIP_STYLE = { backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '6px' }
const GRID_STYLE = { stroke: '#374151', strokeDasharray: '3 3' }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatVND(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return n.toLocaleString('vi-VN')
}

// ---------------------------------------------------------------------------
// Mini Donut component (reused for 6 pie charts)
// ---------------------------------------------------------------------------

function MiniDonut({ title, data }: { title: string; data: Array<{ name: string; value: number }> }) {
  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h4 className="text-xs text-gray-400 mb-2">{title}</h4>
      {data.length > 0 ? (
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={70}>
              {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
            </Pie>
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => formatVND(Number(v))} />
            <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
          </PieChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-[180px] flex items-center justify-center">
          <p className="text-xs text-gray-500">{VI.dashboard.noData}</p>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface Props {
  initialData: DashboardData
  initialFilters: DashboardFilters
}

export function DashboardClient({ initialData, initialFilters }: Props) {
  const router = useRouter()
  const [data, setData] = useState(initialData)
  const [filters, setFilters] = useState(initialFilters)
  const [loading, setLoading] = useState(false)

  // Parse month for display
  const [displayYear, displayMonth] = filters.month.split('-').map(Number)
  const monthLabel = `${String(displayMonth).padStart(2, '0')}-${displayYear}`

  // --- Search handler (button click, NOT onChange) ---
  const handleSearch = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filters.npp) params.set('npp', filters.npp)
    params.set('month', filters.month)
    if (filters.nganhHang) params.set('nganhHang', filters.nganhHang)
    if (filters.thuongHieu) params.set('thuongHieu', filters.thuongHieu)
    params.set('kenh', filters.kenh)
    router.push(`/admin/dashboard?${params.toString()}`)
    try {
      const res = await fetch(`/api/admin/dashboard?${params.toString()}`)
      if (res.ok) setData(await res.json())
    } finally {
      setLoading(false)
    }
  }, [filters, router])

  // --- Tong Quan: yearly chart data ---
  const yearlyChartData = useMemo(() =>
    data.yearly_series.map(d => ({
      year: String(d.year),
      nhap_hang: d.nhap_hang,
      ban_hang: d.ban_hang,
    })),
    [data.yearly_series],
  )

  // --- Tong Quan: forecast chart data with bridge point ---
  const forecastChartData = useMemo(() => {
    return data.monthly_series.map((d, idx, arr) => {
      const label = `${String(d.year).slice(2)}/${String(d.month).padStart(2, '0')}`
      const isLastReal = !d.is_forecast && idx < arr.length - 1 && arr[idx + 1].is_forecast

      return {
        label,
        ban_real: d.is_forecast ? null : d.ban_hang,
        nhap_real: d.is_forecast ? null : d.nhap_hang,
        // Bridge: last real point also gets forecast value so dashed line connects
        ban_forecast: d.is_forecast ? d.ban_hang : isLastReal ? d.ban_hang : null,
        nhap_forecast: d.is_forecast ? d.nhap_hang : isLastReal ? d.nhap_hang : null,
      }
    })
  }, [data.monthly_series])

  // --- Chi So Tap Trung: metrics items for progress bars ---
  const metricsItems = useMemo(() => {
    const mb = data.metrics_box
    return [
      { label: VI.dashboard.importLabel, value: mb.nhap_hang, max: Math.max(mb.nhap_hang, mb.ban_hang) || 1, formatted: formatVND(mb.nhap_hang), color: 'bg-blue-500' },
      { label: VI.dashboard.salesLabel, value: mb.ban_hang, max: Math.max(mb.nhap_hang, mb.ban_hang) || 1, formatted: formatVND(mb.ban_hang), color: 'bg-cyan-500' },
      { label: VI.dashboard.customersLabel, value: mb.customers_active, max: mb.customers_total || 1, formatted: `${mb.customers_active}/${mb.customers_total}`, color: 'bg-green-500' },
      { label: VI.dashboard.skuLabel, value: mb.sku_sold, max: mb.sku_total || 1, formatted: `${mb.sku_sold}/${mb.sku_total}`, color: 'bg-amber-500' },
      { label: VI.dashboard.staffLabel, value: mb.nhan_vien, max: mb.nhan_vien || 1, formatted: String(mb.nhan_vien), color: 'bg-purple-500' },
    ]
  }, [data.metrics_box])

  // --- KPI YoY delta calculation ---
  const kpiCards = useMemo(() => {
    const k = data.kpi_row
    const deltaNhap = k.tong_nhap_prev_year > 0
      ? ((k.tong_nhap - k.tong_nhap_prev_year) / k.tong_nhap_prev_year * 100).toFixed(1)
      : null
    const deltaBan = k.tong_ban_prev_year > 0
      ? ((k.tong_ban - k.tong_ban_prev_year) / k.tong_ban_prev_year * 100).toFixed(1)
      : null

    return [
      { label: VI.dashboard.totalImport, value: formatVND(k.tong_nhap), delta: deltaNhap },
      { label: VI.dashboard.totalSales, value: formatVND(k.tong_ban), delta: deltaBan },
      { label: VI.dashboard.salesPerPromo, value: `${k.sl_ban} / ${k.sl_km}`, delta: null },
      { label: VI.dashboard.avgPerOrder, value: formatVND(k.avg_per_order), delta: null },
    ]
  }, [data.kpi_row])

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* ================================================================= */}
      {/* Filter Bar — 5 selects + Search button                            */}
      {/* ================================================================= */}
      <div className="flex flex-wrap gap-3 items-end">
        {/* NPP */}
        <select
          value={filters.npp}
          onChange={(e) => setFilters(f => ({ ...f, npp: e.target.value }))}
          className="bg-gray-800 text-white border border-gray-600 rounded-md px-3 py-2 text-sm"
        >
          <option value="">{VI.dashboard.allNpp}</option>
          {data.npp_list.map(n => (
            <option key={n.id} value={n.id}>{n.name}</option>
          ))}
        </select>

        {/* Month */}
        <input
          type="month"
          value={filters.month}
          onChange={(e) => setFilters(f => ({ ...f, month: e.target.value }))}
          className="bg-gray-800 text-white border border-gray-600 rounded-md px-3 py-2 text-sm"
        />

        {/* Nganh hang */}
        <select
          value={filters.nganhHang}
          onChange={(e) => setFilters(f => ({ ...f, nganhHang: e.target.value }))}
          className="bg-gray-800 text-white border border-gray-600 rounded-md px-3 py-2 text-sm"
        >
          <option value="">{VI.dashboard.allNganhHang}</option>
          {data.filter_options.nganh_hang.map(v => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>

        {/* Thuong hieu */}
        <select
          value={filters.thuongHieu}
          onChange={(e) => setFilters(f => ({ ...f, thuongHieu: e.target.value }))}
          className="bg-gray-800 text-white border border-gray-600 rounded-md px-3 py-2 text-sm"
        >
          <option value="">{VI.dashboard.allThuongHieu}</option>
          {data.filter_options.thuong_hieu.map(v => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>

        {/* Kenh */}
        <select
          value={filters.kenh}
          onChange={(e) => setFilters(f => ({ ...f, kenh: e.target.value }))}
          className="bg-gray-800 text-white border border-gray-600 rounded-md px-3 py-2 text-sm"
        >
          <option value="">{VI.dashboard.allKenh}</option>
          <option value="le">{VI.dashboard.kenhLe}</option>
          <option value="si">{VI.dashboard.kenhSi}</option>
        </select>

        {/* Search button */}
        <button
          onClick={handleSearch}
          disabled={loading}
          className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50"
        >
          {loading ? '...' : VI.dashboard.searchBtn}
        </button>
      </div>

      {/* ================================================================= */}
      {/* Section 2: Tong Quan                                              */}
      {/* ================================================================= */}
      <SectionHeader title={VI.dashboard.overview}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Yearly grouped BarChart */}
          <div className="bg-gray-800 rounded-xl p-4">
            <h3 className="text-sm font-medium text-gray-300 mb-3">
              {VI.dashboard.yearlyImportExport}
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={yearlyChartData}>
                <CartesianGrid {...GRID_STYLE} />
                <XAxis dataKey="year" tick={AXIS_TICK} />
                <YAxis tick={AXIS_TICK} tickFormatter={(v) => formatVND(v)} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => formatVND(Number(v))} />
                <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
                <Bar dataKey="nhap_hang" name={VI.dashboard.importLabel} fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="ban_hang" name={VI.dashboard.salesLabel} fill="#06b6d4" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Forecast ComposedChart */}
          <div className="bg-gray-800 rounded-xl p-4">
            <h3 className="text-sm font-medium text-gray-300 mb-3">
              {VI.dashboard.monthlyForecast}
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <ComposedChart data={forecastChartData}>
                <CartesianGrid {...GRID_STYLE} />
                <XAxis dataKey="label" tick={AXIS_TICK} interval="preserveStartEnd" />
                <YAxis tick={AXIS_TICK} tickFormatter={(v) => formatVND(v)} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => formatVND(Number(v))} />
                <Area
                  type="monotone"
                  dataKey="ban_real"
                  name={VI.dashboard.salesLabel}
                  fill="#06b6d4"
                  fillOpacity={0.3}
                  stroke="#06b6d4"
                  connectNulls={false}
                />
                <Area
                  type="monotone"
                  dataKey="nhap_real"
                  name={VI.dashboard.importLabel}
                  fill="#3b82f6"
                  fillOpacity={0.2}
                  stroke="#3b82f6"
                  connectNulls={false}
                />
                <Line
                  type="monotone"
                  dataKey="ban_forecast"
                  stroke="#06b6d4"
                  strokeDasharray="4 4"
                  strokeOpacity={0.7}
                  dot={false}
                  connectNulls
                  legendType="none"
                />
                <Line
                  type="monotone"
                  dataKey="nhap_forecast"
                  stroke="#3b82f6"
                  strokeDasharray="4 4"
                  strokeOpacity={0.7}
                  dot={false}
                  connectNulls
                  legendType="none"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </SectionHeader>

      {/* ================================================================= */}
      {/* Section 3: Chi So Tap Trung                                       */}
      {/* ================================================================= */}
      <SectionHeader title={`${VI.dashboard.focusMetrics} ${monthLabel}`}>
        {/* Row 1: Daily line chart + Metrics progress box */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          {/* Daily doanh so line chart */}
          <div className="bg-gray-800 rounded-xl p-4">
            <h3 className="text-sm font-medium text-gray-300 mb-3">
              {VI.dashboard.dailySalesMonth}
            </h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={data.daily_series}>
                <CartesianGrid {...GRID_STYLE} />
                <XAxis dataKey="day" tick={AXIS_TICK} />
                <YAxis tick={AXIS_TICK} tickFormatter={(v) => formatVND(v)} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => formatVND(Number(v))} />
                <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
                <Line type="monotone" dataKey="ban_hang" name={VI.dashboard.salesLabel} stroke="#06b6d4" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="nhap_hang" name={VI.dashboard.importLabel} stroke="#3b82f6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Metrics box with 5 progress bars */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-300 mb-3">
              {VI.dashboard.metricsBox}
            </h3>
            <div className="space-y-4 mt-2">
              {metricsItems.map((item) => {
                const pct = item.max > 0 ? Math.min((item.value / item.max) * 100, 100) : 0
                return (
                  <div key={item.label} className="flex items-center gap-3">
                    <span className="text-xs text-gray-400 w-24 shrink-0">{item.label}</span>
                    <div className="flex-1 bg-gray-700 rounded-full h-2">
                      <div className={`h-2 rounded-full ${item.color}`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-sm text-white font-medium w-20 text-right">{item.formatted}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Row 2: 3 nhap pie charts */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <MiniDonut title={`${VI.dashboard.nhapShareMonth} ${monthLabel} - ${VI.dashboard.byNganh}`} data={data.pie_nhap.by_nganh} />
          <MiniDonut title={`${VI.dashboard.nhapShareMonth} ${monthLabel} - ${VI.dashboard.byNhom}`} data={data.pie_nhap.by_nhom} />
          <MiniDonut title={`${VI.dashboard.nhapShareMonth} ${monthLabel} - ${VI.dashboard.byThuongHieu}`} data={data.pie_nhap.by_thuong_hieu} />
        </div>

        {/* Row 3: 3 ban pie charts */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <MiniDonut title={`${VI.dashboard.banShareMonth} ${monthLabel} - ${VI.dashboard.byNganh}`} data={data.pie_ban.by_nganh} />
          <MiniDonut title={`${VI.dashboard.banShareMonth} ${monthLabel} - ${VI.dashboard.byNhom}`} data={data.pie_ban.by_nhom} />
          <MiniDonut title={`${VI.dashboard.banShareMonth} ${monthLabel} - ${VI.dashboard.byThuongHieu}`} data={data.pie_ban.by_thuong_hieu} />
        </div>

        {/* Row 4: 4 KPI big numbers with YoY delta badges */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {kpiCards.map((card) => (
            <div key={card.label} className="relative">
              <KpiCard
                value={card.value}
                label={card.label}
                bgColor="bg-gray-800"
              />
              {card.delta !== null && (
                <span className={`absolute top-2 right-2 text-xs font-medium px-1.5 py-0.5 rounded ${
                  Number(card.delta) >= 0
                    ? 'bg-green-900/60 text-green-400'
                    : 'bg-red-900/60 text-red-400'
                }`}>
                  {Number(card.delta) >= 0 ? '+' : ''}{card.delta}% {VI.dashboard.yoyDelta}
                </span>
              )}
            </div>
          ))}
        </div>
      </SectionHeader>

      {/* Nhan Vien section -- added in plan 04 */}
      {/* Khach Hang section -- added in plan 04 */}
      {/* Top 10 section -- added in plan 04 */}
    </div>
  )
}
