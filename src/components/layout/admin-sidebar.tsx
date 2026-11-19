'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Package,
  ClipboardList,
  Bike,
  BarChart3,
  Settings,
  Truck,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { UserRole } from '@/types/database'
import { hasPermission } from '@/lib/permissions'

interface AdminSidebarProps {
  userRole: UserRole
}

const NAV_ITEMS = [
  {
    label: 'Dashboard',
    href: '/admin/dashboard',
    icon: LayoutDashboard,
    permission: null,
  },
  {
    label: 'Pedidos',
    href: '/admin/orders',
    icon: Package,
    permission: 'orders:read' as const,
  },
  {
    label: 'Asignaciones',
    href: '/admin/assignments',
    icon: ClipboardList,
    permission: 'orders:assign' as const,
  },
  {
    label: 'Motorizados',
    href: '/admin/drivers',
    icon: Bike,
    permission: 'drivers:read' as const,
  },
  {
    label: 'Reportes',
    href: '/admin/reports',
    icon: BarChart3,
    permission: 'reports:read' as const,
  },
  {
    label: 'Configuración',
    href: '/admin/settings',
    icon: Settings,
    permission: 'settings:read' as const,
  },
]

export default function AdminSidebar({ userRole }: AdminSidebarProps) {
  const pathname = usePathname()

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.permission || hasPermission(userRole, item.permission)
  )

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col shrink-0 shadow-sm">
      {/* Brand */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-100">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-blue-600">
          <Truck className="text-white w-5 h-5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-gray-900 leading-tight truncate">
            Fleet Manager
          </p>
          <p className="text-xs text-gray-400 leading-tight">Panel administrativo</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {visibleItems.map((item) => {
          const isActive =
            item.href === '/admin/dashboard'
              ? pathname === item.href
              : pathname.startsWith(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group',
                isActive
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )}
            >
              <item.icon
                className={cn(
                  'w-5 h-5 shrink-0 transition-colors',
                  isActive ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'
                )}
              />
              <span className="flex-1">{item.label}</span>
              {isActive && (
                <ChevronRight className="w-4 h-4 text-blue-500 opacity-60" />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-gray-100">
        <p className="text-xs text-gray-400 text-center">
          Delivery Fleet Manager v1.0
        </p>
      </div>
    </aside>
  )
}
