'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Package, Warehouse, Users,
  Building2, UserCheck, Settings, MessageSquare, Hospital,
} from 'lucide-react'

const NAV_SECTIONS = [
  {
    label: 'CORE',
    items: [
      { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/admin/nhap-hang', label: 'Nhap hang', icon: Package },
      { href: '/admin/ton-kho', label: 'Ton kho', icon: Warehouse },
      { href: '/admin/khach-hang', label: 'Khach hang', icon: Users },
    ],
  },
  {
    label: 'CHECKED',
    items: [
      { href: '/admin/check-customers', label: 'Check Khach hang', icon: Building2 },
      { href: '/admin/check-distributor', label: 'Check NPP', icon: UserCheck },
      { href: '/admin/check-users', label: 'Check Users', icon: MessageSquare },
      { href: '/admin/check-clinics', label: 'Check Phong kham', icon: Hospital },
    ],
  },
  {
    label: 'OTHER',
    items: [
      { href: '/admin/settings', label: 'Cai dat', icon: Settings },
    ],
  },
] as const

export function AdminSidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-[240px] min-w-[240px] h-screen bg-[#1a1f2e] flex flex-col">
      {/* Logo area */}
      <div className="h-16 flex items-center px-5 border-b border-white/10">
        <span className="text-white text-lg font-bold tracking-wide">
          AI Bamboo
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label} className="mb-4">
            <div className="text-teal-400 uppercase text-xs font-semibold tracking-wider px-4 mb-2">
              {section.label}
            </div>
            <ul>
              {section.items.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href === '/admin/dashboard' && pathname === '/admin')

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`flex items-center gap-3 mx-3 px-3 py-2 rounded-md text-sm transition-colors ${
                        isActive
                          ? 'bg-white text-[#1a1f2e] font-medium'
                          : 'text-gray-300 hover:bg-white/10'
                      }`}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  )
}
