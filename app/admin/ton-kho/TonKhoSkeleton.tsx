'use client'

export function TonKhoSkeleton() {
  return (
    <div className="space-y-8">
      {/* Filter bar skeleton */}
      <div className="bg-gray-700 animate-pulse rounded-lg h-[56px]" />
      {/* KPI cards skeleton */}
      <div className="grid grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-gray-700 animate-pulse rounded-lg h-[100px]" />
        ))}
      </div>
      {/* 2x3 chart grid skeleton */}
      <div className="grid grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-gray-700 animate-pulse rounded-lg h-[240px]" />
        ))}
      </div>
      {/* DataTable skeleton */}
      <div className="bg-gray-700 animate-pulse rounded-lg h-[300px]" />
    </div>
  )
}
