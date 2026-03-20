'use client'

import { useState } from 'react'
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

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CHART_COLORS = [
  '#06b6d4', '#3b82f6', '#10b981', '#f59e0b',
  '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6',
  '#f97316', '#6366f1',
]

const TOOLTIP_STYLE = {
  backgroundColor: '#111827',
  border: '1px solid #374151',
  color: 'white',
}

const AXIS_TICK = { fill: '#9ca3af', fontSize: 12 }

const CUSTOMER_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  TH:    { label: 'Tap hoa',       color: 'bg-green-500' },
  GSO:   { label: 'Bach hoa',      color: 'bg-blue-500' },
  PHA:   { label: 'Nha thuoc',     color: 'bg-red-500' },
  SPS:   { label: 'Me & Be',       color: 'bg-pink-500' },
  BTS:   { label: 'My pham',       color: 'bg-purple-500' },
  OTHER: { label: 'Khac',          color: 'bg-gray-500' },
  PLT:   { label: 'Phu lieu toc',  color: 'bg-yellow-500' },
  WMO:   { label: 'Cho',           color: 'bg-orange-500' },
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatVND(n: number): string {
  return n.toLocaleString('vi-VN')
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

  const handleNppChange = async (newNpp: string) => {
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
  }

  return (
    <div className={`space-y-6 ${loading ? 'opacity-60 pointer-events-none' : ''}`}>
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-100">Khach hang</h1>
        <p className="text-sm text-gray-400 mt-1">Phan tich khach hang theo khu vuc va loai cua hieu</p>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3">
        <select
          value={npp}
          onChange={(e) => handleNppChange(e.target.value)}
          className="bg-gray-800 text-gray-100 border border-gray-600 rounded-lg px-3 py-2 text-sm"
        >
          <option value="">Tat ca NPP</option>
        </select>
      </div>

      {/* 3 chart panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Panel 1: So luong khach hang moi theo thang — LineChart */}
        <div className="bg-gray-800 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-teal-400 uppercase tracking-wider mb-3">
            So luong khach hang moi theo thang
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
                name="Khach hang moi"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Panel 2: So luong khach hang theo tinh — Vertical BarChart */}
        <div className="bg-gray-800 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-teal-400 uppercase tracking-wider mb-3">
            So luong khach hang theo tinh
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.by_province}>
              <CartesianGrid stroke="#374151" strokeDasharray="3 3" />
              <XAxis
                dataKey="name"
                tick={{ ...AXIS_TICK, fontSize: 10 }}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis tick={AXIS_TICK} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Bar dataKey="count" fill="#3b82f6" name="Khach hang" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Panel 3: So luong khach hang theo huyen — Horizontal BarChart (full width) */}
      <div className="bg-gray-800 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-teal-400 uppercase tracking-wider mb-3">
          So luong khach hang theo huyen
        </h3>
        <ResponsiveContainer width="100%" height={Math.max(280, data.by_district.length * 25)}>
          <BarChart layout="vertical" data={data.by_district} margin={{ left: 10, right: 30 }}>
            <CartesianGrid stroke="#374151" strokeDasharray="3 3" />
            <XAxis type="number" tick={AXIS_TICK} />
            <YAxis
              type="category"
              dataKey="name"
              width={150}
              tick={{ fill: '#9ca3af', fontSize: 11 }}
            />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Bar dataKey="count" fill="#10b981" name="Khach hang">
              <LabelList dataKey="count" position="right" fill="#9ca3af" fontSize={11} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Tat ca khach hang section */}
      <SectionHeader title="Tat ca khach hang" defaultOpen={true}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <KpiCard
            value={data.all_customers.kpis.active_count}
            label="Con hoat dong"
            bgColor="bg-teal-600"
            textColor="text-white"
          />
          <KpiCard
            value={`${data.all_customers.kpis.mapped_pct.toFixed(1)}%`}
            label="Da phan tuyen"
            bgColor="bg-blue-600"
            textColor="text-white"
          />
          <KpiCard
            value={`${data.all_customers.kpis.geo_pct.toFixed(1)}%`}
            label="Da dinh vi"
            bgColor="bg-green-600"
            textColor="text-white"
          />
          <KpiCard
            value={data.all_customers.kpis.type_count}
            label="So loai cua hieu"
            bgColor="bg-purple-600"
            textColor="text-white"
          />
        </div>

        <div className="bg-gray-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-900">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">Ma</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">Icon</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">Loai cua hieu</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-300 uppercase">So luong</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-300 uppercase">%</th>
              </tr>
            </thead>
            <tbody>
              {data.all_customers.breakdown.map(row => (
                <tr key={row.type_code} className="border-b border-gray-700 text-sm text-gray-200">
                  <td className="px-4 py-3">{row.type_code}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block w-3 h-3 rounded-sm ${CUSTOMER_TYPE_CONFIG[row.type_code]?.color || 'bg-gray-500'}`} />
                  </td>
                  <td className="px-4 py-3">{row.type_name}</td>
                  <td className="px-4 py-3 text-right">{row.count}</td>
                  <td className="px-4 py-3 text-right">{row.pct.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionHeader>

      {/* Khach hang dang mua hang section */}
      <SectionHeader title="Khach hang dang mua hang" defaultOpen={true}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <KpiCard
            value={data.purchasing_customers.kpis.total_with_orders}
            label="Co don hang"
            bgColor="bg-teal-600"
            textColor="text-white"
          />
          <KpiCard
            value={`${data.purchasing_customers.kpis.mapped_pct.toFixed(1)}%`}
            label="Da phan tuyen"
            bgColor="bg-blue-600"
            textColor="text-white"
          />
          <KpiCard
            value={`${data.purchasing_customers.kpis.geo_pct.toFixed(1)}%`}
            label="Da dinh vi"
            bgColor="bg-green-600"
            textColor="text-white"
          />
          <KpiCard
            value={data.purchasing_customers.kpis.type_count}
            label="So loai cua hieu"
            bgColor="bg-purple-600"
            textColor="text-white"
          />
        </div>

        <div className="bg-gray-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-900">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">Ma</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">Icon</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">Loai cua hieu</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-300 uppercase">So luong</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-300 uppercase">% theo Tong KH</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-300 uppercase">% theo KH con hoat dong</th>
              </tr>
            </thead>
            <tbody>
              {data.purchasing_customers.breakdown.map(row => (
                <tr key={row.type_code} className="border-b border-gray-700 text-sm text-gray-200">
                  <td className="px-4 py-3">{row.type_code}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block w-3 h-3 rounded-sm ${CUSTOMER_TYPE_CONFIG[row.type_code]?.color || 'bg-gray-500'}`} />
                  </td>
                  <td className="px-4 py-3">{row.type_name}</td>
                  <td className="px-4 py-3 text-right">{row.count}</td>
                  <td className="px-4 py-3 text-right">{row.pct_of_total.toFixed(1)}%</td>
                  <td className="px-4 py-3 text-right">{row.pct_of_active.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionHeader>

      {/* So luong cua hieu thuc pham >300K section */}
      <SectionHeader title="So luong cua hieu thuc pham >300K" defaultOpen={false}>
        {data.high_value_stores.length === 0 ? (
          <div className="bg-gray-800 rounded-xl p-8 text-center text-gray-400 text-sm">
            Khong co cua hieu nao co tong gia tri mua hang vuot 300,000 VND
          </div>
        ) : (
          <div className="bg-gray-800 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-900">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">Ma KH</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">Ten cua hieu</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">Loai</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">Tinh</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-300 uppercase">Tong gia tri</th>
                </tr>
              </thead>
              <tbody>
                {data.high_value_stores.map(store => (
                  <tr key={store.customer_code} className="border-b border-gray-700 text-sm text-gray-200">
                    <td className="px-4 py-3">{store.customer_code}</td>
                    <td className="px-4 py-3">{store.customer_name}</td>
                    <td className="px-4 py-3">{CUSTOMER_TYPE_CONFIG[store.customer_type]?.label || store.customer_type}</td>
                    <td className="px-4 py-3">{store.province}</td>
                    <td className="px-4 py-3 text-right">{formatVND(store.total_value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionHeader>
    </div>
  )
}
