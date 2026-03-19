'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { NewActivityData } from '@/lib/admin/services/new-activity'
import { SectionHeader } from '@/components/admin/SectionHeader'
import { KpiCard } from '@/components/admin/KpiCard'
import { FilterBar } from '@/components/admin/FilterBar'
import { NewActivitySkeleton } from './NewActivitySkeleton'

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
// Component
// ---------------------------------------------------------------------------

interface NewActivityClientProps {
  initialData: NewActivityData
  initialFilters: { year: number; month: number }
}

export function NewActivityClient({
  initialData,
  initialFilters,
}: NewActivityClientProps) {
  const [data, setData] = useState<NewActivityData>(initialData)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [year, setYear] = useState(initialFilters.year)
  const [month, setMonth] = useState(initialFilters.month)
  const router = useRouter()

  const fetchData = useCallback(
    async (y: number, m: number) => {
      setLoading(true)
      setError(false)
      router.push(`/admin/new-activity?year=${y}&month=${m}`)

      try {
        const res = await fetch(`/api/admin/new-activity?year=${y}&month=${m}`)
        if (res.ok) {
          const newData = await res.json()
          setData(newData)
        } else {
          setError(true)
        }
      } catch {
        setError(true)
      } finally {
        setLoading(false)
      }
    },
    [router],
  )

  const handleYearChange = useCallback(
    (y: number) => {
      setYear(y)
      fetchData(y, month)
    },
    [month, fetchData],
  )

  const handleMonthChange = useCallback(
    (m: number) => {
      setMonth(m)
      fetchData(year, m)
    },
    [year, fetchData],
  )

  const handleRetry = useCallback(() => {
    fetchData(year, month)
  }, [year, month, fetchData])

  // Check if all KPIs are zero (empty data)
  const isEmpty =
    data.kpis.total_new_sessions === 0 &&
    data.kpis.total_new_queries === 0 &&
    data.kpis.total_new_users === 0 &&
    data.kpis.total_new_documents === 0

  // -------------------------------------------------------------------------
  // KPI cards
  // -------------------------------------------------------------------------

  const kpiCards = [
    {
      value: data.kpis.total_new_sessions,
      label: 'Tong phien moi',
      bgColor: 'bg-blue-600',
    },
    {
      value: data.kpis.total_new_queries,
      label: 'Tong truy van',
      bgColor: 'bg-orange-500',
    },
    {
      value: data.kpis.total_new_users,
      label: 'Nguoi dung moi',
      bgColor: 'bg-cyan-500',
    },
    {
      value: data.kpis.avg_queries_per_session.toFixed(1),
      label: 'TB truy van/phien',
      bgColor: 'bg-pink-500',
    },
    {
      value: data.kpis.total_new_documents,
      label: 'Tai lieu moi',
      bgColor: 'bg-emerald-500',
    },
    {
      value: data.kpis.avg_session_duration_min.toFixed(1),
      label: 'TB thoi gian phien',
      bgColor: 'bg-violet-500',
    },
  ]

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Filter Bar — month picker only */}
      <FilterBar
        showDate
        selectedYear={year}
        selectedMonth={month}
        onYearChange={handleYearChange}
        onMonthChange={handleMonthChange}
      />

      {/* Error state */}
      {error && (
        <div className="bg-gray-800 rounded-xl p-8 text-center">
          <p className="text-gray-400 mb-4">
            Khong the tai du lieu. Vui long thu lai sau.
          </p>
          <button
            onClick={handleRetry}
            className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
          >
            Thu lai
          </button>
        </div>
      )}

      {/* Loading state */}
      {loading && !error && <NewActivitySkeleton />}

      {/* Empty state */}
      {!loading && !error && isEmpty && (
        <div className="bg-gray-800 rounded-xl p-8 text-center">
          <p className="text-gray-400">
            Chua co du lieu cho giai doan nay.
          </p>
        </div>
      )}

      {/* Main content */}
      {!loading && !error && !isEmpty && (
        <>
          {/* 6 KPI Cards */}
          <div className="grid grid-cols-3 gap-4">
            {kpiCards.map((card) => (
              <KpiCard
                key={card.label}
                value={card.value}
                label={card.label}
                bgColor={card.bgColor}
                textColor="text-white"
              />
            ))}
          </div>

          {/* Charts section: daily query volume + daily sessions */}
          <SectionHeader title={`Doanh so thang ${month}/${year}`}>
            <div className="grid grid-cols-2 gap-4">
              {/* Daily query volume AreaChart */}
              <div className="bg-gray-800 rounded-xl p-4">
                <h3 className="text-sm font-medium text-gray-300 mb-3">
                  Luong truy van theo ngay
                </h3>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={data.daily_query_volume}>
                    <CartesianGrid {...GRID_STYLE} />
                    <XAxis dataKey="day" tick={AXIS_TICK} />
                    <YAxis tick={AXIS_TICK} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Area
                      type="monotone"
                      dataKey="query_count"
                      fill="#06b6d4"
                      fillOpacity={0.3}
                      stroke="#06b6d4"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Daily sessions BarChart */}
              <div className="bg-gray-800 rounded-xl p-4">
                <h3 className="text-sm font-medium text-gray-300 mb-3">
                  Phien moi theo ngay
                </h3>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={data.daily_sessions}>
                    <CartesianGrid {...GRID_STYLE} />
                    <XAxis dataKey="day" tick={AXIS_TICK} />
                    <YAxis tick={AXIS_TICK} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Bar
                      dataKey="session_count"
                      fill="#3b82f6"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </SectionHeader>

          {/* Recent sessions table */}
          <SectionHeader
            title={`Cac don da nhap trong thang ${month}/${year}`}
          >
            <div className="bg-gray-800 rounded-xl overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-400 uppercase border-b border-gray-700">
                  <tr>
                    <th className="px-4 py-3">Ma phien</th>
                    <th className="px-4 py-3">Ngay</th>
                    <th className="px-4 py-3">Nguoi dung</th>
                    <th className="px-4 py-3">So truy van</th>
                    <th className="px-4 py-3">Thoi gian (phut)</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent_sessions.map((s) => (
                    <tr
                      key={s.session_code}
                      className="border-b border-gray-700/50 hover:bg-gray-700/50"
                    >
                      <td className="px-4 py-2 font-mono text-cyan-400">
                        {s.session_code}
                      </td>
                      <td className="px-4 py-2 text-gray-300">{s.date}</td>
                      <td className="px-4 py-2 text-gray-300">
                        {s.user_name}
                      </td>
                      <td className="px-4 py-2 text-gray-300">
                        {s.query_count}
                      </td>
                      <td className="px-4 py-2 text-gray-300">
                        {s.duration_min.toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionHeader>

          {/* Top 10 questions horizontal BarChart */}
          <SectionHeader
            title={`Top 10 san pham nhap thang ${month}/${year}`}
          >
            <div className="bg-gray-800 rounded-xl p-4">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={data.top_questions}
                  layout="vertical"
                  margin={{ left: 20 }}
                >
                  <CartesianGrid {...GRID_STYLE} />
                  <XAxis type="number" tick={AXIS_TICK} />
                  <YAxis
                    type="category"
                    dataKey="question_prefix"
                    tick={AXIS_TICK}
                    width={300}
                  />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Bar
                    dataKey="count"
                    fill="#06b6d4"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </SectionHeader>

          {/* 3 category donut PieCharts */}
          <SectionHeader title={`Phan loai thang ${month}/${year}`}>
            <div className="grid grid-cols-3 gap-4">
              {/* Animal types donut */}
              <div className="bg-gray-800 rounded-lg p-4 flex flex-col items-center">
                <p className="text-sm text-gray-400 text-center mb-2">
                  Theo loai dong vat
                </p>
                {data.category_stats.animal_types.filter((d) => d.count > 0)
                  .length > 0 ? (
                  <PieChart width={200} height={200}>
                    <Pie
                      data={data.category_stats.animal_types.filter(
                        (d) => d.count > 0,
                      )}
                      dataKey="count"
                      nameKey="name"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={2}
                    >
                      {data.category_stats.animal_types
                        .filter((d) => d.count > 0)
                        .map((_, i) => (
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
                    <p className="text-xs text-gray-500">Khong co du lieu</p>
                  </div>
                )}
              </div>

              {/* Drug groups donut */}
              <div className="bg-gray-800 rounded-lg p-4 flex flex-col items-center">
                <p className="text-sm text-gray-400 text-center mb-2">
                  Theo nhom thuoc
                </p>
                {data.category_stats.drug_groups.filter((d) => d.count > 0)
                  .length > 0 ? (
                  <PieChart width={200} height={200}>
                    <Pie
                      data={data.category_stats.drug_groups.filter(
                        (d) => d.count > 0,
                      )}
                      dataKey="count"
                      nameKey="name"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={2}
                    >
                      {data.category_stats.drug_groups
                        .filter((d) => d.count > 0)
                        .map((_, i) => (
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
                    <p className="text-xs text-gray-500">Khong co du lieu</p>
                  </div>
                )}
              </div>

              {/* Query types donut */}
              <div className="bg-gray-800 rounded-lg p-4 flex flex-col items-center">
                <p className="text-sm text-gray-400 text-center mb-2">
                  Theo loai truy van
                </p>
                {data.category_stats.query_types.filter((d) => d.count > 0)
                  .length > 0 ? (
                  <PieChart width={200} height={200}>
                    <Pie
                      data={data.category_stats.query_types.filter(
                        (d) => d.count > 0,
                      )}
                      dataKey="count"
                      nameKey="name"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={2}
                    >
                      {data.category_stats.query_types
                        .filter((d) => d.count > 0)
                        .map((_, i) => (
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
                    <p className="text-xs text-gray-500">Khong co du lieu</p>
                  </div>
                )}
              </div>
            </div>
          </SectionHeader>
        </>
      )}
    </div>
  )
}
