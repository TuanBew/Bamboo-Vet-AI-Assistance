'use client'

import { useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { KpiCard } from '@/components/admin/KpiCard'
import { SectionHeader } from '@/components/admin/SectionHeader'
import { DataTable, type DataTableColumn } from '@/components/admin/DataTable'
import type { KBData } from '@/lib/admin/services/knowledge-base'

// ---------------------------------------------------------------------------
// Constants (same as DashboardClient — local copies, not imported)
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
// Types
// ---------------------------------------------------------------------------

interface KnowledgeBaseClientProps {
  initialData: KBData
  initialFilters: { page: number; search: string }
}

type KBDocument = KBData['documents']['data'][0]

// ---------------------------------------------------------------------------
// Columns
// ---------------------------------------------------------------------------

const kbColumns: DataTableColumn<KBDocument>[] = [
  { key: 'doc_code', label: 'Ma', sortable: true },
  { key: 'doc_name', label: 'Ten tai lieu', sortable: true },
  { key: 'chunk_count', label: 'Chunk count', sortable: true },
  { key: 'created_at', label: 'Ngay tao', sortable: true },
  { key: 'doc_type', label: 'Loai', sortable: true },
  { key: 'status', label: 'Trang thai', sortable: true },
  { key: 'relevance_score', label: 'Relevance score', sortable: true },
]

// ---------------------------------------------------------------------------
// Horizontal BarChart helper
// ---------------------------------------------------------------------------

function HorizontalBarChart({
  data,
  title,
}: {
  data: Array<{ name: string; count: number }>
  title: string
}) {
  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
      <h3 className="text-sm font-medium text-gray-300 mb-3">{title}</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} layout="vertical">
          <CartesianGrid {...GRID_STYLE} />
          <XAxis type="number" tick={AXIS_TICK} />
          <YAxis type="category" dataKey="name" tick={AXIS_TICK} width={120} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Bar dataKey="count" fill="#06b6d4" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Donut PieChart helper
// ---------------------------------------------------------------------------

function DonutChart({
  data,
  title,
}: {
  data: Array<{ name: string; count: number }>
  title: string
}) {
  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
      <h3 className="text-sm font-medium text-gray-300 mb-3">{title}</h3>
      <div className="flex justify-center">
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={data}
                dataKey="count"
                nameKey="name"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={2}
                label={false}
              >
                {data.map((_, i) => (
                  <Cell
                    key={i}
                    fill={CHART_COLORS[i % CHART_COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend
                wrapperStyle={{ color: '#9ca3af', fontSize: 12 }}
              />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[280px] flex items-center justify-center">
            <p className="text-xs text-gray-500">Khong co du lieu</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function KnowledgeBaseClient({
  initialData,
  initialFilters,
}: KnowledgeBaseClientProps) {
  const [data, setData] = useState(initialData)
  const [loading, setLoading] = useState(false)
  const [searchValue, setSearchValue] = useState(initialFilters.search)
  const router = useRouter()
  const abortRef = useRef<AbortController | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  // -------------------------------------------------------------------------
  // Refetch
  // -------------------------------------------------------------------------

  const refetch = useCallback(
    async (params: { page?: number; search?: string }) => {
      const page = params.page ?? data.documents.page
      const search = params.search ?? searchValue

      abortRef.current?.abort()
      abortRef.current = new AbortController()

      const qs = new URLSearchParams({
        page: String(page),
        search,
      })
      router.push(`/admin/knowledge-base?${qs}`, { scroll: false })

      setLoading(true)
      try {
        const res = await fetch(`/api/admin/knowledge-base?${qs}`, {
          signal: abortRef.current.signal,
        })
        if (res.ok) setData(await res.json())
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return
      } finally {
        setLoading(false)
      }
    },
    [data.documents.page, searchValue, router],
  )

  // -------------------------------------------------------------------------
  // Search with 300ms debounce
  // -------------------------------------------------------------------------

  const handleSearch = useCallback(
    (value: string) => {
      setSearchValue(value)
      clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        refetch({ search: value, page: 1 }) // Reset to page 1 on search
      }, 300)
    },
    [refetch],
  )

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="space-y-6 relative">
      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 bg-gray-900/50 z-10 flex items-center justify-center rounded-xl">
          <div className="h-8 w-8 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Section A: 3 KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard
          value={data.kpis.total_documents.toLocaleString()}
          label="Tong tai lieu"
          bgColor="bg-emerald-600"
        />
        <KpiCard
          value={data.kpis.total_chunks.toLocaleString()}
          label="Tong chunk"
          bgColor="bg-blue-600"
        />
        <KpiCard
          value={`${(data.kpis.unique_ratio * 100).toFixed(1)}%`}
          label="Unique ratio"
          bgColor="bg-purple-600"
        />
      </div>

      {/* Section B + C: Chunk analysis */}
      <SectionHeader title="Phan tich chunks">
        {/* Row 1: Horizontal BarCharts for chunks */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          <HorizontalBarChart
            data={data.charts.chunks_by_drug_group}
            title="Chunks theo nhom thuoc"
          />
          <HorizontalBarChart
            data={data.charts.chunks_by_category}
            title="Chunks theo danh muc"
          />
        </div>

        {/* Row 2: Donut PieCharts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <DonutChart
            data={data.charts.doc_type_breakdown}
            title="Phan loai tai lieu"
          />
          <DonutChart
            data={data.charts.source_breakdown}
            title="Theo nguon"
          />
        </div>
      </SectionHeader>

      {/* Section D: Document analysis */}
      <SectionHeader title="Phan tich tai lieu">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <HorizontalBarChart
            data={data.charts.docs_by_drug_group}
            title="So tai lieu theo nhom thuoc"
          />
          <HorizontalBarChart
            data={data.charts.docs_by_category}
            title="So tai lieu theo danh muc"
          />
        </div>
      </SectionHeader>

      {/* Section E: DataTable */}
      <SectionHeader title="Danh sach tai lieu">
        <DataTable
          data={data.documents.data as unknown as Record<string, unknown>[]}
          columns={kbColumns as unknown as DataTableColumn<Record<string, unknown>>[]}
          exportConfig={{ copy: true, excel: true }}
          totalCount={data.documents.total}
          currentPage={data.documents.page}
          onPageChange={(p) => refetch({ page: p })}
          onSearch={handleSearch}
          showSearch={true}
          searchPlaceholder="Tim kiem tai lieu..."
          pageSize={10}
        />
      </SectionHeader>
    </div>
  )
}
