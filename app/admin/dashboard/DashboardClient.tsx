'use client'

import { useState, useCallback, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  BarChart,
  Bar,
  ComposedChart,
  Area,
  Line,
  LineChart,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import type { DashboardData, DashboardFilters } from '@/lib/admin/services/dashboard'
import { SectionHeader } from '@/components/admin/SectionHeader'
import { KpiCard } from '@/components/admin/KpiCard'
import { FilterBar } from '@/components/admin/FilterBar'
import { SparklineChart } from '@/components/admin/SparklineChart'
import { MapView } from '@/components/admin/MapView'
import type { MapPin } from '@/components/admin/MapView'
import { DashboardSkeleton } from './DashboardSkeleton'
import { VI } from '@/lib/i18n/vietnamese'

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getColorForQueries(count: number): string {
  if (count > 50) return '#22c55e'
  if (count >= 10) return '#eab308'
  if (count >= 1) return '#ef4444'
  return '#6b7280'
}

/** Get distinct province list from top_users + clinic_map data */
function extractProvinces(data: DashboardData): string[] {
  const set = new Set<string>()
  for (const c of data.clinic_map) {
    if (c.province) set.add(c.province)
  }
  return Array.from(set).sort()
}

/** Get distinct clinic types */
function extractClinicTypes(data: DashboardData): string[] {
  const set = new Set<string>()
  for (const c of data.clinic_map) {
    if (c.clinic_type) set.add(c.clinic_type)
  }
  return Array.from(set).sort()
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface DashboardClientProps {
  initialData: DashboardData
  initialFilters: DashboardFilters
}

export function DashboardClient({
  initialData,
  initialFilters,
}: DashboardClientProps) {
  const [data, setData] = useState<DashboardData>(initialData)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  // Current filter values from URL
  const currentMonth = searchParams.get('month') || initialFilters.month
  const currentProvince = searchParams.get('province') || ''
  const currentClinicType = searchParams.get('clinic_type') || ''

  // Parse year/month for display
  const [displayYear, displayMonth] = currentMonth.split('-').map(Number)
  const monthLabel = `${String(displayMonth).padStart(2, '0')}-${displayYear}`

  // Available filter options derived from data
  const provinces = useMemo(() => extractProvinces(data), [data])
  const clinicTypes = useMemo(() => extractClinicTypes(data), [data])

  // Filter change handler: update URL and refetch
  const handleFilterChange = useCallback(
    async (updates: Partial<{ month: string; province: string; clinic_type: string }>) => {
      const params = new URLSearchParams()
      const newMonth = updates.month ?? currentMonth
      const newProvince = updates.province ?? currentProvince
      const newClinicType = updates.clinic_type ?? currentClinicType

      if (newMonth) params.set('month', newMonth)
      if (newProvince) params.set('province', newProvince)
      if (newClinicType) params.set('clinic_type', newClinicType)

      const qs = params.toString()
      router.push(`/admin/dashboard${qs ? `?${qs}` : ''}`)

      setLoading(true)
      try {
        const res = await fetch(`/api/admin/dashboard?${params.toString()}`)
        if (res.ok) {
          const newData = await res.json()
          setData(newData)
        }
      } catch {
        // Keep existing data on error
      } finally {
        setLoading(false)
      }
    },
    [currentMonth, currentProvince, currentClinicType, router],
  )

  // -------------------------------------------------------------------------
  // Section 1: Tong quan — yearly bar chart + forecast composed chart
  // -------------------------------------------------------------------------

  const yearlyBarData = useMemo(() => {
    const grouped = new Map<number, { year: number; queries: number; sessions: number }>()
    for (const d of data.monthly_series) {
      if (d.is_forecast) continue
      const existing = grouped.get(d.year)
      if (existing) {
        existing.queries += d.query_count
        existing.sessions += d.session_count
      } else {
        grouped.set(d.year, { year: d.year, queries: d.query_count, sessions: d.session_count })
      }
    }
    return Array.from(grouped.values()).sort((a, b) => a.year - b.year)
  }, [data.monthly_series])

  const forecastChartData = useMemo(() => {
    const points = data.monthly_series.map((d, idx, arr) => {
      const label = `${String(d.year).slice(2)}/${String(d.month).padStart(2, '0')}`
      const isLastReal = !d.is_forecast && idx < arr.length - 1 && arr[idx + 1].is_forecast
      return {
        label,
        real: d.is_forecast ? null : d.query_count,
        // Bridge: last real point also gets forecast value so dashed line connects
        forecast: d.is_forecast ? d.query_count : isLastReal ? d.query_count : null,
      }
    })
    return points
  }, [data.monthly_series])

  // -------------------------------------------------------------------------
  // Section 2: Chi so tap trung
  // -------------------------------------------------------------------------

  const donutRows = useMemo(() => {
    const { drug_groups, animal_types, query_types } = data.category_stats
    return [
      {
        rowLabel: `${VI.dashboard.importShareMonth} ${monthLabel}`,
        donuts: [
          { label: VI.dashboard.byDrugGroup, data: drug_groups.filter((d) => d.count > 0) },
          { label: VI.dashboard.byAnimalType, data: animal_types.filter((d) => d.count > 0) },
          { label: VI.dashboard.byQueryType, data: query_types.filter((d) => d.count > 0) },
        ],
      },
      {
        rowLabel: `${VI.dashboard.salesShareMonth} ${monthLabel}`,
        donuts: [
          { label: VI.dashboard.byDrugGroup, data: drug_groups.filter((d) => d.count > 0) },
          { label: VI.dashboard.byAnimalType, data: animal_types.filter((d) => d.count > 0) },
          { label: VI.dashboard.byQueryType, data: query_types.filter((d) => d.count > 0) },
        ],
      },
    ]
  }, [data.category_stats, monthLabel])

  // -------------------------------------------------------------------------
  // Section 3: Nguoi dung — top 20 table + aggregate bar charts
  // -------------------------------------------------------------------------

  const usersByProvince = useMemo(() => {
    const map = new Map<string, number>()
    for (const u of data.top_users) {
      const province = data.clinic_map.find((c) => c.user_id === u.user_id)?.province || 'Khac'
      map.set(province, (map.get(province) ?? 0) + u.total_queries)
    }
    return Array.from(map.entries())
      .map(([name, queries]) => ({ name, queries }))
      .sort((a, b) => b.queries - a.queries)
  }, [data.top_users, data.clinic_map])

  const usersByClinicType = useMemo(() => {
    const map = new Map<string, number>()
    for (const u of data.top_users) {
      const ct = u.clinic_type || 'Khac'
      map.set(ct, (map.get(ct) ?? 0) + u.total_queries)
    }
    return Array.from(map.entries())
      .map(([name, queries]) => ({ name, queries }))
      .sort((a, b) => b.queries - a.queries)
  }, [data.top_users])

  // -------------------------------------------------------------------------
  // Section 4: Phong kham — map pins + top clinics bar chart
  // -------------------------------------------------------------------------

  const mapPins: MapPin[] = useMemo(
    () =>
      data.clinic_map.map((c) => ({
        id: c.user_id,
        latitude: c.latitude,
        longitude: c.longitude,
        label: c.clinic_name,
        popupContent: `${VI.dashboard.queryPrefix}: ${c.total_queries}`,
        color: getColorForQueries(c.total_queries),
      })),
    [data.clinic_map],
  )

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="space-y-6">
        <FilterBar
          showProvince
          showClinicType
          showDate
          provinces={provinces}
          clinicTypes={clinicTypes}
          selectedProvince={currentProvince}
          selectedClinicType={currentClinicType}
          selectedYear={displayYear}
          selectedMonth={displayMonth}
        />
        <DashboardSkeleton />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Filter Bar */}
      <FilterBar
        showProvince
        showClinicType
        showDate
        provinces={provinces}
        clinicTypes={clinicTypes}
        selectedProvince={currentProvince}
        selectedClinicType={currentClinicType}
        selectedYear={displayYear}
        selectedMonth={displayMonth}
        onProvinceChange={(v) => handleFilterChange({ province: v })}
        onClinicTypeChange={(v) => handleFilterChange({ clinic_type: v })}
        onYearChange={(y) =>
          handleFilterChange({ month: `${y}-${String(displayMonth).padStart(2, '0')}` })
        }
        onMonthChange={(m) =>
          handleFilterChange({ month: `${displayYear}-${String(m).padStart(2, '0')}` })
        }
      />

      {/* Section 1: Tong quan */}
      <SectionHeader title={VI.dashboard.overview}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Yearly grouped BarChart */}
          <div className="bg-gray-800 rounded-xl p-4">
            <h3 className="text-sm font-medium text-gray-300 mb-3">
              {VI.dashboard.yearlyAggregate}
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={yearlyBarData}>
                <CartesianGrid {...GRID_STYLE} />
                <XAxis dataKey="year" tick={AXIS_TICK} />
                <YAxis tick={AXIS_TICK} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
                <Bar dataKey="queries" name={VI.dashboard.importLabel} fill="#06b6d4" radius={[4, 4, 0, 0]} />
                <Bar dataKey="sessions" name={VI.dashboard.salesLabel} fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Forecast ComposedChart */}
          <div className="bg-gray-800 rounded-xl p-4">
            <h3 className="text-sm font-medium text-gray-300 mb-3">
              {VI.dashboard.trendForecast}
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <ComposedChart data={forecastChartData}>
                <CartesianGrid {...GRID_STYLE} />
                <XAxis dataKey="label" tick={AXIS_TICK} interval="preserveStartEnd" />
                <YAxis tick={AXIS_TICK} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Area
                  type="monotone"
                  dataKey="real"
                  fill="#06b6d4"
                  fillOpacity={0.3}
                  stroke="#06b6d4"
                  connectNulls={false}
                />
                <Line
                  type="monotone"
                  dataKey="forecast"
                  stroke="#06b6d4"
                  strokeDasharray="4 4"
                  strokeOpacity={0.7}
                  dot={false}
                  connectNulls
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </SectionHeader>

      {/* Section 2: Chi so tap trung */}
      <SectionHeader title={`${VI.dashboard.focusMetrics} tháng ${monthLabel}`}>
        {/* Daily volume line chart */}
        <div className="bg-gray-800 rounded-xl p-4 mb-4">
          <h3 className="text-sm font-medium text-gray-300 mb-3">
            {VI.dashboard.dailyQueryVolume}
          </h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={data.daily_volume}>
              <CartesianGrid {...GRID_STYLE} />
              <XAxis dataKey="day" tick={AXIS_TICK} />
              <YAxis tick={AXIS_TICK} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Line
                type="monotone"
                dataKey="query_count"
                stroke="#06b6d4"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* 5 KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-4">
          <KpiCard
            value={data.kpis.total_queries.toLocaleString()}
            label={VI.dashboard.totalQueryKpi}
            bgColor="bg-gray-800"
          />
          <KpiCard
            value={data.kpis.total_sessions.toLocaleString()}
            label={VI.dashboard.chatSessions}
            bgColor="bg-gray-800"
          />
          <KpiCard
            value={data.kpis.total_users.toLocaleString()}
            label={VI.dashboard.users}
            bgColor="bg-gray-800"
          />
          <KpiCard
            value={data.kpis.total_documents.toLocaleString()}
            label={VI.dashboard.kbDocuments}
            bgColor="bg-gray-800"
          />
          <KpiCard
            value={data.kpis.total_staff.toLocaleString()}
            label={VI.dashboard.staffLabel}
            bgColor="bg-gray-800"
          />
        </div>

        {/* 6 donut PieCharts: 2 rows x 3 */}
        {donutRows.map((row, rowIdx) => (
          <div key={rowIdx} className="mb-4">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">
              {row.rowLabel}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {row.donuts.map((donut, donutIdx) => (
                <div
                  key={donutIdx}
                  className="bg-gray-800 rounded-xl p-4 flex flex-col items-center"
                >
                  <p className="text-xs text-gray-400 mb-2">{donut.label}</p>
                  {donut.data.length > 0 ? (
                    <PieChart width={200} height={200}>
                      <Pie
                        data={donut.data}
                        dataKey="count"
                        nameKey="name"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={2}
                      >
                        {donut.data.map((_, i) => (
                          <Cell
                            key={i}
                            fill={CHART_COLORS[i % CHART_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                    </PieChart>
                  ) : (
                    <div className="w-[200px] h-[200px] flex items-center justify-center">
                      <p className="text-xs text-gray-500">{VI.dashboard.noData}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* 4 Summary tiles */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gray-800 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-white">
              {data.kpis.total_queries.toLocaleString()}
            </p>
            <p className="text-xs text-gray-400 uppercase mt-1">{VI.dashboard.totalImport}</p>
          </div>
          <div className="bg-gray-800 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-white">
              {data.kpis.total_sessions.toLocaleString()}
            </p>
            <p className="text-xs text-gray-400 uppercase mt-1">{VI.dashboard.totalSales}</p>
          </div>
          <div className="bg-gray-800 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-white">
              {data.kpis.total_users} / {data.kpis.total_documents}
            </p>
            <p className="text-xs text-gray-400 uppercase mt-1">{VI.dashboard.salesPerPromo}</p>
          </div>
          <div className="bg-gray-800 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-white">
              {data.kpis.total_sessions > 0
                ? Math.round(data.kpis.total_queries / data.kpis.total_sessions)
                : 0}
            </p>
            <p className="text-xs text-gray-400 uppercase mt-1">{VI.dashboard.avgPerOrder}</p>
          </div>
        </div>
      </SectionHeader>

      {/* Section 3: Nhan vien */}
      <SectionHeader title={`${VI.dashboard.staffMonth} ${monthLabel}`}>
        <div className="bg-gray-800 rounded-xl overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-400 uppercase">
              <tr className="border-b border-gray-700">
                <th className="px-4 py-3">{VI.dashboard.staffName}</th>
                <th className="px-4 py-3">{VI.dashboard.dailySales}</th>
                <th className="px-4 py-3">{VI.dashboard.total}</th>
                <th className="px-4 py-3">{VI.dashboard.orders}</th>
                <th className="px-4 py-3">{VI.dashboard.average}</th>
                <th className="px-4 py-3">{VI.dashboard.drugGroup}</th>
                <th className="px-4 py-3">{VI.dashboard.daysOver1m}</th>
              </tr>
            </thead>
            <tbody>
              {data.top_users.map((user) => {
                // Build stacked bar data from drug_group_breakdown
                const drugKeys = Object.keys(user.drug_group_breakdown)
                const drugBarData = [
                  drugKeys.reduce<Record<string, number | string>>(
                    (acc, key) => {
                      acc[key] = user.drug_group_breakdown[key]
                      return acc
                    },
                    { name: 'drugs' },
                  ),
                ]

                return (
                  <tr
                    key={user.user_id}
                    className="border-b border-gray-700/50 hover:bg-gray-700/50"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-white">{user.full_name}</div>
                      <div className="text-xs text-gray-500">{user.clinic_name}</div>
                    </td>
                    <td className="px-4 py-3">
                      <SparklineChart
                        data={user.monthly_sparkline}
                        width={120}
                        height={32}
                      />
                    </td>
                    <td className="px-4 py-3 text-white font-medium">
                      {user.total_queries}
                    </td>
                    <td className="px-4 py-3 text-gray-300">{user.total_sessions}</td>
                    <td className="px-4 py-3 text-gray-300">
                      {user.avg_queries.toFixed(1)}
                    </td>
                    <td className="px-4 py-3">
                      {drugKeys.length > 0 ? (
                        <BarChart
                          width={120}
                          height={24}
                          data={drugBarData}
                          layout="vertical"
                          margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
                        >
                          <XAxis type="number" hide />
                          <YAxis type="category" dataKey="name" hide />
                          {drugKeys.map((key, i) => (
                            <Bar
                              key={key}
                              dataKey={key}
                              stackId="a"
                              fill={CHART_COLORS[i % CHART_COLORS.length]}
                            />
                          ))}
                        </BarChart>
                      ) : (
                        <span className="text-xs text-gray-500">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-300">{user.days_active}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Aggregate bar charts below table */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
          <div className="bg-gray-800 rounded-xl p-4">
            <h3 className="text-sm font-medium text-gray-300 mb-3">
              {VI.dashboard.byProvince}
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={usersByProvince} layout="vertical">
                <CartesianGrid {...GRID_STYLE} />
                <XAxis type="number" tick={AXIS_TICK} />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={AXIS_TICK}
                  width={100}
                />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="queries" fill="#06b6d4" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-gray-800 rounded-xl p-4">
            <h3 className="text-sm font-medium text-gray-300 mb-3">
              {VI.dashboard.byClinicType}
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={usersByClinicType} layout="vertical">
                <CartesianGrid {...GRID_STYLE} />
                <XAxis type="number" tick={AXIS_TICK} />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={AXIS_TICK}
                  width={100}
                />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="queries" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </SectionHeader>

      {/* Section 4: Khach hang (Phong kham) */}
      <SectionHeader title={`${VI.dashboard.customerMonth} ${monthLabel}`}>
        <MapView pins={mapPins} center={[16.0, 106.0]} zoom={6} />

        {/* Top 10 clinics horizontal bar chart */}
        <div className="bg-gray-800 rounded-xl p-4 mt-4">
          <h3 className="text-sm font-medium text-gray-300 mb-3">
            {VI.dashboard.top10Clinics}
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.top_clinics} layout="vertical">
              <CartesianGrid {...GRID_STYLE} />
              <XAxis type="number" tick={AXIS_TICK} />
              <YAxis
                type="category"
                dataKey="clinic_name"
                tick={AXIS_TICK}
                width={150}
              />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Bar
                dataKey="total_queries"
                fill="#06b6d4"
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </SectionHeader>
    </div>
  )
}
