'use client'

export interface SparklineChartProps {
  data: number[]
  color?: string
  width?: number
  height?: number
  className?: string
}

export function SparklineChart({
  data,
  color = '#3D9A7A',
  width = 120,
  height = 30,
  className,
}: SparklineChartProps) {
  return (
    <div
      className={`inline-flex items-center justify-center ${className ?? ''}`}
      style={{ width, height }}
    >
      <span className="text-xs text-gray-500">{data.length}pt</span>
    </div>
  )
}
