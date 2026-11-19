'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Package, History, User } from 'lucide-react'
import { cn } from '@/lib/utils'

const ITEMS = [
  {
    label: 'Mis pedidos',
    href: '/driver',
    icon: Package,
  },
  {
    label: 'Historial',
    href: '/driver/history',
    icon: History,
  },
  {
    label: 'Mi perfil',
    href: '/driver/profile',
    icon: User,
  },
]

export default function DriverBottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 max-w-lg mx-auto bg-white border-t border-gray-200 shadow-lg">
      <div className="grid grid-cols-3 h-16">
        {ITEMS.map((item) => {
          const isActive =
            item.href === '/driver'
              ? pathname === '/driver'
              : pathname.startsWith(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center gap-1 text-xs font-medium transition-colors active:bg-gray-100',
                isActive ? 'text-blue-600' : 'text-gray-500'
              )}
            >
              <item.icon
                className={cn(
                  'w-5 h-5',
                  isActive ? 'text-blue-600 stroke-[2.5]' : 'text-gray-400'
                )}
              />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
