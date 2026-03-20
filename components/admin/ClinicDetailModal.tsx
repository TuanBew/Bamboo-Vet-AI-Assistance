'use client'

import { useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ClinicDetailUser {
  user_id: string
  staff_code: string
  full_name: string
  daily_data: Array<{
    day: number
    query_count: number
    session_count: number
  }>
}

export interface ClinicDetailModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  clinicName: string
  facilityCode: string
  year: number
  month: number
  users: ClinicDetailUser[]
  loading?: boolean
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getQueryColorClass(value: number): string {
  if (value >= 10) return 'bg-green-500 text-white'
  if (value >= 5) return 'bg-yellow-400 text-black'
  if (value >= 1) return 'bg-red-500 text-white'
  return 'text-gray-500'
}

function getSessionColorClass(value: number): string {
  if (value >= 5) return 'bg-green-500 text-white'
  if (value >= 2) return 'bg-yellow-400 text-black'
  if (value >= 1) return 'bg-red-500 text-white'
  return 'text-gray-500'
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ClinicDetailModal({
  open,
  onOpenChange,
  clinicName,
  facilityCode,
  year,
  month,
  users,
  loading = false,
}: ClinicDetailModalProps) {
  const daysInMonth = useMemo(() => {
    return new Date(year, month, 0).getDate()
  }, [year, month])

  const dayColumns = useMemo(() => {
    return Array.from({ length: daysInMonth }, (_, i) => i + 1)
  }, [daysInMonth])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl bg-gray-900 text-white border-gray-700 max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-white">
            Chi tiet theo nguoi dung
          </DialogTitle>
          <p className="text-sm text-gray-400">
            Du lieu {clinicName} ({facilityCode}) Thang {month} Nam {year}
          </p>
        </DialogHeader>

        {/* Body */}
        <div className="flex-1 overflow-auto">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-400" />
            </div>
          )}

          {!loading && users.length === 0 && (
            <p className="text-center text-gray-400 py-8">
              Khong co du lieu nhan vien cho phong kham nay
            </p>
          )}

          {!loading && users.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead className="sticky top-0 z-20">
                  <tr className="bg-gray-800">
                    <th className="sticky left-0 z-30 bg-gray-800 px-2 py-2 text-left text-gray-300 font-medium whitespace-nowrap border-r border-gray-700 min-w-[80px]">
                      Ma NV
                    </th>
                    <th className="sticky left-[80px] z-30 bg-gray-800 px-2 py-2 text-left text-gray-300 font-medium whitespace-nowrap border-r border-gray-700 min-w-[120px]">
                      Ten NV
                    </th>
                    {dayColumns.map(day => (
                      <th
                        key={day}
                        className="px-1 py-2 text-center text-gray-300 font-medium whitespace-nowrap border-r border-gray-700 min-w-[70px]"
                      >
                        Ngay {day}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map(user => {
                    const dayMap = new Map(
                      user.daily_data.map(d => [d.day, d])
                    )

                    return (
                      <tr
                        key={user.user_id}
                        className="border-b border-gray-700"
                      >
                        <td className="sticky left-0 z-10 bg-gray-900 px-2 py-2 text-gray-200 whitespace-nowrap border-r border-gray-700 font-medium">
                          {user.staff_code}
                        </td>
                        <td className="sticky left-[80px] z-10 bg-gray-900 px-2 py-2 text-gray-200 whitespace-nowrap border-r border-gray-700">
                          {user.full_name}
                        </td>
                        {dayColumns.map(day => {
                          const dayData = dayMap.get(day)
                          const query_count = dayData?.query_count ?? 0
                          const session_count = dayData?.session_count ?? 0

                          return (
                            <td
                              key={day}
                              className="px-1 py-1 text-center border-r border-gray-700"
                            >
                              <div className="flex flex-col gap-0.5">
                                <span
                                  className={`block px-1 py-0.5 rounded text-xs font-medium ${getQueryColorClass(query_count)}`}
                                >
                                  {query_count}
                                </span>
                                <span
                                  className={`block px-1 py-0.5 rounded text-xs ${getSessionColorClass(session_count)}`}
                                >
                                  SS {session_count}
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
        <div className="flex justify-end pt-3 border-t border-gray-700">
          <button
            onClick={() => onOpenChange(false)}
            className="bg-gray-700 hover:bg-gray-600 text-white px-6 py-2 rounded-md transition-colors"
          >
            Dong
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
