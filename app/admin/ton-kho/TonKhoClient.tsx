'use client'

import { useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LabelList,
} from 'recharts'
import type { TonKhoData, TonKhoFilters } from '@/lib/admin/services/ton-kho'
import { KpiCard } from '@/components/admin/KpiCard'
import { DataTable, type DataTableColumn } from '@/components/admin/DataTable'
import { DollarSign, Package, Layers, Search } from 'lucide-react'

// ---------------------------------------------------------------------------
// Constants (consistent with NhapHangClient)
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
// Types
// ---------------------------------------------------------------------------

type ProductRow = {
  product_code: string
  product_name: string
  qty: number
  min_stock: number
  last_import_date: string
  unit_price: number
  total_value: number
}

interface TonKhoClientProps {
  initialData: TonKhoData
  initialFilters: TonKhoFilters
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function HorizontalBarChartCard({
  title,
  data: chartData,
  color,
  label,
}: {
  title: string
  data: Array<{ name: string; value: number }>
  color: string
  label: string
}) {
  return (
    <div className="bg-gray-800 rounded-xl p-4">
      <h3 className="text-sm font-semibold text-gray-300 mb-3">{title}</h3>
      {chartData.length === 0 ? (
        <div className="h-[250px] flex items-center justify-center text-gray-500 text-sm">
          Khong co du lieu
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(250, chartData.length * 30)}>
          <BarChart layout="vertical" data={chartData} margin={{ left: 10, right: 40 }}>
            <CartesianGrid stroke="#374151" strokeDasharray="3 3" />
            <XAxis type="number" tick={AXIS_TICK} tickFormatter={(v) => formatVND(Number(v))} />
            <YAxis
              type="category"
              dataKey="name"
              width={180}
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              tickFormatter={(v) => String(v).length > 25 ? String(v).slice(0, 25) + '...' : String(v)}
            />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              formatter={(value) => [formatVND(Number(value)), label]}
            />
            <Bar dataKey="value" fill={color} name={label}>
              <LabelList
                dataKey="value"
                position="right"
                fill="#9ca3af"
                fontSize={11}
                formatter={((v: unknown) => formatVND(Number(v))) as never}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

function DonutChartCard({
  title,
  data: chartData,
  label,
}: {
  title: string
  data: Array<{ name: string; value: number }>
  label: string
}) {
  const filteredData = chartData.filter(d => d.value > 0)

  return (
    <div className="bg-gray-800 rounded-xl p-4">
      <h3 className="text-sm font-semibold text-gray-300 mb-3">{title}</h3>
      {filteredData.length === 0 ? (
        <div className="h-[280px] flex items-center justify-center text-gray-500 text-sm">
          Khong co du lieu
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={filteredData}
              dataKey="value"
              nameKey="name"
              cx="40%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              label={({ percent }) => `${((percent ?? 0) * 100).toFixed(1)}%`}
              labelLine={false}
            >
              {filteredData.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              formatter={(value) => [formatVND(Number(value)), label]}
            />
            <Legend
              layout="vertical"
              align="right"
              verticalAlign="middle"
              wrapperStyle={{ fontSize: 12 }}
            />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function TonKhoClient({
  initialData,
  initialFilters,
}: TonKhoClientProps) {
  const [data, setData] = useState<TonKhoData>(initialData)
  const [filters, setFilters] = useState<TonKhoFilters>(initialFilters)
  const [loading, setLoading] = useState(false)

  // Derive unique nhom values from products for filter dropdown
  const nhomOptions = Array.from(
    new Set(data.value_by_nhom.map(v => v.name))
  ).sort()

  const handleSearch = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('snapshot_date', filters.snapshot_date)
      if (filters.nhom) params.set('nhom', filters.nhom)
      if (filters.search) params.set('search', filters.search)
      const res = await fetch(`/api/admin/ton-kho?${params.toString()}`)
      if (res.ok) {
        const newData = await res.json()
        setData(newData)
      }
    } finally {
      setLoading(false)
    }
  }

  // DataTable columns
  const columns: DataTableColumn<ProductRow>[] = [
    { key: 'product_code', label: 'Ma san pham', sortable: true },
    { key: 'product_name', label: 'Ten san pham', sortable: true },
    { key: 'qty', label: 'So luong', sortable: true, render: (v) => formatVND(Number(v)) },
    { key: 'min_stock', label: 'Ton min', sortable: true },
    { key: 'last_import_date', label: 'Ngay nhap moi nhat', sortable: true },
    { key: 'unit_price', label: 'Don gia', sortable: true, render: (v) => formatVND(Number(v)) },
    { key: 'total_value', label: 'Thanh tien', sortable: true, render: (v) => formatVND(Number(v)) },
  ]

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-100">Ton kho</h1>
        <p className="text-sm text-gray-400 mt-1">Phan tich ton kho san pham</p>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-4">
        <select
          className="bg-gray-800 text-gray-100 border border-gray-600 rounded-lg px-3 py-2 text-sm min-w-[200px]"
          disabled
        >
          <option>Tat ca NPP</option>
        </select>

        <input
          type="date"
          className="bg-gray-800 text-gray-100 border border-gray-600 rounded-lg px-3 py-2 text-sm"
          value={filters.snapshot_date}
          onChange={(e) => setFilters(f => ({ ...f, snapshot_date: e.target.value }))}
        />

        <select
          className="bg-gray-800 text-gray-100 border border-gray-600 rounded-lg px-3 py-2 text-sm min-w-[200px]"
          value={filters.nhom}
          onChange={(e) => setFilters(f => ({ ...f, nhom: e.target.value }))}
        >
          <option value="">Tat ca nhom</option>
          {nhomOptions.map(nhom => (
            <option key={nhom} value={nhom}>{nhom}</option>
          ))}
        </select>

        <div className="flex items-center gap-2">
          <input
            type="text"
            className="bg-gray-800 text-gray-100 border border-gray-600 rounded-lg px-3 py-2 text-sm min-w-[200px]"
            placeholder="Tim kiem san pham..."
            value={filters.search}
            onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
          />
        </div>

        <button
          onClick={handleSearch}
          disabled={loading}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        >
          <Search className="h-4 w-4" />
          Tim kiem
        </button>
      </div>

      {/* Loading overlay */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-400" />
        </div>
      )}

      {!loading && (
        <>
          {/* 3 KPI cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <KpiCard
              value={formatVND(data.kpis.total_value)}
              label="Tong gia tri ton"
              icon={<DollarSign className="h-5 w-5" />}
              bgColor="bg-blue-500"
              textColor="text-white"
            />
            <KpiCard
              value={formatVND(data.kpis.total_qty)}
              label="Tong so luong"
              icon={<Package className="h-5 w-5" />}
              bgColor="bg-orange-500"
              textColor="text-white"
            />
            <KpiCard
              value={`${data.kpis.sku_in_stock}/${data.kpis.total_sku}`}
              label="So SKU / Tong SKU"
              icon={<Layers className="h-5 w-5" />}
              bgColor="bg-teal-500"
              textColor="text-white"
            />
          </div>

          {/* Row 1: Value charts (2x3 grid) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <HorizontalBarChartCard
              title="Gia tri ton theo nhom"
              data={data.value_by_nhom}
              color={CHART_COLORS[0]}
              label="Gia tri"
            />
            <HorizontalBarChartCard
              title="Gia tri ton theo thuong hieu"
              data={data.value_by_brand}
              color={CHART_COLORS[1]}
              label="Gia tri"
            />
            <DonutChartCard
              title="Gia tri ton theo nganh hang"
              data={data.value_by_category}
              label="Gia tri"
            />
          </div>

          {/* Row 2: Quantity charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <HorizontalBarChartCard
              title="So luong ton theo nhom"
              data={data.qty_by_nhom}
              color={CHART_COLORS[2]}
              label="So luong"
            />
            <HorizontalBarChartCard
              title="So luong ton theo thuong hieu"
              data={data.qty_by_brand}
              color={CHART_COLORS[3]}
              label="So luong"
            />
            <DonutChartCard
              title="So luong ton theo nganh hang"
              data={data.qty_by_category}
              label="So luong"
            />
          </div>

          {/* DataTable section */}
          <div>
            <h2 className="text-lg font-semibold text-gray-100 mb-4">Danh sach san pham ton kho</h2>
            <DataTable
              data={data.products as unknown as Record<string, unknown>[]}
              columns={columns as unknown as DataTableColumn<Record<string, unknown>>[]}
              exportConfig={{ copy: true, excel: true }}
              showSearch={true}
              searchPlaceholder="Tim kiem san pham..."
              pageSize={10}
            />
          </div>
        </>
      )}
    </div>
  )
}
