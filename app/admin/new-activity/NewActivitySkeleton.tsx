'use client'

export function NewActivitySkeleton() {
  return (
    <div className="space-y-8">
      {/* KPI cards skeleton */}
      <div className="grid grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="bg-gray-700 animate-pulse rounded-xl h-[100px]"
          />
        ))}
      </div>
      {/* Charts skeleton */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-700 animate-pulse rounded-lg h-[280px]" />
        <div className="bg-gray-700 animate-pulse rounded-lg h-[240px]" />
      </div>
      {/* Table skeleton */}
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="bg-gray-700 animate-pulse rounded h-8"
          />
        ))}
      </div>
      {/* Bar chart skeleton */}
      <div className="bg-gray-700 animate-pulse rounded-lg h-[300px]" />
      {/* Donuts skeleton */}
      <div className="grid grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="bg-gray-700 animate-pulse rounded-lg h-[200px]"
          />
        ))}
      </div>
    </div>
  )
}
