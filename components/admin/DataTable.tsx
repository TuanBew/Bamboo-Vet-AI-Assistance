'use client'

export interface ExportConfig {
  copy?: boolean
  excel?: boolean
  csv?: boolean
  pdf?: boolean
  print?: boolean
}

export interface DataTableColumn<T> {
  key: keyof T
  label: string
  sortable?: boolean
}

export interface DataTableProps<T> {
  data: T[]
  columns: DataTableColumn<T>[]
  exportConfig?: ExportConfig
  searchPlaceholder?: string
  pageSize?: number
}

export function DataTable<T>({
  data,
  columns,
  exportConfig,
  searchPlaceholder,
  pageSize = 10,
}: DataTableProps<T>) {
  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800 p-4">
      <p className="text-sm text-gray-400">
        DataTable — {columns.length} columns, {data.length} rows
      </p>
      <p className="text-xs text-gray-500 mt-1">
        Component stub — wired in Phase 3+
      </p>
    </div>
  )
}
