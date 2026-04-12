'use client'

export interface SparklineChartProps {
  data: number[]
  color?: string
  width?: number
  height?: number
  className?: string
}

export function computePolylinePoints(data: number[], width: number, height: number): string {
  if (data.length === 0) return ''

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1  // prevent division by zero

  const points = data.map((value, i) => {
    const x = (i / Math.max(data.length - 1, 1)) * width
    const y = height - ((value - min) / range) * height
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })

  return points.join(' ')
}

export function SparklineChart({
  data,
  color = '#3D9A7A',
  width = 120,
  height = 30,
  className,
}: SparklineChartProps) {
  if (!data || data.length === 0) {
    return <svg width={width} height={height} className={className} />
  }

  const points = computePolylinePoints(data, width, height)

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      overflow="visible"
      className={className}
    >
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
