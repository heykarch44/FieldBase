'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import type { Organization } from '@/lib/types'
import {
  LayoutDashboard,
  Building2,
  ClipboardList,
  MapPin,
  HardHat,
  BarChart3,
  Settings,
  LogOut,
  Layers,
  Users,
  Building,
  ChevronsUpDown,
  Shield,
  Clock,
  Activity,
} from 'lucide-react'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/jobsites', label: 'Sites', icon: Building2 },
  { href: '/dashboard/service-orders', label: 'Service Orders', icon: ClipboardList },
  { href: '/dashboard/routes', label: 'Routes', icon: MapPin },
  { href: '/dashboard/technicians', label: 'Technicians', icon: HardHat },
  { href: '/dashboard/time-clock', label: 'Time Clock', icon: Clock },
  { href: '/dashboard/reports', label: 'Reports', icon: BarChart3 },
]

const settingsItems = [
  { href: '/dashboard/settings/fields', label: 'Fields', icon: Layers },
  { href: '/dashboard/settings/entry-types', label: 'Entry Types', icon: Activity },
  { href: '/dashboard/settings/team', label: 'Team', icon: Users },
  { href: '/dashboard/settings/org', label: 'Organization', icon: Building },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [org, setOrg] = useState<Organization | null>(null)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [showSettings, setShowSettings] = useState(
    pathname.startsWith('/dashboard/settings')
  )

  useEffect(() => {
    async function fetchOrg() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: userData } = await supabase
        .from('users')
        .select('active_org_id, is_super_admin')
        .eq('id', user.id)
        .single()

      if (userData?.is_super_admin) setIsSuperAdmin(true)

      if (!userData?.active_org_id) return

      const { data } = await supabase
        .from('organizations')
        .select('id, name, slug, plan')
        .eq('id', userData.active_org_id)
        .single()

      if (data) setOrg(data as Organization)
    }

    fetchOrg()
  }, [supabase])

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const isSettingsActive = pathname.startsWith('/dashboard/settings')

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-sand-200 bg-white">
      <div className="flex h-16 items-center gap-3 border-b border-sand-200 px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-600">
          <Layers className="h-5 w-5 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-bold text-sand-900 truncate">
            {org?.name ?? 'FieldIQ'}
          </p>
          <p className="text-xs text-sand-400 truncate">{org?.slug ?? 'Dashboard'}</p>
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
                  ? 'bg-teal-50 text-teal-700'
                  : 'text-sand-600 hover:bg-sand-50 hover:text-sand-900'
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          )
        })}

        {/* Settings section */}
        <button
          onClick={() => setShowSettings(!showSettings)}
          className={cn(
            'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
            isSettingsActive
              ? 'bg-teal-50 text-teal-700'
              : 'text-sand-600 hover:bg-sand-50 hover:text-sand-900'
          )}
        >
          <Settings className="h-5 w-5" />
          <span className="flex-1 text-left">Settings</span>
          <ChevronsUpDown className="h-4 w-4 opacity-50" />
        </button>
        {showSettings && (
          <div className="ml-4 space-y-1">
            {settingsItems.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-teal-50 text-teal-700'
                      : 'text-sand-600 hover:bg-sand-50 hover:text-sand-900'
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              )
            })}
          </div>
        )}
      </nav>

      <div className="border-t border-sand-200 p-3 space-y-1">
        {isSuperAdmin && (
          <Link
            href="/admin"
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-teal-600 transition-colors hover:bg-teal-50"
          >
            <Shield className="h-5 w-5" />
            Admin Panel
          </Link>
        )}
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
