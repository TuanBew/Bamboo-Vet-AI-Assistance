import { cn } from '@/lib/utils'

export interface KpiCardProps {
  value: string | number
  label: string
  icon?: React.ReactNode
  bgColor?: string
  textColor?: string
  className?: string
}

export function KpiCard({
  value,
  label,
  icon,
  bgColor = 'bg-gray-800',
  textColor = 'text-white',
  className,
}: KpiCardProps) {
  return (
    <div
      className={cn(
        'rounded-xl p-4 flex flex-col gap-1',
        bgColor,
        textColor,
        className,
      )}
    >
      {icon && <div className="mb-1">{icon}</div>}
      <span className="text-2xl font-bold">{value}</span>
      <span className="text-sm opacity-80">{label}</span>
    </div>
  )
}
