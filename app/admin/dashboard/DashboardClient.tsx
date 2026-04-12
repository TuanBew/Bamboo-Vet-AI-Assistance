'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  BarChart, Bar, ComposedChart, Area, Line, LineChart,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts'
import type { DashboardFastData, DashboardSlowData, DashboardFilters } from '@/lib/admin/services/dashboard'
import { SectionHeader } from '@/components/admin/SectionHeader'
import { KpiCard } from '@/components/admin/KpiCard'
import { SparklineChart } from '@/components/admin/SparklineChart'
import { MapView } from '@/components/admin/MapView'
import { VI } from '@/lib/i18n/vietnamese'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CHART_COLORS = ['#06b6d4', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#6366f1']
const AXIS_TICK = { fill: '#9ca3af', fontSize: 12 }
const TOOLTIP_STYLE = { backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '6px' }
const GRID_STYLE = { stroke: '#374151', strokeDasharray: '3 3' }
// Colors for actual cust_class_name values from the door table
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
// Shows top 5 in mini view; "+" button opens full-detail modal
// ---------------------------------------------------------------------------

function MiniDonut({ title, data }: { title: string; data: Array<{ name: string; value: number }> }) {
  const [modalOpen, setModalOpen] = useState(false)

  const total = data.reduce((sum, d) => sum + d.value, 0)
  const sorted = [...data].sort((a, b) => b.value - a.value)
  const top5 = sorted.slice(0, 5)
  const rest = sorted.slice(5)

  // Collapse everything beyond top 5 into a single "Khác" slice
  const displayData = rest.length > 0
    ? [...top5, { name: 'Khác', value: rest.reduce((s, d) => s + d.value, 0) }]
    : top5

  return (
    <div className="bg-gray-800 rounded-lg p-4 relative">
      <h4 className="text-xs text-gray-400 mb-2">{title}</h4>
      {data.length > 0 ? (
        <>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={displayData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={70}>
                {displayData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => formatVND(Number(v))} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
            </PieChart>
          </ResponsiveContainer>
          {/* "+" expand button — only shown when there are more than 5 groups */}
          {sorted.length > 5 && (
            <button
              onClick={() => setModalOpen(true)}
              title="Xem tất cả nhóm"
              className="absolute bottom-3 right-3 w-7 h-7 rounded-full bg-teal-600 hover:bg-teal-500 active:scale-95 transition-all text-white flex items-center justify-center text-base font-bold shadow-lg shadow-teal-900/40 z-10"
            >
              +
            </button>
          )}
        </>
      ) : (
        <div className="h-[180px] flex items-center justify-center">
          <p className="text-xs text-gray-500">{VI.dashboard.noData}</p>
        </div>
      )}

      {/* Full-detail modal overlay */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setModalOpen(false)}
        >
          {/* Blurred backdrop */}
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

          {/* Modal panel */}
          <div
            className="relative bg-[#141925] border border-gray-700/60 rounded-2xl p-6 w-full max-w-[520px] max-h-[85vh] overflow-y-auto shadow-2xl shadow-black/60 ring-1 ring-white/5"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-5 gap-2">
              <h3 className="text-sm font-semibold text-white leading-snug">{title}</h3>
              <button
                onClick={() => setModalOpen(false)}
                className="shrink-0 w-7 h-7 rounded-full bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white flex items-center justify-center text-lg leading-none transition-colors"
              >
                ×
              </button>
            </div>

            {/* Full donut chart — larger, no legend (legend shown below) */}
            <div className="w-full">
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={sorted}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={108}
                    paddingAngle={1}
                  >
                    {sorted.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(v, name) => [formatVND(Number(v)), name]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* All groups with color swatch, value, and percentage */}
            <div className="mt-4 space-y-2 border-t border-gray-700/50 pt-4">
              <p className="text-xs text-gray-500 mb-3 uppercase tracking-wider">Chi tiết các nhóm</p>
              {sorted.map((item, i) => {
                const pct = total > 0 ? (item.value / total * 100).toFixed(1) : '0.0'
                const color = CHART_COLORS[i % CHART_COLORS.length]
                return (
                  <div key={item.name} className="flex items-center gap-3 py-1">
                    <div
                      className="w-2.5 h-2.5 rounded-sm shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-sm text-gray-300 flex-1 truncate" title={item.name}>
                      {item.name}
                    </span>
                    <span className="text-xs text-gray-400 tabular-nums">{formatVND(item.value)}</span>
                    <span
                      className="text-sm font-semibold tabular-nums w-14 text-right"
                      style={{ color }}
                    >
                      {pct}%
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface Props {
  initialData: DashboardFastData
  initialFilters: DashboardFilters
}

export function DashboardClient({ initialData, initialFilters }: Props) {
  const router = useRouter()
  const [data, setData] = useState(initialData)
  const [filters, setFilters] = useState(initialFilters)
  const [loading, setLoading] = useState(false)
  const [slowData, setSlowData] = useState<DashboardSlowData | null>(null)

  // Parse month for display
  const [displayYear, displayMonth] = filters.month.split('-').map(Number)
  const monthLabel = `${String(displayMonth).padStart(2, '0')}-${displayYear}`

  // --- Progressive slow data fetch after mount, re-fetches when filters change ---
  useEffect(() => {
    const params = new URLSearchParams({
      npp: filters.npp,
      month: filters.month,
      nganhHang: filters.nganhHang,
      thuongHieu: filters.thuongHieu,
      kenh: filters.kenh,
      layer: 'slow',
    })

    fetch(`/api/admin/dashboard?${params.toString()}`)
      .then(res => res.json())
      .then((data: DashboardSlowData) => setSlowData(data))
      .catch(() => {/* fail silently — skeletons remain visible */})
  }, [filters])

  // --- Search handler (button click, NOT onChange) ---
  const handleSearch = useCallback(async () => {
    setLoading(true)
    setSlowData(null)
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

  // --- Tong Quan: forecast chart data — show only 2025 + 2026 with bridge point ---
  const forecastChartData = useMemo(() => {
    const visible = data.monthly_series.filter(d => d.year >= 2025)
    return visible.map((d, idx, arr) => {
      const label = `${String(d.year).slice(2)}/${String(d.month).padStart(2, '0')}`
      const isLastReal = !d.is_forecast && idx < arr.length - 1 && arr[idx + 1].is_forecast
      return {
        label,
        ban_real: d.is_forecast ? null : d.ban_hang,
        nhap_real: d.is_forecast ? null : d.nhap_hang,
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

        {/* Month — year + month dual selects, limited to 2022-2026 */}
        <div className="flex gap-1">
          <select
            value={filters.month.split('-')[0]}
            onChange={(e) => setFilters(f => ({ ...f, month: `${e.target.value}-${f.month.split('-')[1]}` }))}
            className="bg-gray-800 text-white border border-gray-600 rounded-md px-2 py-2 text-sm"
          >
            {[2022, 2023, 2024, 2025, 2026].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <select
            value={filters.month.split('-')[1]}
            onChange={(e) => setFilters(f => ({ ...f, month: `${f.month.split('-')[0]}-${e.target.value}` }))}
            className="bg-gray-800 text-white border border-gray-600 rounded-md px-2 py-2 text-sm"
          >
            {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map(m => (
              <option key={m} value={m}>Tháng {Number(m)}</option>
            ))}
          </select>
        </div>

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

        {/* Kenh — dynamic from DB */}
        <select
          value={filters.kenh}
          onChange={(e) => setFilters(f => ({ ...f, kenh: e.target.value }))}
          className="bg-gray-800 text-white border border-gray-600 rounded-md px-3 py-2 text-sm"
        >
          <option value="">{VI.dashboard.allKenh}</option>
          {data.filter_options.kenh_list.map(v => (
            <option key={v} value={v}>{v}</option>
          ))}
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

      {/* ================================================================= */}
      {/* Section 4: Nhan Vien — skeleton until slowData arrives          */}
      {/* ================================================================= */}
      <SectionHeader title={`${VI.dashboard.staffMonth} ${monthLabel}`}>
        {slowData === null ? (
          <>
            <div className="bg-gray-800 rounded-lg p-6 animate-pulse">
              <div className="h-4 bg-gray-700 rounded w-1/3 mb-4" />
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex gap-4 mb-3">
                  <div className="h-3 bg-gray-700 rounded w-32" />
                  <div className="h-3 bg-gray-700 rounded flex-1" />
                  <div className="h-3 bg-gray-700 rounded w-20" />
                  <div className="h-3 bg-gray-700 rounded w-12" />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="bg-gray-800 rounded-lg p-4 h-48 animate-pulse">
                <div className="h-3 bg-gray-700 rounded w-1/2 mb-3" />
                <div className="h-full bg-gray-700 rounded" />
              </div>
              <div className="bg-gray-800 rounded-lg p-4 h-48 animate-pulse">
                <div className="h-3 bg-gray-700 rounded w-1/2 mb-3" />
                <div className="h-full bg-gray-700 rounded" />
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Staff performance table — fixed height, scrollable, sticky header */}
            <div className="bg-gray-800 rounded-lg overflow-hidden">
              <div className="overflow-auto max-h-[560px]">
                <table className="w-full">
                  <thead className="sticky top-0 z-10 bg-gray-900">
                    <tr className="text-gray-400 text-xs uppercase">
                      <th className="px-3 py-2 text-left">{VI.dashboard.staffName}</th>
                      <th className="px-3 py-2 text-left">{VI.dashboard.dailySales}</th>
                      <th className="px-3 py-2 text-right">{VI.dashboard.total}</th>
                      <th className="px-3 py-2 text-right">{VI.dashboard.orders}</th>
                      <th className="px-3 py-2 text-right">{VI.dashboard.average}</th>
                      <th className="px-3 py-2 text-right">{VI.dashboard.customersLabel}</th>
                      <th className="px-3 py-2 text-right">{VI.dashboard.daysOver1m}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {slowData.staff_list.map((staff) => (
                      <tr key={staff.staff_id} className="text-white text-sm border-b border-gray-700">
                        <td className="px-3 py-2">{staff.staff_name}</td>
                        <td className="px-3 py-2">
                          <SparklineChart data={staff.daily_sparkline} width={120} height={30} color="#06b6d4" />
                        </td>
                        <td className="px-3 py-2 text-right font-medium">{formatVND(staff.total_sales)}</td>
                        <td className="px-3 py-2 text-right">{staff.order_count}</td>
                        <td className="px-3 py-2 text-right">{formatVND(staff.avg_per_order)}</td>
                        <td className="px-3 py-2 text-right">{staff.customer_count}</td>
                        <td className="px-3 py-2 text-right">{staff.days_over_1m}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Two stacked horizontal bar charts — scrollable when > 10 staff */}
            <div className="grid grid-cols-2 gap-4 mt-4">
              {/* Chart 1: Ti trong theo nhom */}
              <div className="bg-gray-800 rounded-lg p-4">
                <h4 className="text-xs text-gray-400 mb-2">Tỉ trọng theo nhóm tháng {monthLabel}</h4>
                {/* Scrollable wrapper: fixed viewport height, inner div stretches to full chart height */}
                <div className="overflow-y-auto" style={{ maxHeight: 420 }}>
                  <div style={{ height: Math.max(200, slowData.staff_list.length * 44) }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        layout="vertical"
                        data={slowData.staff_list.map(s => ({
                          name: s.staff_name.length > 14 ? s.staff_name.slice(0, 14) + '…' : s.staff_name,
                          ...s.by_nhom,
                        }))}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis type="number" tick={AXIS_TICK} tickFormatter={(v) => formatVND(Number(v))} />
                        <YAxis type="category" dataKey="name" width={120} tick={{ fill: '#9ca3af', fontSize: 11 }} />
                        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => formatVND(Number(v))} />
                        {[...new Set(slowData.staff_list.flatMap(s => Object.keys(s.by_nhom)))].map((key, i) => (
                          <Bar key={key} dataKey={key} stackId="a" fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Chart 2: Ti trong theo thuong hieu */}
              <div className="bg-gray-800 rounded-lg p-4">
                <h4 className="text-xs text-gray-400 mb-2">Tỉ trọng theo thương hiệu tháng {monthLabel}</h4>
                <div className="overflow-y-auto" style={{ maxHeight: 420 }}>
                  <div style={{ height: Math.max(200, slowData.staff_list.length * 44) }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        layout="vertical"
                        data={slowData.staff_list.map(s => ({
                          name: s.staff_name.length > 14 ? s.staff_name.slice(0, 14) + '…' : s.staff_name,
                          ...s.by_thuong_hieu,
                        }))}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis type="number" tick={AXIS_TICK} tickFormatter={(v) => formatVND(Number(v))} />
                        <YAxis type="category" dataKey="name" width={120} tick={{ fill: '#9ca3af', fontSize: 11 }} />
                        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => formatVND(Number(v))} />
                        {[...new Set(slowData.staff_list.flatMap(s => Object.keys(s.by_thuong_hieu)))].map((key, i) => (
                          <Bar key={key} dataKey={key} stackId="a" fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </SectionHeader>

      {/* ================================================================= */}
      {/* Section 5: Khach Hang — skeleton until slowData arrives        */}
      {/* ================================================================= */}
      <SectionHeader title={`${VI.dashboard.customerMonth} ${monthLabel}`}>
        {slowData === null ? (
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-gray-800 rounded-lg p-4 h-[282px] animate-pulse">
              <div className="h-3 bg-gray-700 rounded w-1/2 mb-3" />
              <div className="rounded-full border-4 border-gray-700 w-32 h-32 mx-auto mt-6" />
            </div>
            <div className="bg-gray-800 rounded-lg p-4 h-[282px] animate-pulse">
              <div className="h-3 bg-gray-700 rounded w-1/2 mb-3" />
              <div className="flex items-end gap-2 h-48 px-2">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="flex-1 bg-gray-700 rounded-t" style={{ height: `${30 + i * 12}%` }} />
                ))}
              </div>
            </div>
            <div className="bg-gray-800 rounded-lg p-4 h-[282px] animate-pulse">
              <div className="h-3 bg-gray-700 rounded w-1/2 mb-3" />
              <div className="h-[250px] bg-gray-700 rounded" />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {/* Col 1 — Radar chart */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h4 className="text-xs text-gray-400 mb-2">{VI.dashboard.salesByStoreType}</h4>
              <ResponsiveContainer width="100%" height={250}>
                <RadarChart data={slowData.customer_section.by_type_sales}>
                  <PolarGrid stroke="#374151" />
                  <PolarAngleAxis dataKey="type" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                  <PolarRadiusAxis tick={{ fill: '#6b7280', fontSize: 10 }} />
                  <Radar dataKey="ban_hang" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.3} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => formatVND(Number(v))} />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            {/* Col 2 — Count bar chart */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h4 className="text-xs text-gray-400 mb-2">{VI.dashboard.countByStoreType}</h4>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={slowData.customer_section.by_type_count}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="type" tick={AXIS_TICK} />
                  <YAxis tick={AXIS_TICK} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Bar dataKey="count" fill="#06b6d4" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Col 3 — Leaflet map */}
            <div className="bg-gray-800 rounded-lg p-4">
              <MapView
                pins={slowData.customer_section.map_pins.map(p => ({
                  id: p.id,
                  latitude: p.latitude,
                  longitude: p.longitude,
                  label: p.label,
                  popupContent: p.popup,
                  customerTypeCode: p.customer_type_code,
                }))}
                className="h-[250px]"
              />
            </div>
          </div>
        )}
      </SectionHeader>

      {/* ================================================================= */}
      {/* Section 6: Top 10 — skeleton until slowData arrives            */}
      {/* ================================================================= */}
      <SectionHeader title={`Top 10 ${monthLabel}`}>
        {slowData === null ? (
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-800 rounded-lg p-4 animate-pulse">
              <div className="h-3 bg-gray-700 rounded w-1/3 mb-4" />
              {[...Array(10)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 mb-2">
                  <div className="h-3 bg-gray-700 rounded w-36 shrink-0" />
                  <div className="h-3 bg-gray-700 rounded" style={{ width: `${100 - i * 8}%` }} />
                </div>
              ))}
            </div>
            <div className="bg-gray-800 rounded-lg p-4 animate-pulse">
              <div className="h-3 bg-gray-700 rounded w-1/3 mb-4" />
              {[...Array(10)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 mb-2">
                  <div className="h-3 bg-gray-700 rounded w-36 shrink-0" />
                  <div className="h-3 bg-gray-700 rounded" style={{ width: `${100 - i * 8}%` }} />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {/* Left — Top 10 Khach hang */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h4 className="text-xs text-gray-400 mb-2">{VI.dashboard.top10Customers}</h4>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart layout="vertical" data={slowData.top10.customers}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis type="number" tick={AXIS_TICK} tickFormatter={(v) => formatVND(Number(v))} />
                  <YAxis type="category" dataKey="name" width={150} tick={{ fill: '#9ca3af', fontSize: 11 }} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => formatVND(Number(v))} />
                  <Bar dataKey="total_value" fill="#06b6d4" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Right — Top 10 San pham */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h4 className="text-xs text-gray-400 mb-2">{VI.dashboard.top10Products}</h4>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart layout="vertical" data={slowData.top10.products}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis type="number" tick={AXIS_TICK} tickFormatter={(v) => formatVND(Number(v))} />
                  <YAxis type="category" dataKey="name" width={150} tick={{ fill: '#9ca3af', fontSize: 11 }} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => formatVND(Number(v))} />
                  <Bar dataKey="total_value" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </SectionHeader>
    </div>
  )
}
