'use client'

import { useState, useCallback, useRef } from 'react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
} from 'recharts'
import type { KhachHangData, KhachHangFilters } from '@/lib/admin/services/khach-hang'
import { SectionHeader } from '@/components/admin/SectionHeader'
import { KpiCard } from '@/components/admin/KpiCard'
import { MapView } from '@/components/admin/MapView'
import type { MapHandle } from '@/components/admin/MapView'
import { VI } from '@/lib/i18n/vietnamese'
import { getCustomerTypeConfig } from '@/lib/admin/customer-types'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TOOLTIP_STYLE = {
  backgroundColor: '#111827',
  border: '1px solid #374151',
  color: 'white',
}

const AXIS_TICK = { fill: '#9ca3af', fontSize: 12 }

// ---------------------------------------------------------------------------
// Customer type SVG icon component (table cells)
// ---------------------------------------------------------------------------

function CustomerTypeIcon({ typeCode, size = 22 }: { typeCode: string; size?: number }) {
  const cfg = getCustomerTypeConfig(typeCode)
  return (
    <div
      className="inline-flex items-center justify-center rounded-md"
      style={{ width: size, height: size, backgroundColor: cfg.color }}
      title={cfg.label}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        width={size * 0.65}
        height={size * 0.65}
        fill="white"
      >
        <path d={cfg.svgPath} />
      </svg>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface KhachHangClientProps {
  initialData: KhachHangData
  initialFilters: KhachHangFilters
}

export function KhachHangClient({ initialData, initialFilters }: KhachHangClientProps) {
  const [data, setData] = useState<KhachHangData>(initialData)
  const [npp, setNpp] = useState(initialFilters.npp)
  const [loading, setLoading] = useState(false)
  const [activeMapType, setActiveMapType] = useState<string | null>(null)
  const mapHandleRef = useRef<MapHandle | null>(null)
  const mapSectionRef = useRef<HTMLDivElement>(null)

  const handleNppChange = useCallback(async (newNpp: string) => {
    setNpp(newNpp)
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/khach-hang?npp=${encodeURIComponent(newNpp)}`)
      if (res.ok) {
        const newData = await res.json()
        setData(newData)
      }
    } catch (err) {
      console.error('Failed to fetch khach-hang data:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  // Build map pins from geo_points, optionally filtered by type
  const mapPins = data.geo_points
    .filter(pt => !activeMapType || pt.cust_class_key === activeMapType)
    .map(pt => ({
      id: pt.customer_key,
      latitude: pt.lat,
      longitude: pt.lng,
      label: pt.customer_name,
      popupContent: `${pt.cust_class_name} · ${pt.province}${pt.address ? ' · ' + pt.address : ''}`,
      customerTypeCode: pt.cust_class_key,
    }))

  const handleTypeIconClick = (typeCode: string) => {
    const next = activeMapType === typeCode ? null : typeCode
    setActiveMapType(next)
    // Scroll to map section
    mapSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className={`space-y-6 ${loading ? 'opacity-60 pointer-events-none' : ''}`}>
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-100">{VI.khachHang.title}</h1>
        <p className="text-sm text-gray-400 mt-1">{VI.khachHang.subtitle}</p>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3">
        <select
          value={npp}
          onChange={(e) => handleNppChange(e.target.value)}
          className="bg-gray-800 text-gray-100 border border-gray-600 rounded-lg px-3 py-2 text-sm"
        >
          <option value="">{VI.khachHang.allNpp}</option>
          {data.npp_options.map(opt => (
            <option key={opt.code} value={opt.code}>{opt.name}</option>
          ))}
        </select>
      </div>

      {/* 3 chart panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Panel 1: Khach hang moi theo thang — LineChart */}
        <div className="bg-gray-800 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-teal-400 uppercase tracking-wider mb-3">
            {VI.khachHang.newCustomersByMonth}
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={data.new_by_month}>
              <CartesianGrid stroke="#374151" strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={AXIS_TICK} />
              <YAxis tick={AXIS_TICK} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Line
                type="monotone"
                dataKey="count"
                stroke="#06b6d4"
                strokeWidth={2}
                dot={{ r: 3 }}
                name={VI.khachHang.newCustomers}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Panel 2: By province — Vertical BarChart */}
        <div className="bg-gray-800 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-teal-400 uppercase tracking-wider mb-3">
            {VI.khachHang.customersByProvince}
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.by_province}>
              <CartesianGrid stroke="#374151" strokeDasharray="3 3" />
              <XAxis
                dataKey="name"
                tick={{ ...AXIS_TICK, fontSize: 10 }}
                angle={-45}
                textAnchor="end"
                height={70}
              />
              <YAxis tick={AXIS_TICK} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Bar dataKey="count" fill="#3b82f6" name={VI.khachHang.customers} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Panel 3: By district — Horizontal BarChart (full width) */}
      <div className="bg-gray-800 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-teal-400 uppercase tracking-wider mb-3">
          {VI.khachHang.customersByDistrict}
        </h3>
        <ResponsiveContainer width="100%" height={Math.max(280, data.by_district.length * 26)}>
          <BarChart layout="vertical" data={data.by_district} margin={{ left: 10, right: 50 }}>
            <CartesianGrid stroke="#374151" strokeDasharray="3 3" />
            <XAxis type="number" tick={AXIS_TICK} />
            <YAxis
              type="category"
              dataKey="name"
              width={160}
              tick={{ fill: '#9ca3af', fontSize: 11 }}
            />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Bar dataKey="count" fill="#10b981" name={VI.khachHang.customers}>
              <LabelList dataKey="count" position="right" fill="#9ca3af" fontSize={11} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ============================================================
          Tất cả khách hàng section
          ============================================================ */}
      <SectionHeader title={VI.khachHang.allCustomers} defaultOpen={true}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <KpiCard
            value={data.all_customers.kpis.total}
            label={VI.khachHang.totalCustomers}
            bgColor="bg-teal-600"
            textColor="text-white"
          />
          <KpiCard
            value={`${data.all_customers.kpis.mapped_pct.toFixed(1)}%`}
            label={VI.khachHang.mapped}
            bgColor="bg-blue-600"
            textColor="text-white"
          />
          <KpiCard
            value={`${data.all_customers.kpis.geo_pct.toFixed(1)}%`}
            label={VI.khachHang.geoLocated}
            bgColor="bg-green-600"
            textColor="text-white"
          />
          <KpiCard
            value={data.all_customers.kpis.type_count}
            label={VI.khachHang.storeTypes}
            bgColor="bg-purple-600"
            textColor="text-white"
          />
        </div>

        <div className="bg-gray-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-900">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">{VI.khachHang.typeCode}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">{VI.khachHang.icon}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">{VI.khachHang.typeName}</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-300 uppercase">{VI.khachHang.count}</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-300 uppercase">{VI.khachHang.pctHeader}</th>
              </tr>
            </thead>
            <tbody>
              {data.all_customers.breakdown.map(row => {
                const cfg = getCustomerTypeConfig(row.type_code)
                const isActive = activeMapType === row.type_code
                return (
                  <tr key={row.type_code} className="border-b border-gray-700 text-sm text-gray-200 hover:bg-gray-750">
                    <td className="px-4 py-3 font-mono">{row.type_code}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleTypeIconClick(row.type_code)}
                        title={`Xem ${cfg.label} trên bản đồ`}
                        className={`rounded-md transition-all cursor-pointer ${isActive ? 'ring-2 ring-white scale-110' : 'hover:scale-110'}`}
                        style={{ display: 'inline-flex', padding: 2 }}
                      >
                        <CustomerTypeIcon typeCode={row.type_code} size={24} />
                      </button>
                    </td>
                    <td className="px-4 py-3">{cfg.label}</td>
                    <td className="px-4 py-3 text-right font-semibold">{row.count.toLocaleString('vi-VN')}</td>
                    <td className="px-4 py-3 text-right">{row.pct.toFixed(1)}%</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </SectionHeader>

      {/* ============================================================
          Khách hàng từng mua hàng section
          ============================================================ */}
      <SectionHeader title={VI.khachHang.purchasingCustomers} defaultOpen={true}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <KpiCard
            value={data.purchasing_customers.kpis.total_count}
            label={VI.khachHang.hasOrders}
            bgColor="bg-teal-600"
            textColor="text-white"
          />
          <KpiCard
            value={`${data.purchasing_customers.kpis.mapped_pct.toFixed(1)}%`}
            label={VI.khachHang.mapped}
            bgColor="bg-blue-600"
            textColor="text-white"
          />
          <KpiCard
            value={`${data.purchasing_customers.kpis.geo_pct.toFixed(1)}%`}
            label={VI.khachHang.geoLocated}
            bgColor="bg-green-600"
            textColor="text-white"
          />
          <KpiCard
            value={data.purchasing_customers.kpis.type_count}
            label={VI.khachHang.storeTypes}
            bgColor="bg-purple-600"
            textColor="text-white"
          />
        </div>

        <div className="bg-gray-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-900">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">{VI.khachHang.typeCode}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">{VI.khachHang.icon}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">{VI.khachHang.typeName}</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-300 uppercase">{VI.khachHang.count}</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-300 uppercase">{VI.khachHang.pctTotal}</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-300 uppercase">{VI.khachHang.pctActive}</th>
              </tr>
            </thead>
            <tbody>
              {data.purchasing_customers.breakdown.map(row => {
                const cfg = getCustomerTypeConfig(row.type_code)
                const isActive = activeMapType === row.type_code
                return (
                  <tr key={row.type_code} className="border-b border-gray-700 text-sm text-gray-200 hover:bg-gray-750">
                    <td className="px-4 py-3 font-mono">{row.type_code}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleTypeIconClick(row.type_code)}
                        title={`Xem ${cfg.label} trên bản đồ`}
                        className={`rounded-md transition-all cursor-pointer ${isActive ? 'ring-2 ring-white scale-110' : 'hover:scale-110'}`}
                        style={{ display: 'inline-flex', padding: 2 }}
                      >
                        <CustomerTypeIcon typeCode={row.type_code} size={24} />
                      </button>
                    </td>
                    <td className="px-4 py-3">{cfg.label}</td>
                    <td className="px-4 py-3 text-right font-semibold">{row.count.toLocaleString('vi-VN')}</td>
                    <td className="px-4 py-3 text-right">{row.pct_of_total.toFixed(1)}%</td>
                    <td className="px-4 py-3 text-right">{row.pct_of_active.toFixed(1)}%</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </SectionHeader>

      {/* ============================================================
          Map section — store locations
          ============================================================ */}
      <div ref={mapSectionRef} className="bg-gray-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-teal-400 uppercase tracking-wider">
            {VI.khachHang.mapTitle}
          </h3>
          <div className="flex items-center gap-2 flex-wrap">
            {activeMapType && (
              <button
                onClick={() => setActiveMapType(null)}
                className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 px-3 py-1 rounded-full transition-colors"
              >
                Xem tất cả ({data.geo_points.length} điểm)
              </button>
            )}
            <span className="text-xs text-gray-400">
              {activeMapType
                ? `${mapPins.length} ${getCustomerTypeConfig(activeMapType).label}`
                : `${mapPins.length} khách hàng có định vị`}
            </span>
          </div>
        </div>

        {/* Type legend */}
        <div className="flex flex-wrap gap-2 mb-3">
          {data.all_customers.breakdown
            .filter(r => r.count > 0)
            .map(row => {
              const cfg = getCustomerTypeConfig(row.type_code)
              const isActive = activeMapType === row.type_code
              return (
                <button
                  key={row.type_code}
                  onClick={() => handleTypeIconClick(row.type_code)}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs transition-all ${
                    isActive
                      ? 'ring-2 ring-white bg-gray-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  <CustomerTypeIcon typeCode={row.type_code} size={14} />
                  <span>{cfg.label}</span>
                  <span className="text-gray-400">({row.count})</span>
                </button>
              )
            })}
        </div>

        <MapView
          pins={mapPins}
          center={[16.0, 106.0]}
          zoom={6}
          className="rounded-lg overflow-hidden"
          onMapReady={(handle) => { mapHandleRef.current = handle }}
        />
      </div>

      {/* So luong cua hieu thuc pham >300K section */}
      <SectionHeader title={VI.khachHang.highValueStores} defaultOpen={false}>
        <div className="bg-gray-800 rounded-xl p-8 text-center text-gray-400 text-sm">
          {VI.khachHang.noHighValueStores}
        </div>
      </SectionHeader>
    </div>
  )
}
