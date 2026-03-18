'use client'

export const COLOR_THRESHOLDS = {
  green: 50,
  yellow: 10,
  red: 1,
  grey: 0,
} as const

export interface ColorPivotTableProps {
  rows: Array<{
    id: string
    label: string
    values: Record<string, number>
  }>
  columns: string[]
  onRowClick?: (rowId: string) => void
  exportConfig?: { excel?: boolean; copy?: boolean }
  searchPlaceholder?: string
}

export function ColorPivotTable({
  rows,
  columns,
  onRowClick,
}: ColorPivotTableProps) {
  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800 p-4">
      <p className="text-sm text-gray-400">
        ColorPivotTable — {rows.length} rows, {columns.length} columns
      </p>
      <p className="text-xs text-gray-500 mt-1">
        Color thresholds: &gt;50 green, 10-50 yellow, 1-9 red, 0 grey
      </p>
      <p className="text-xs text-gray-500">
        Component stub — wired in Phase 5+
      </p>
    </div>
  )
}
