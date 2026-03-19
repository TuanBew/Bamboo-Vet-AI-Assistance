'use client'

export function NhapHangSkeleton() {
  return (
    <div className="space-y-6">
      {/* Filter bar skeleton */}
      <div className="flex gap-4">
        <div className="bg-gray-700 animate-pulse rounded-lg h-10 w-64" />
        <div className="bg-gray-700 animate-pulse rounded-lg h-10 w-40" />
        <div className="bg-gray-700 animate-pulse rounded-lg h-10 w-24" />
      </div>

      {/* KPI cards skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="bg-gray-700 animate-pulse rounded-xl h-[90px]"
          />
        ))}
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-gray-700 animate-pulse rounded-lg h-[280px]" />
        <div className="bg-gray-700 animate-pulse rounded-lg h-[280px]" />
      </div>

      {/* Table + Top 10 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-gray-700 animate-pulse rounded-lg h-[240px]" />
        <div className="bg-gray-700 animate-pulse rounded-lg h-[240px]" />
      </div>

      {/* Donuts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-gray-700 animate-pulse rounded-lg h-[280px]" />
        <div className="bg-gray-700 animate-pulse rounded-lg h-[280px]" />
      </div>

      {/* Radar */}
      <div className="bg-gray-700 animate-pulse rounded-lg h-[320px]" />
    </div>
  )
}
