'use client'

import { LineChart, Line } from 'recharts'

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
  const chartData = data.map((value, index) => ({ index, value }))

  return (
    <div className={className} style={{ width, height }}>
      <LineChart
        width={width}
        height={height}
        data={chartData}
        margin={{ top: 2, right: 2, bottom: 2, left: 2 }}
      >
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </div>
  )
}
