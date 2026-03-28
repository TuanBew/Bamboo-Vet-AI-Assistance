'use client'

import { useState, useMemo, useCallback } from 'react'
import { addVietnameseFont } from '@/lib/pdf/vietnamese-font'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export const COLOR_THRESHOLDS = {
  green: 100_000_000,   // >= 100M VND -> bg-green-500 text-white
  yellow: 10_000_000,   // 10M-99M -> bg-yellow-400 text-black
  red: 1,               // 1-9.9M -> bg-red-500 text-white
  grey: 0,              // 0 -> no color, grey text
} as const

export interface ColorPivotTableProps {
  rows: Array<{
    id: string
    label: string
    dimColumns?: Record<string, string>
    values: Record<string, number>
  }>
  columns: string[]
  dimColumnLabels?: Array<{ key: string; label: string; sticky?: boolean }>
  onRowClick?: (rowId: string, columnKey?: string) => void
  exportConfig?: { excel?: boolean; copy?: boolean; csv?: boolean; pdf?: boolean; print?: boolean }
  searchPlaceholder?: string
  showColumnVisibility?: boolean
  showPageSizeDropdown?: boolean
  pageSize?: number
  columnHeaderPrefix?: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getColorClass(value: number): string {
  if (value >= 100_000_000) return 'bg-green-500 text-white'
  if (value >= 10_000_000) return 'bg-yellow-400 text-black'
  if (value >= 1) return 'bg-red-500 text-white'
  return 'text-gray-500'
}

function formatVND(value: number): string {
  if (value === 0) return '0'
  return value.toLocaleString('vi-VN')
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ColorPivotTable({
  rows,
  columns,
  dimColumnLabels = [],
  onRowClick,
  exportConfig,
  searchPlaceholder = 'Tim kiem',
  showColumnVisibility = false,
  showPageSizeDropdown = true,
  pageSize: initialPageSize = 10,
  columnHeaderPrefix = 'Thang ',
}: ColorPivotTableProps) {
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(
    () => new Set(columns)
  )
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(initialPageSize)
  const [searchTerm, setSearchTerm] = useState('')
  const [sorting, setSorting] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null)
  const [colVisOpen, setColVisOpen] = useState(false)

  // Filter rows by search
  const filteredRows = useMemo(() => {
    if (!searchTerm.trim()) return rows
    const term = searchTerm.toLowerCase()
    return rows.filter(row => {
      if (row.label.toLowerCase().includes(term)) return true
      if (row.dimColumns) {
        return Object.values(row.dimColumns).some(v =>
          v.toLowerCase().includes(term)
        )
      }
      return false
    })
  }, [rows, searchTerm])

  // Sort
  const sortedRows = useMemo(() => {
    if (!sorting) return filteredRows
    const { key, dir } = sorting
    return [...filteredRows].sort((a, b) => {
      const aVal = a.values[key] ?? 0
      const bVal = b.values[key] ?? 0
      return dir === 'asc' ? aVal - bVal : bVal - aVal
    })
  }, [filteredRows, sorting])

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize))
  const safePage = Math.min(currentPage, totalPages)
  const paginatedRows = useMemo(() => {
    const start = (safePage - 1) * pageSize
    return sortedRows.slice(start, start + pageSize)
  }, [sortedRows, safePage, pageSize])

  const showingStart = sortedRows.length === 0 ? 0 : (safePage - 1) * pageSize + 1
  const showingEnd = Math.min(safePage * pageSize, sortedRows.length)

  const visibleCols = useMemo(
    () => columns.filter(c => visibleColumns.has(c)),
    [columns, visibleColumns]
  )

  // Column visibility toggle
  const toggleColumn = useCallback((col: string) => {
    setVisibleColumns(prev => {
      const next = new Set(prev)
      if (next.has(col)) next.delete(col)
      else next.add(col)
      return next
    })
  }, [])

  // Sort toggle
  const toggleSort = useCallback((key: string) => {
    setSorting(prev => {
      if (prev?.key === key) {
        if (prev.dir === 'asc') return { key, dir: 'desc' }
        return null
      }
      return { key, dir: 'asc' }
    })
  }, [])

  // Export handlers
  const handleCopy = useCallback(async () => {
    const headers = [
      ...dimColumnLabels.map(d => d.label),
      ...visibleCols.map(c => `${columnHeaderPrefix}${c}`),
    ]
    const lines = paginatedRows.map(row => {
      const dims = dimColumnLabels.map(d => row.dimColumns?.[d.key] ?? '')
      const vals = visibleCols.map(c => String(row.values[c] ?? 0))
      return [...dims, ...vals].join('\t')
    })
    await navigator.clipboard.writeText([headers.join('\t'), ...lines].join('\n'))
  }, [dimColumnLabels, visibleCols, paginatedRows, columnHeaderPrefix])

  const handleExcel = useCallback(async () => {
    const XLSX = await import('xlsx')
    const exportData = paginatedRows.map(row => {
      const obj: Record<string, unknown> = {}
      for (const d of dimColumnLabels) obj[d.label] = row.dimColumns?.[d.key] ?? ''
      for (const c of visibleCols) obj[`${columnHeaderPrefix}${c}`] = row.values[c] ?? 0
      return obj
    })
    const ws = XLSX.utils.json_to_sheet(exportData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Data')
    XLSX.writeFile(wb, 'export.xlsx')
  }, [dimColumnLabels, visibleCols, paginatedRows, columnHeaderPrefix])

  const handleCsv = useCallback(() => {
    const headers = [
      ...dimColumnLabels.map(d => d.label),
      ...visibleCols.map(c => `${columnHeaderPrefix}${c}`),
    ]
    const csvRows = [
      headers.join(','),
      ...paginatedRows.map(row => {
        const dims = dimColumnLabels.map(d => row.dimColumns?.[d.key] ?? '')
        const vals = visibleCols.map(c => String(row.values[c] ?? 0))
        return [...dims, ...vals].map(v =>
          v.includes(',') || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v
        ).join(',')
      }),
    ]
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'export.csv'
    a.click()
    URL.revokeObjectURL(url)
  }, [dimColumnLabels, visibleCols, paginatedRows, columnHeaderPrefix])

  const handlePdf = useCallback(async () => {
    const jsPDFModule = await import('jspdf')
    const jsPDF = jsPDFModule.default
    await import('jspdf-autotable')

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    addVietnameseFont(doc)

    // Build header row
    const headers = [
      ...dimColumnLabels.map(d => d.label),
      ...visibleCols.map(col => `${columnHeaderPrefix}${col}`),
    ]

    // Build data rows
    const body = paginatedRows.map(row => [
      ...dimColumnLabels.map(d => row.dimColumns?.[d.key] ?? row.label),
      ...visibleCols.map(col => {
        const val = row.values[col] ?? 0
        return val.toLocaleString('vi-VN')
      }),
    ])

    // Use autoTable for formatted table output
    ;(doc as unknown as Record<string, Function>).autoTable({
      head: [headers],
      body,
      startY: 15,
      styles: { fontSize: 7, cellPadding: 2, font: 'Roboto' },
      headStyles: { fillColor: [31, 41, 55], textColor: [255, 255, 255] },
      theme: 'grid',
    })

    doc.save('export.pdf')
  }, [dimColumnLabels, visibleCols, paginatedRows, columnHeaderPrefix])

  const handlePrint = useCallback(() => {
    window.print()
  }, [])

  // Pagination buttons
  const paginationButtons = useMemo(() => {
    const pages: (number | 'ellipsis')[] = []
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
    } else {
      pages.push(1)
      if (safePage > 3) pages.push('ellipsis')
      const start = Math.max(2, safePage - 1)
      const end = Math.min(totalPages - 1, safePage + 1)
      for (let i = start; i <= end; i++) pages.push(i)
      if (safePage < totalPages - 2) pages.push('ellipsis')
      pages.push(totalPages)
    }
    return pages
  }, [totalPages, safePage])

  // Sticky left offsets for dim columns
  const stickyOffsets = useMemo(() => {
    const offsets: number[] = []
    let cumWidth = 0
    for (const d of dimColumnLabels) {
      offsets.push(cumWidth)
      if (d.sticky) cumWidth += 120
    }
    return offsets
  }, [dimColumnLabels])

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {showPageSizeDropdown && (
            <div className="flex items-center gap-1">
              <span className="text-sm text-gray-400">Hien thi</span>
              <select
                value={pageSize}
                onChange={e => {
                  setPageSize(Number(e.target.value))
                  setCurrentPage(1)
                }}
                className="bg-gray-700 border border-gray-600 text-white text-sm rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-teal-500"
              >
                {[10, 25, 50, 100].map(size => (
                  <option key={size} value={size}>
                    {size} dong
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Export buttons */}
          {exportConfig?.copy && (
            <button onClick={handleCopy} className="bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs px-3 py-1.5 rounded transition-colors">
              Copy
            </button>
          )}
          {exportConfig?.excel && (
            <button onClick={handleExcel} className="bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs px-3 py-1.5 rounded transition-colors">
              Excel
            </button>
          )}
          {exportConfig?.csv && (
            <button onClick={handleCsv} className="bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs px-3 py-1.5 rounded transition-colors">
              CSV
            </button>
          )}
          {exportConfig?.pdf && (
            <button onClick={handlePdf} className="bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs px-3 py-1.5 rounded transition-colors">
              PDF
            </button>
          )}
          {exportConfig?.print && (
            <button onClick={handlePrint} className="bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs px-3 py-1.5 rounded transition-colors">
              Print
            </button>
          )}

          {/* Column Visibility */}
          {showColumnVisibility && (
            <div className="relative">
              <button
                onClick={() => setColVisOpen(prev => !prev)}
                className="bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs px-3 py-1.5 rounded transition-colors"
              >
                Column Visibility &#9662;
              </button>
              {colVisOpen && (
                <div className="absolute top-full left-0 mt-1 bg-gray-800 border border-gray-600 rounded-md shadow-lg z-50 py-2 min-w-[180px] max-h-[300px] overflow-y-auto">
                  {columns.map(col => (
                    <label
                      key={col}
                      className="flex items-center gap-2 px-3 py-1 hover:bg-gray-700 cursor-pointer text-sm text-gray-200"
                    >
                      <input
                        type="checkbox"
                        checked={visibleColumns.has(col)}
                        onChange={() => toggleColumn(col)}
                        className="accent-teal-500"
                      />
                      {columnHeaderPrefix}{col}
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Search */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">Tim kiem</span>
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={searchTerm}
            onChange={e => {
              setSearchTerm(e.target.value)
              setCurrentPage(1)
            }}
            className="bg-gray-700 border border-gray-600 text-white placeholder-gray-400 rounded-md px-3 py-1.5 text-sm w-48 focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-gray-700 bg-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-900">
                {dimColumnLabels.map((dim, idx) => (
                  <th
                    key={dim.key}
                    className={`px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-gray-300 whitespace-nowrap border-r border-gray-700 ${
                      dim.sticky
                        ? 'sticky z-20 bg-gray-900'
                        : ''
                    }`}
                    style={dim.sticky ? { left: stickyOffsets[idx] } : undefined}
                  >
                    {dim.label}
                  </th>
                ))}
                {visibleCols.map(col => (
                  <th
                    key={col}
                    className="px-3 py-2.5 text-center text-xs font-medium uppercase tracking-wider text-gray-300 whitespace-nowrap border-r border-gray-700 cursor-pointer hover:text-white select-none min-w-[100px]"
                    onClick={() => toggleSort(col)}
                  >
                    <div className="flex items-center justify-center gap-1">
                      {columnHeaderPrefix}{col}
                      {sorting?.key === col && (
                        <span>{sorting.dir === 'asc' ? '\u2191' : '\u2193'}</span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginatedRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={dimColumnLabels.length + visibleCols.length}
                    className="px-4 py-8 text-center text-sm text-gray-400"
                  >
                    Khong co du lieu
                  </td>
                </tr>
              ) : (
                paginatedRows.map(row => (
                  <tr
                    key={row.id}
                    className="border-b border-gray-700 text-sm hover:bg-gray-700/50 transition-colors cursor-pointer"
                    onClick={() => onRowClick?.(row.id)}
                  >
                    {dimColumnLabels.map((dim, idx) => (
                      <td
                        key={dim.key}
                        className={`px-3 py-2 text-gray-200 whitespace-nowrap border-r border-gray-700 ${
                          dim.sticky
                            ? 'sticky z-10 bg-gray-800'
                            : ''
                        }`}
                        style={dim.sticky ? { left: stickyOffsets[idx] } : undefined}
                      >
                        {row.dimColumns?.[dim.key] ?? ''}
                      </td>
                    ))}
                    {visibleCols.map(col => {
                      const val = row.values[col] ?? 0
                      return (
                        <td
                          key={col}
                          className={`px-3 py-2 text-center whitespace-nowrap border-r border-gray-700 text-sm font-medium ${getColorClass(val)}`}
                          onClick={e => {
                            e.stopPropagation()
                            onRowClick?.(row.id, col)
                          }}
                        >
                          {formatVND(val)}
                        </td>
                      )
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-400">
          ang hien thi {showingStart} den {showingEnd} trong tong so {sortedRows.length} ban ghi
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={safePage <= 1}
            className="bg-gray-700 text-white text-sm px-3 py-1.5 rounded disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-600 transition-colors"
          >
            Truoc
          </button>
          {paginationButtons.map((page, i) =>
            page === 'ellipsis' ? (
              <span key={`ellipsis-${i}`} className="text-gray-500 px-2">
                ...
              </span>
            ) : (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`text-sm px-3 py-1.5 rounded transition-colors ${
                  page === safePage
                    ? 'bg-teal-600 text-white'
                    : 'bg-gray-700 text-white hover:bg-gray-600'
                }`}
              >
                {page}
              </button>
            )
          )}
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={safePage >= totalPages}
            className="bg-gray-700 text-white text-sm px-3 py-1.5 rounded disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-600 transition-colors"
          >
            Tiep theo
          </button>
        </div>
      </div>
    </div>
  )
}
