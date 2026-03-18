'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SectionHeaderProps {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
  className?: string
}

export function SectionHeader({
  title,
  defaultOpen = true,
  children,
  className,
}: SectionHeaderProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className={cn('mb-6', className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 w-full text-left px-4 py-2 bg-teal-600/20 rounded-lg mb-3"
      >
        {isOpen ? (
          <ChevronDown className="h-4 w-4 text-teal-400" />
        ) : (
          <ChevronRight className="h-4 w-4 text-teal-400" />
        )}
        <span className="text-sm font-semibold text-teal-400 uppercase tracking-wider">
          {title}
        </span>
      </button>
      {isOpen && <div>{children}</div>}
    </div>
  )
}
