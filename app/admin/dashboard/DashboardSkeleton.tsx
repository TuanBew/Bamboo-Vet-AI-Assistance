'use client'

export function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      {/* Filter bar skeleton */}
      <div className="flex gap-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-gray-700 animate-pulse rounded-lg h-10 flex-1" />
        ))}
        <div className="bg-gray-700 animate-pulse rounded-lg h-10 w-24" />
      </div>

      {/* Tong quan skeleton - 2 charts */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-700 animate-pulse rounded-lg h-[280px]" />
        <div className="bg-gray-700 animate-pulse rounded-lg h-[280px]" />
      </div>

      {/* Chi so tap trung skeleton */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-700 animate-pulse rounded-lg h-[240px]" />
        <div className="bg-gray-700 animate-pulse rounded-lg h-[200px]" />
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-gray-700 animate-pulse rounded-lg h-[200px]" />
        ))}
      </div>
      <div className="grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-gray-700 animate-pulse rounded-lg h-[100px]" />
        ))}
      </div>

      {/* Nhan vien skeleton */}
      <div className="bg-gray-700 animate-pulse rounded-lg h-[300px]" />

      {/* Khach hang + Top 10 skeleton */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-700 animate-pulse rounded-lg h-[300px]" />
        <div className="bg-gray-700 animate-pulse rounded-lg h-[300px]" />
      </div>
    </div>
  )
}
