'use client'

export function KhachHangSkeleton() {
  return (
    <div className="space-y-8">
      {/* Filter bar skeleton */}
      <div className="bg-gray-700 animate-pulse rounded-lg h-[56px]" />
      {/* 3 chart panels skeleton */}
      <div className="grid grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-gray-700 animate-pulse rounded-lg h-[280px]" />
        ))}
      </div>
      {/* Collapsible sections skeleton */}
      {[...Array(3)].map((_, i) => (
        <div key={i} className="bg-gray-700 animate-pulse rounded-lg h-[200px]" />
      ))}
    </div>
  )
}
