'use client'

import { useState } from 'react'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LabelList,
} from 'recharts'
import type { NhapHangData, NhapHangFilters } from '@/lib/admin/services/nhap-hang'
import { SectionHeader } from '@/components/admin/SectionHeader'
import { KpiCard } from '@/components/admin/KpiCard'
import { NhapHangSkeleton } from './NhapHangSkeleton'
import { Search, Package, ShoppingCart, Gift, FileText, Layers, DollarSign } from 'lucide-react'

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatVND(n: number): string {
  return n.toLocaleString('vi-VN')
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface NhapHangClientProps {
  initialData: NhapHangData
  initialFilters: NhapHangFilters
}

export function NhapHangClient({
  initialData,
  initialFilters,
}: NhapHangClientProps) {
  const [data, setData] = useState<NhapHangData>(initialData)
  const [filters, setFilters] = useState<NhapHangFilters>(initialFilters)
  const [loading, setLoading] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null)

  const handleSearch = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.npp) params.set('npp', filters.npp)
      params.set('year', String(filters.year))
      params.set('month', String(filters.month))
      const res = await fetch(`/api/admin/nhap-hang?${params.toString()}`)
      if (res.ok) {
        const newData = await res.json()
        setData(newData)
      }
    } finally {
      setLoading(false)
    }
  }

  const monthLabel = `${String(filters.month).padStart(2, '0')}/${filters.year}`

  if (loading) {
    return <NhapHangSkeleton />
  }

  return (
    <div className="space-y-6">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-4">
        <select
          className="bg-gray-800 text-gray-100 border border-gray-600 rounded-lg px-3 py-2 text-sm min-w-[250px]"
          value={filters.npp}
          onChange={(e) => setFilters(f => ({ ...f, npp: e.target.value }))}
        >
          <option value="">Tat ca NPP</option>
          {data.suppliers.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>

        <div className="flex items-center gap-2">
          <select
            className="bg-gray-800 text-gray-100 border border-gray-600 rounded-lg px-3 py-2 text-sm"
            value={filters.month}
            onChange={(e) => setFilters(f => ({ ...f, month: parseInt(e.target.value) }))}
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
              <option key={m} value={m}>Thang {m}</option>
            ))}
          </select>

          <select
            className="bg-gray-800 text-gray-100 border border-gray-600 rounded-lg px-3 py-2 text-sm"
            value={filters.year}
            onChange={(e) => setFilters(f => ({ ...f, year: parseInt(e.target.value) }))}
          >
            {[2024, 2025, 2026].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        <button
          onClick={handleSearch}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Search className="h-4 w-4" />
          Tim kiem
        </button>
      </div>

      {/* 6 KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiCard
          value={formatVND(data.kpis.total_revenue)}
          label="Doanh so (0%) / Chi tieu ()"
          icon={<DollarSign className="h-5 w-5" />}
          bgColor="bg-blue-500"
          textColor="text-white"
        />
        <KpiCard
          value={formatVND(data.kpis.total_quantity)}
          label="So luong nhap"
          icon={<ShoppingCart className="h-5 w-5" />}
          bgColor="bg-yellow-500"
          textColor="text-white"
        />
        <KpiCard
          value={formatVND(data.kpis.total_promo_qty)}
          label="SL Khuyen mai"
          icon={<Gift className="h-5 w-5" />}
          bgColor="bg-cyan-500"
          textColor="text-white"
        />
        <KpiCard
          value={data.kpis.total_orders}
          label="Don nhap"
          icon={<FileText className="h-5 w-5" />}
          bgColor="bg-red-400"
          textColor="text-white"
        />
        <KpiCard
          value={data.kpis.total_skus}
          label="SKU nhap"
          icon={<Layers className="h-5 w-5" />}
          bgColor="bg-teal-500"
          textColor="text-white"
        />
        <KpiCard
          value={formatVND(data.kpis.avg_per_order)}
          label="TB / don nhap"
          icon={<Package className="h-5 w-5" />}
          bgColor="bg-purple-500"
          textColor="text-white"
        />
      </div>

      {/* Charts section 1: AreaChart + BarChart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionHeader title={`Doanh so nhap thang ${monthLabel}`}>
          <div className="bg-gray-800 rounded-lg p-4">
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={data.daily_revenue}>
                <CartesianGrid stroke="#374151" strokeDasharray="3 3" />
                <XAxis dataKey="day" tick={AXIS_TICK} />
                <YAxis tick={AXIS_TICK} tickFormatter={(v) => formatVND(Number(v))} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(value) => [formatVND(Number(value)), 'Doanh so']}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#06b6d4"
                  fill="#06b6d4"
                  fillOpacity={0.3}
                  name="Doanh so"
                />
                <Legend />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </SectionHeader>

        <SectionHeader title={`So luong nhap thang ${monthLabel}`}>
          <div className="bg-gray-800 rounded-lg p-4">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data.daily_quantity}>
                <CartesianGrid stroke="#374151" strokeDasharray="3 3" />
                <XAxis dataKey="day" tick={AXIS_TICK} />
                <YAxis tick={AXIS_TICK} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="quantity" fill="#3b82f6" name="SL nhap" />
                <Bar dataKey="promo_qty" fill="#10b981" name="SL KM" />
                <Legend />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionHeader>
      </div>

      {/* Row 3: Orders table + Top 10 products */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionHeader title={`Cac don da nhap trong thang ${monthLabel}`}>
          <div className="bg-gray-800 rounded-lg p-4 overflow-x-auto">
            <table className="w-full text-sm text-gray-100">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-2 px-3">Ma don</th>
                  <th className="text-left py-2 px-3">Ngay nhap</th>
                  <th className="text-right py-2 px-3">Thanh tien</th>
                </tr>
              </thead>
              <tbody>
                {data.orders.map(order => (
                  <tr
                    key={order.order_code}
                    className="border-b border-gray-700/50 hover:bg-gray-700 cursor-pointer transition-colors"
                    onClick={() => setSelectedOrder(order.order_code)}
                  >
                    <td className="py-2 px-3 font-mono">{order.order_code}</td>
                    <td className="py-2 px-3">{order.order_date}</td>
                    <td className="py-2 px-3 text-right">{formatVND(order.total_amount)}</td>
                  </tr>
                ))}
                {data.orders.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-4 text-center text-gray-500">
                      Khong co don nhap trong thang nay
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </SectionHeader>

        <SectionHeader title={`Top 10 san pham nhap thang ${monthLabel}`}>
          <div className="bg-gray-800 rounded-lg p-4">
            <ResponsiveContainer width="100%" height={Math.max(250, data.top_products.length * 30)}>
              <BarChart
                layout="vertical"
                data={data.top_products}
                margin={{ left: 10, right: 40 }}
              >
                <CartesianGrid stroke="#374151" strokeDasharray="3 3" />
                <XAxis type="number" tick={AXIS_TICK} tickFormatter={(v) => formatVND(Number(v))} />
                <YAxis
                  type="category"
                  dataKey="product_name"
                  width={180}
                  tick={{ fill: '#9ca3af', fontSize: 11 }}
                  tickFormatter={(v) => String(v).length > 25 ? String(v).slice(0, 25) + '...' : String(v)}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(value) => [formatVND(Number(value)), 'Doanh so']}
                />
                <Bar dataKey="total_revenue" fill="#06b6d4" name="Doanh so">
                  <LabelList
                    dataKey="total_revenue"
                    position="right"
                    fill="#9ca3af"
                    fontSize={11}
                    formatter={(v) => formatVND(Number(v))}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionHeader>
      </div>

      {/* Charts section 2: Donut charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionHeader title={`Nganh hang thang ${monthLabel}`}>
          <div className="bg-gray-800 rounded-lg p-4">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={data.by_industry.filter(d => d.revenue > 0)}
                  dataKey="revenue"
                  nameKey="name"
                  cx="40%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  label={({ percent }) => `${((percent ?? 0) * 100).toFixed(1)}%`}
                  labelLine={false}
                >
                  {data.by_industry.filter(d => d.revenue > 0).map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(value) => [formatVND(Number(value)), 'Doanh so']}
                />
                <Legend
                  layout="vertical"
                  align="right"
                  verticalAlign="middle"
                  wrapperStyle={{ fontSize: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </SectionHeader>

        <SectionHeader title={`Nhom san pham thang ${monthLabel}`}>
          <div className="bg-gray-800 rounded-lg p-4">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={data.by_product_group.filter(d => d.revenue > 0)}
                  dataKey="revenue"
                  nameKey="name"
                  cx="40%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  label={({ percent }) => `${((percent ?? 0) * 100).toFixed(1)}%`}
                  labelLine={false}
                >
                  {data.by_product_group.filter(d => d.revenue > 0).map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(value) => [formatVND(Number(value)), 'Doanh so']}
                />
                <Legend
                  layout="vertical"
                  align="right"
                  verticalAlign="middle"
                  wrapperStyle={{ fontSize: 11 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </SectionHeader>
      </div>

      {/* Charts section 3: Radar chart (full width) */}
      <SectionHeader title={`Thuong hieu thang ${monthLabel}`}>
        <div className="bg-gray-800 rounded-lg p-4">
          <ResponsiveContainer width="100%" height={350}>
            <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data.by_brand}>
              <PolarGrid stroke="#374151" />
              <PolarAngleAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Radar
                name="Doanh so"
                dataKey="revenue"
                stroke="#06b6d4"
                fill="#06b6d4"
                fillOpacity={0.4}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                formatter={(value) => [formatVND(Number(value)), 'Doanh so']}
              />
              <Legend />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </SectionHeader>

      {/* Order detail drawer */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="bg-black/50 flex-1"
            onClick={() => setSelectedOrder(null)}
          />
          <div className="w-[500px] max-w-full bg-gray-800 p-6 overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-100">
                Chi tiet don {selectedOrder}
              </h3>
              <button
                onClick={() => setSelectedOrder(null)}
                className="text-gray-400 hover:text-white text-xl"
              >
                &times;
              </button>
            </div>

            <table className="w-full text-sm text-gray-100">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-2 px-2">Ten SP</th>
                  <th className="text-right py-2 px-2">SL</th>
                  <th className="text-right py-2 px-2">SL KM</th>
                  <th className="text-right py-2 px-2">Don gia</th>
                  <th className="text-right py-2 px-2">Thanh tien</th>
                </tr>
              </thead>
              <tbody>
                {(data.order_items[selectedOrder] ?? []).map((item, idx) => (
                  <tr key={idx} className="border-b border-gray-700/50">
                    <td className="py-2 px-2">{item.product_name}</td>
                    <td className="py-2 px-2 text-right">{item.quantity}</td>
                    <td className="py-2 px-2 text-right">{item.promo_qty}</td>
                    <td className="py-2 px-2 text-right">{formatVND(item.unit_price)}</td>
                    <td className="py-2 px-2 text-right">{formatVND(item.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setSelectedOrder(null)}
                className="bg-gray-700 hover:bg-gray-600 text-gray-100 px-4 py-2 rounded-lg text-sm"
              >
                Dong
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
