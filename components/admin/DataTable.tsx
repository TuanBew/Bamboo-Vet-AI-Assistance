'use client'

import { useState, useMemo, useCallback, memo } from 'react'
import { addVietnameseFont } from '@/lib/pdf/vietnamese-font'
import { VI } from '@/lib/i18n/vietnamese'
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  type ColumnDef,
  type SortingState,
  flexRender,
} from '@tanstack/react-table'

// ---------------------------------------------------------------------------
// Types (preserved contract — other components depend on these)
// ---------------------------------------------------------------------------

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
  render?: (value: T[keyof T], row: T) => React.ReactNode
}

export interface DataTableProps<T> {
  data: T[]
  columns: DataTableColumn<T>[]
  exportConfig?: ExportConfig
  searchPlaceholder?: string
  pageSize?: number
  // Server-side pagination props
  totalCount?: number
  currentPage?: number
  onPageChange?: (page: number) => void
  // Search props
  onSearch?: (value: string) => void
  showSearch?: boolean
  // Page size dropdown
  showPageSizeDropdown?: boolean
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hasAnyExport(config?: ExportConfig): boolean {
  if (!config) return false
  return !!(config.copy || config.excel || config.csv || config.pdf || config.print)
}

function flattenForExport<T>(data: T[], columns: DataTableColumn<T>[]): Record<string, unknown>[] {
  return data.map(row => {
    const obj: Record<string, unknown> = {}
    for (const col of columns) {
      obj[col.label] = row[col.key]
    }
    return obj
  })
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function DataTableInner<T extends Record<string, unknown>>({
  data,
  columns,
  exportConfig,
  searchPlaceholder = VI.table.search,
  pageSize: initialPageSize = 10,
  totalCount,
  currentPage,
  onPageChange,
  onSearch,
  showSearch = false,
  showPageSizeDropdown = true,
}: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [pageSizeState, setPageSizeState] = useState(initialPageSize)

  const isServerPaginated = totalCount !== undefined && onPageChange !== undefined

  // Map DataTableColumn<T>[] to ColumnDef<T>[]
  const columnDefs = useMemo<ColumnDef<T, unknown>[]>(
    () =>
      columns.map(col => ({
        id: String(col.key),
        accessorKey: col.key as string,
        header: col.label,
        enableSorting: col.sortable !== false,
        cell: col.render
          ? (info: { getValue: () => unknown; row: { original: T } }) =>
              col.render!(info.getValue() as T[keyof T], info.row.original)
          : undefined,
      })),
    [columns]
  )

  const table = useReactTable({
    data,
    columns: columnDefs,
    state: {
      sorting,
      globalFilter: isServerPaginated ? undefined : globalFilter,
      pagination: isServerPaginated
        ? undefined
        : { pageIndex: 0, pageSize: pageSizeState },
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: isServerPaginated ? undefined : setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    ...(!isServerPaginated && { getPaginationRowModel: getPaginationRowModel() }),
    ...(!isServerPaginated && { getFilteredRowModel: getFilteredRowModel() }),
    manualPagination: isServerPaginated,
    pageCount: isServerPaginated
      ? Math.ceil(totalCount / pageSizeState)
      : undefined,
  })

  // Server-paginated total pages
  const serverTotalPages = isServerPaginated
    ? Math.ceil(totalCount / pageSizeState)
    : table.getPageCount()
  const serverCurrentPage = isServerPaginated ? (currentPage ?? 1) : table.getState().pagination.pageIndex + 1

  // ---------------------------------------------------------------------------
  // Export handlers
  // ---------------------------------------------------------------------------

  const handleCopy = useCallback(async () => {
    const exportData = flattenForExport(data, columns)
    const headers = columns.map(c => c.label)
    const header = headers.join('\t')
    const rows = exportData.map(row => headers.map(h => String(row[h] ?? '')).join('\t'))
    const text = [header, ...rows].join('\n')
    await navigator.clipboard.writeText(text)
  }, [data, columns])

  const handleExcel = useCallback(async () => {
    const XLSX = await import('xlsx')
    const exportData = flattenForExport(data, columns)
    const ws = XLSX.utils.json_to_sheet(exportData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Data')
    XLSX.writeFile(wb, 'export.xlsx')
  }, [data, columns])

  const handleCsv = useCallback(() => {
    const headers = columns.map(c => c.label)
    const exportData = flattenForExport(data, columns)
    const csvRows = [
      headers.join(','),
      ...exportData.map(row =>
        headers.map(h => {
          const val = String(row[h] ?? '')
          return val.includes(',') || val.includes('"') || val.includes('\n')
            ? `"${val.replace(/"/g, '""')}"`
            : val
        }).join(',')
      ),
    ]
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'export.csv'
    a.click()
    URL.revokeObjectURL(url)
  }, [data, columns])

  const handlePdf = useCallback(async () => {
    const jsPDFModule = await import('jspdf')
    const jsPDF = jsPDFModule.default
    await import('jspdf-autotable')

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    addVietnameseFont(doc)

    const headers = columns.map(c => c.label)
    const body = data.map(row =>
      columns.map(c => {
        const val = row[c.key]
        return val == null ? '' : String(val)
      })
    )

    ;(doc as unknown as Record<string, Function>).autoTable({
      head: [headers],
      body,
      startY: 15,
      styles: { fontSize: 7, cellPadding: 2, font: 'Roboto' },
      headStyles: { fillColor: [31, 41, 55], textColor: [255, 255, 255] },
      theme: 'grid',
    })

    doc.save('export.pdf')
  }, [data, columns])

  const handlePrint = useCallback(() => {
    window.print()
  }, [])

  // Search handler
  const handleSearchInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value
      if (onSearch) {
        onSearch(value)
      } else {
        setGlobalFilter(value)
      }
    },
    [onSearch]
  )

  // Pagination handler
  const goToPage = useCallback(
    (page: number) => {
      if (isServerPaginated) {
        onPageChange!(page)
      } else {
        table.setPageIndex(page - 1)
      }
    },
    [isServerPaginated, onPageChange, table]
  )

  // Page size change handler
  const handlePageSizeChange = useCallback(
    (newSize: number) => {
      setPageSizeState(newSize)
      if (!isServerPaginated) {
        table.setPageSize(newSize)
      } else {
        // Reset to page 1 when page size changes in server mode
        onPageChange!(1)
      }
    },
    [isServerPaginated, onPageChange, table]
  )

  // Build pagination buttons
  const paginationButtons = useMemo(() => {
    const total = serverTotalPages
    const current = serverCurrentPage
    const pages: (number | 'ellipsis')[] = []

    if (total <= 7) {
      for (let i = 1; i <= total; i++) pages.push(i)
    } else {
      pages.push(1)
      if (current > 3) pages.push('ellipsis')
      const start = Math.max(2, current - 1)
      const end = Math.min(total - 1, current + 1)
      for (let i = start; i <= end; i++) pages.push(i)
      if (current < total - 2) pages.push('ellipsis')
      pages.push(total)
    }

    return pages
  }, [serverTotalPages, serverCurrentPage])

  const showToolbar = showSearch || hasAnyExport(exportConfig)
  const rows = table.getRowModel().rows

  return (
    <div className="space-y-3">
      {/* Toolbar: search + export buttons */}
      {showToolbar && (
        <div className="flex items-center justify-between gap-4">
          {showSearch ? (
            <input
              type="text"
              placeholder={searchPlaceholder}
              onChange={handleSearchInput}
              className="bg-gray-700 border border-gray-600 text-white placeholder-gray-400 rounded-md px-3 py-2 text-sm w-64 focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          ) : (
            <div />
          )}

          {hasAnyExport(exportConfig) && (
            <div className="flex items-center gap-2">
              {exportConfig?.copy && (
                <button
                  onClick={handleCopy}
                  className="bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs px-3 py-1.5 rounded transition-colors"
                >
                  {VI.buttons.copy}
                </button>
              )}
              {exportConfig?.excel && (
                <button
                  onClick={handleExcel}
                  className="bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs px-3 py-1.5 rounded transition-colors"
                >
                  {VI.buttons.excel}
                </button>
              )}
              {exportConfig?.csv && (
                <button
                  onClick={handleCsv}
                  className="bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs px-3 py-1.5 rounded transition-colors"
                >
                  {VI.buttons.csv}
                </button>
              )}
              {exportConfig?.pdf && (
                <button
                  onClick={handlePdf}
                  className="bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs px-3 py-1.5 rounded transition-colors"
                >
                  {VI.buttons.pdf}
                </button>
              )}
              {exportConfig?.print && (
                <button
                  onClick={handlePrint}
                  className="bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs px-3 py-1.5 rounded transition-colors"
                >
                  {VI.buttons.print}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border border-gray-700 bg-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id} className="bg-gray-900">
                  {headerGroup.headers.map(header => (
                    <th
                      key={header.id}
                      className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-300 ${
                        header.column.getCanSort() ? 'cursor-pointer select-none hover:text-white' : ''
                      }`}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <div className="flex items-center gap-1">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getCanSort() && (
                          <span className="text-gray-500">
                            {{
                              asc: '\u2191',
                              desc: '\u2193',
                            }[header.column.getIsSorted() as string] ?? '\u2195'}
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-4 py-8 text-center text-sm text-gray-400"
                  >
                    {VI.table.noData}
                  </td>
                </tr>
              ) : (
                rows.map(row => (
                  <tr
                    key={row.id}
                    className="border-b border-gray-700 text-sm text-gray-200 hover:bg-gray-700/50 transition-colors"
                  >
                    {row.getVisibleCells().map(cell => (
                      <td key={cell.id} className="px-4 py-3">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {serverTotalPages > 1 && (
        <div className="flex items-center justify-between">
          {/* Page size dropdown */}
          {showPageSizeDropdown ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">{VI.table.rowsPerPage}</span>
              <select
                value={pageSizeState}
                onChange={e => handlePageSizeChange(Number(e.target.value))}
                className="bg-gray-700 border border-gray-600 text-white text-sm rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-teal-500"
              >
                {[10, 25, 50, 100].map(size => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div />
          )}

          {/* Page buttons */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => goToPage(serverCurrentPage - 1)}
              disabled={serverCurrentPage <= 1}
              className="bg-gray-700 text-white text-sm px-3 py-1.5 rounded disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-600 transition-colors"
            >
              {VI.table.prev}
            </button>
            {paginationButtons.map((page, i) =>
              page === 'ellipsis' ? (
                <span key={`ellipsis-${i}`} className="text-gray-500 px-2">
                  ...
                </span>
              ) : (
                <button
                  key={page}
                  onClick={() => goToPage(page)}
                  className={`text-sm px-3 py-1.5 rounded transition-colors ${
                    page === serverCurrentPage
                      ? 'bg-teal-600 text-white'
                      : 'bg-gray-700 text-white hover:bg-gray-600'
                  }`}
                >
                  {page}
                </button>
              )
            )}
            <button
              onClick={() => goToPage(serverCurrentPage + 1)}
              disabled={serverCurrentPage >= serverTotalPages}
              className="bg-gray-700 text-white text-sm px-3 py-1.5 rounded disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-600 transition-colors"
            >
              {VI.table.next}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// Preserve generic type parameter through memo wrapper
export const DataTable = memo(DataTableInner) as typeof DataTableInner
