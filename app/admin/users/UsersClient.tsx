'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
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
} from 'recharts'
import { KpiCard } from '@/components/admin/KpiCard'
import { SectionHeader } from '@/components/admin/SectionHeader'
import { FilterBar } from '@/components/admin/FilterBar'
import type { UsersData } from '@/lib/admin/services/users'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CHART_COLORS = [
  '#06b6d4',
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
  '#f97316',
  '#6366f1',
]
const TOOLTIP_STYLE = {
  backgroundColor: '#111827',
  border: '1px solid #374151',
  color: 'white',
}
const AXIS_TICK = { fill: '#9ca3af', fontSize: 12 }
const GRID_STYLE = { stroke: '#374151', strokeDasharray: '3 3' }

const CLINIC_DOT_COLORS: Record<string, string> = {
  phong_kham: 'bg-teal-500',
  nha_thuoc: 'bg-blue-500',
  thu_y: 'bg-green-500',
  my_pham: 'bg-pink-500',
  khac: 'bg-gray-500',
}

// ---------------------------------------------------------------------------
// DotBadge
// ---------------------------------------------------------------------------

function DotBadge({ clinicType }: { clinicType: string }) {
  return (
    <span
      className={`inline-block w-3 h-3 rounded-full ${CLINIC_DOT_COLORS[clinicType] || 'bg-gray-500'}`}
    />
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface UsersClientProps {
  initialData: UsersData
  initialFilters: {
    year: number
    month: number
    province: string
    clinic_type: string
  }
}

export function UsersClient({ initialData, initialFilters }: UsersClientProps) {
  const [data, setData] = useState(initialData)
  const [filters, setFilters] = useState(initialFilters)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  // -------------------------------------------------------------------------
  // Filter change handler — immediate refetch
  // -------------------------------------------------------------------------

  const handleFilterChange = useCallback(
    async (newFilters: Partial<typeof filters>) => {
      const merged = { ...filters, ...newFilters }
      setFilters(merged)
      const qs = new URLSearchParams({
        year: String(merged.year),
        month: String(merged.month),
        ...(merged.province && { province: merged.province }),
        ...(merged.clinic_type && { clinic_type: merged.clinic_type }),
      })
      router.push(`/admin/users?${qs}`, { scroll: false })
      setLoading(true)
      try {
        const res = await fetch(`/api/admin/users?${qs}`)
        if (res.ok) setData(await res.json())
      } finally {
        setLoading(false)
      }
    },
    [filters, router],
  )

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="space-y-6 relative">
      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 bg-gray-900/50 z-50 flex items-center justify-center rounded-lg">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-400" />
        </div>
      )}

      {/* Filter Bar */}
      <FilterBar
        provinces={data.filter_options.provinces}
        clinicTypes={data.filter_options.clinic_types}
        selectedProvince={filters.province}
        selectedClinicType={filters.clinic_type}
        selectedYear={filters.year}
        selectedMonth={filters.month}
        onProvinceChange={(v) => handleFilterChange({ province: v })}
        onClinicTypeChange={(v) => handleFilterChange({ clinic_type: v })}
        onYearChange={(v) => handleFilterChange({ year: v })}
        onMonthChange={(v) => handleFilterChange({ month: v })}
        showProvince
        showClinicType
        showDate
      />

      {/* Section A: Charts — two-column row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* LineChart: New users per month */}
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <h3 className="text-sm font-medium text-gray-300 mb-3">
            Nguoi dung moi theo thang
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={data.monthly_new_users}>
              <CartesianGrid {...GRID_STYLE} />
              <XAxis
                dataKey="month"
                tick={AXIS_TICK}
                interval="preserveStartEnd"
              />
              <YAxis tick={AXIS_TICK} allowDecimals={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Line
                type="monotone"
                dataKey="count"
                stroke={CHART_COLORS[0]}
                strokeWidth={2}
                dot={{ r: 3, fill: CHART_COLORS[0] }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* BarChart: Users by province */}
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <h3 className="text-sm font-medium text-gray-300 mb-3">
            Nguoi dung theo tinh
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.users_by_province}>
              <CartesianGrid {...GRID_STYLE} />
              <XAxis dataKey="name" tick={AXIS_TICK} />
              <YAxis tick={AXIS_TICK} allowDecimals={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Bar
                dataKey="count"
                fill={CHART_COLORS[1]}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Section B: Horizontal BarChart — Users by district */}
      <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
        <h3 className="text-sm font-medium text-gray-300 mb-3">
          Nguoi dung theo quan/huyen
        </h3>
        <ResponsiveContainer
          width="100%"
          height={Math.max(400, data.users_by_district.length * 32)}
        >
          <BarChart layout="vertical" data={data.users_by_district}>
            <CartesianGrid {...GRID_STYLE} />
            <XAxis type="number" tick={AXIS_TICK} allowDecimals={false} />
            <YAxis
              type="category"
              dataKey="name"
              tick={AXIS_TICK}
              width={150}
            />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Bar
              dataKey="count"
              fill={CHART_COLORS[2]}
              radius={[0, 4, 4, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Section C: Tat ca khach hang */}
      <SectionHeader title="Tat ca khach hang" defaultOpen={true}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* KPI tiles — 2x2 grid */}
          <div className="grid grid-cols-2 gap-3">
            <KpiCard
              value={data.all_users.kpis.total_active}
              label="Tong hoat dong"
              bgColor="bg-emerald-600"
            />
            <KpiCard
              value={data.all_users.kpis.verified_email}
              label="Email xac minh"
              bgColor="bg-blue-600"
            />
            <KpiCard
              value={data.all_users.kpis.geo_located}
              label="Da dinh vi"
              bgColor="bg-teal-600"
            />
            <KpiCard
              value={data.all_users.kpis.facility_type_count}
              label="Loai co so"
              bgColor="bg-cyan-600"
            />
          </div>

          {/* Facility breakdown table */}
          <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-900 text-gray-300 text-xs uppercase">
                <tr>
                  <th className="px-3 py-2">Ma</th>
                  <th className="px-3 py-2">Icon</th>
                  <th className="px-3 py-2">Loai co so</th>
                  <th className="px-3 py-2 text-right">So luong</th>
                  <th className="px-3 py-2 text-right">%</th>
                </tr>
              </thead>
              <tbody>
                {data.all_users.facility_breakdown.map((row, idx) => (
                  <tr
                    key={row.clinic_type}
                    className="border-b border-gray-700 text-gray-200"
                  >
                    <td className="px-3 py-2">{idx + 1}</td>
                    <td className="px-3 py-2">
                      <DotBadge clinicType={row.clinic_type} />
                    </td>
                    <td className="px-3 py-2">{row.label}</td>
                    <td className="px-3 py-2 text-right">{row.count}</td>
                    <td className="px-3 py-2 text-right">
                      {row.percentage.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </SectionHeader>

      {/* Section D: Khach hang co truy van */}
      <SectionHeader title="Khach hang co truy van" defaultOpen={true}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* KPI tiles — 2x2 grid */}
          <div className="grid grid-cols-2 gap-3">
            <KpiCard
              value={data.users_with_queries.kpis.total_active}
              label="Tong hoat dong"
              bgColor="bg-emerald-600"
            />
            <KpiCard
              value={data.users_with_queries.kpis.verified_email}
              label="Email xac minh"
              bgColor="bg-blue-600"
            />
            <KpiCard
              value={data.users_with_queries.kpis.geo_located}
              label="Da dinh vi"
              bgColor="bg-teal-600"
            />
            <KpiCard
              value={data.users_with_queries.kpis.facility_type_count}
              label="Loai co so"
              bgColor="bg-cyan-600"
            />
          </div>

          {/* Facility breakdown table with extra % columns */}
          <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-900 text-gray-300 text-xs uppercase">
                <tr>
                  <th className="px-3 py-2">Ma</th>
                  <th className="px-3 py-2">Icon</th>
                  <th className="px-3 py-2">Loai co so</th>
                  <th className="px-3 py-2 text-right">So luong</th>
                  <th className="px-3 py-2 text-right">% tong KH</th>
                  <th className="px-3 py-2 text-right">% KH con hoat dong</th>
                </tr>
              </thead>
              <tbody>
                {data.users_with_queries.facility_breakdown.map((row, idx) => (
                  <tr
                    key={row.clinic_type}
                    className="border-b border-gray-700 text-gray-200"
                  >
                    <td className="px-3 py-2">{idx + 1}</td>
                    <td className="px-3 py-2">
                      <DotBadge clinicType={row.clinic_type} />
                    </td>
                    <td className="px-3 py-2">{row.label}</td>
                    <td className="px-3 py-2 text-right">{row.count}</td>
                    <td className="px-3 py-2 text-right">
                      {row.pct_of_total.toFixed(1)}%
                    </td>
                    <td className="px-3 py-2 text-right">
                      {row.pct_of_active.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </SectionHeader>

      {/* Section E: Nguoi dung nhieu truy van — collapsed by default */}
      <SectionHeader title="Nguoi dung nhieu truy van" defaultOpen={false}>
        {data.heavy_users.length > 0 ? (
          <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-900 text-gray-300 text-xs uppercase">
                <tr>
                  <th className="px-3 py-2">Ten</th>
                  <th className="px-3 py-2">Co so</th>
                  <th className="px-3 py-2 text-right">Truy van thang nay</th>
                </tr>
              </thead>
              <tbody>
                {data.heavy_users.map((user) => (
                  <tr
                    key={user.user_id}
                    className="border-b border-gray-700 text-gray-200"
                  >
                    <td className="px-3 py-2">{user.full_name}</td>
                    <td className="px-3 py-2">{user.clinic_name}</td>
                    <td className="px-3 py-2 text-right font-medium text-white">
                      {user.query_count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 text-center">
            <p className="text-gray-400 text-sm">
              Khong co nguoi dung nao vuot 10 truy van/thang
            </p>
          </div>
        )}
      </SectionHeader>
    </div>
  )
}
