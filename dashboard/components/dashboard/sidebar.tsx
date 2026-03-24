'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Users,
  Wrench,
  MapPin,
  HardHat,
  BarChart3,
  Settings,
  LogOut,
  Droplets,
} from 'lucide-react'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/customers', label: 'Customers', icon: Users },
  { href: '/dashboard/repairs', label: 'Repair Queue', icon: Wrench },
  { href: '/dashboard/routes', label: 'Routes', icon: MapPin },
  { href: '/dashboard/technicians', label: 'Technicians', icon: HardHat },
  { href: '/dashboard/reports', label: 'Reports', icon: BarChart3 },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-sand-200 bg-white">
      <div className="flex h-16 items-center gap-3 border-b border-sand-200 px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-aqua-600">
          <Droplets className="h-5 w-5 text-white" />
        </div>
        <div>
          <p className="font-display text-sm font-bold text-sand-900">Aqua Palm</p>
          <p className="text-xs text-sand-400">Office Dashboard</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navItems.map((item) => {
          const isActive =
            item.href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname.startsWith(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-aqua-50 text-aqua-700'
                  : 'text-sand-600 hover:bg-sand-50 hover:text-sand-900'
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-sand-200 p-3">
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sand-600 transition-colors hover:bg-sand-50 hover:text-sand-900"
        >
          <LogOut className="h-5 w-5" />
          Sign Out
        </button>
      </div>
    </aside>
  )
}
