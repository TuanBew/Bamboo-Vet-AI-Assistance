'use client'

import { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[dashboard] page error:', error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-400">
      <AlertTriangle className="w-10 h-10 text-yellow-500" />
      <div className="text-center">
        <p className="text-lg font-medium text-gray-200">Không thể tải dữ liệu</p>
        <p className="text-sm mt-1">Kết nối cơ sở dữ liệu không khả dụng.</p>
      </div>
      <button
        onClick={reset}
        className="px-4 py-2 text-sm bg-gray-700 hover:bg-gray-600 rounded-md text-gray-200 transition-colors"
      >
        Thử lại
      </button>
    </div>
  )
}
