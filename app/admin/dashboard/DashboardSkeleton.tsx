'use client'

export function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      {/* Tong quan skeleton */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-700 animate-pulse rounded-lg h-[280px]" />
        <div className="bg-gray-700 animate-pulse rounded-lg h-[280px]" />
      </div>
      {/* Chi so tap trung skeleton */}
      <div className="bg-gray-700 animate-pulse rounded-lg h-[240px]" />
      <div className="grid grid-cols-5 gap-4">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="bg-gray-700 animate-pulse rounded-lg h-[100px]"
          />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="bg-gray-700 animate-pulse rounded-lg h-[200px]"
          />
        ))}
      </div>
      {/* Nguoi dung skeleton */}
      {[...Array(5)].map((_, i) => (
        <div key={i} className="bg-gray-700 animate-pulse rounded h-8" />
      ))}
      {/* Phong kham skeleton */}
      <div className="bg-gray-700 animate-pulse rounded-lg h-[400px]" />
    </div>
  )
}
