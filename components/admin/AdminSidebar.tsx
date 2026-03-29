'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Package, Warehouse, Users,
  Building2, UserCheck, Settings,
  type LucideIcon,
} from 'lucide-react'
import { VI } from '@/lib/i18n/vietnamese'

interface NavItem {
  href: string
  label: string
  icon: LucideIcon
}

interface NavSection {
  label: string
  items: NavItem[]
}

const NAV_SECTIONS: NavSection[] = [
  {
    label: VI.nav.sectionCore,
    items: [
      { href: '/admin/dashboard', label: VI.nav.dashboard, icon: LayoutDashboard },
      { href: '/admin/nhap-hang', label: VI.nav.nhapHang, icon: Package },
      { href: '/admin/ton-kho', label: VI.nav.tonKho, icon: Warehouse },
      { href: '/admin/khach-hang', label: VI.nav.khachHang, icon: Users },
    ],
  },
  {
    label: VI.nav.sectionChecked,
    items: [
      { href: '/admin/check-customers', label: VI.nav.checkCustomers, icon: Building2 },
      { href: '/admin/check-distributor', label: VI.nav.checkDistributor, icon: UserCheck },
    ],
  },
  {
    label: VI.nav.sectionOther,
    items: [
      { href: '/admin/settings', label: VI.nav.settings, icon: Settings },
    ],
  },
]

export function AdminSidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-[240px] min-w-[240px] h-screen bg-[#1a1f2e] flex flex-col">
      {/* Logo area */}
      <div className="h-16 flex items-center px-5 border-b border-white/10">
        <span className="text-white text-lg font-bold tracking-wide">
          {VI.nav.brandName}
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
