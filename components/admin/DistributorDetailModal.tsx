'use client'

import { useMemo } from 'react'
import { X } from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DistributorDetailModalProps {
  isOpen: boolean
  onClose: () => void
  data: {
    distributor_name: string
    distributor_id: string
    year: number
    month: number
    staff: Array<{
      staff_id: string
      staff_name: string
      daily_data: Array<{
        day: number
        revenue: number
        customer_count: number
      }>
    }>
  } | null
  loading?: boolean
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Daily per-salesperson revenue thresholds (in VND)
// green ≥ 2M, yellow ≥ 1M, red ≥ 1, grey = 0
function getRevenueColorClass(value: number): string {
  if (value >= 2_000_000) return 'bg-green-500 text-white'
  if (value >= 1_000_000) return 'bg-yellow-400 text-black'
  if (value >= 1)         return 'bg-red-500 text-white'
  return 'text-gray-500'
}

function getKHColorClass(count: number): string {
  if (count >= 5) return 'bg-green-500 text-white'
  if (count >= 3) return 'bg-yellow-400 text-black'
  if (count >= 1) return 'bg-red-500 text-white'
  return 'text-gray-500'
}

function formatNumber(value: number): string {
  if (value === 0) return '0'
  return value.toLocaleString('vi-VN')
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DistributorDetailModal({
  isOpen,
  onClose,
  data,
  loading = false,
}: DistributorDetailModalProps) {
  const daysInMonth = useMemo(() => {
    if (!data) return 31
    return new Date(data.year, data.month, 0).getDate()
  }, [data])

  const dayColumns = useMemo(() => {
    return Array.from({ length: daysInMonth }, (_, i) => i + 1)
  }, [daysInMonth])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 text-white rounded-lg max-w-6xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <div>
            <h2 className="text-lg font-bold">Chi tiết theo nhân viên</h2>
            {data && (
              <p className="text-sm text-gray-400 mt-1">
                Dữ liệu {data.distributor_name} Tháng {String(data.month).padStart(2, '0')} Năm {data.year}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-4">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-400" />
            </div>
          )}

          {!loading && data && data.staff.length === 0 && (
            <p className="text-center text-gray-400 py-8">Không có dữ liệu nhân viên cho tháng này</p>
          )}

          {!loading && data && data.staff.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead className="sticky top-0 z-20">
                  <tr className="bg-gray-800">
                    <th className="sticky left-0 z-30 bg-gray-800 px-2 py-2 text-left text-gray-300 font-medium whitespace-nowrap border-r border-gray-700 min-w-[80px]">
                      Mã NV
                    </th>
                    <th className="sticky left-[80px] z-30 bg-gray-800 px-2 py-2 text-left text-gray-300 font-medium whitespace-nowrap border-r border-gray-700 min-w-[140px]">
                      Tên NV
                    </th>
                    {dayColumns.map(day => (
                      <th
                        key={day}
                        className="px-1 py-2 text-center text-gray-300 font-medium whitespace-nowrap border-r border-gray-700 min-w-[80px]"
                      >
                        Ngày {day}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.staff.map(staff => {
                    // Build a map for quick day lookup
                    const dayMap = new Map(
                      staff.daily_data.map(d => [d.day, d])
                    )

                    return (
                      <tr
                        key={staff.staff_id}
                        className="border-b border-gray-700"
                      >
                        <td className="sticky left-0 z-10 bg-gray-900 px-2 py-2 text-gray-200 whitespace-nowrap border-r border-gray-700 font-medium">
                          {staff.staff_id}
                        </td>
                        <td className="sticky left-[80px] z-10 bg-gray-900 px-2 py-2 text-gray-200 whitespace-nowrap border-r border-gray-700">
                          {staff.staff_name}
                        </td>
                        {dayColumns.map(day => {
                          const dayData = dayMap.get(day)
                          const revenue = dayData?.revenue ?? 0
                          const customerCount = dayData?.customer_count ?? 0

                          return (
                            <td
                              key={day}
                              className="px-1 py-1 text-center border-r border-gray-700"
                            >
                              <div className="flex flex-col gap-0.5">
                                <span
                                  className={`block px-1 py-0.5 rounded text-xs font-medium ${getRevenueColorClass(revenue)}`}
                                >
                                  {formatNumber(revenue)}
                                </span>
                                <span
                                  className={`block px-1 py-0.5 rounded text-xs ${getKHColorClass(customerCount)}`}
                                >
                                  KH {customerCount}
                                </span>
                              </div>
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end px-6 py-3 border-t border-gray-700">
          <button
            onClick={onClose}
            className="bg-gray-700 hover:bg-gray-600 text-white px-6 py-2 rounded-md transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  )
}
