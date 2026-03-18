'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

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
}

export function ClinicDetailModal({
  open,
  onOpenChange,
  clinicName,
  year,
  month,
  users,
}: ClinicDetailModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl bg-gray-900 text-white border-gray-700">
        <DialogHeader>
          <DialogTitle className="text-white">
            Chi tiet theo nguoi dung — {clinicName} Thang {month} Nam {year}
          </DialogTitle>
        </DialogHeader>
        <div className="p-4">
          <p className="text-sm text-gray-400">
            ClinicDetailModal — {users.length} staff users
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Daily breakdown grid — wired in Phase 5
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
