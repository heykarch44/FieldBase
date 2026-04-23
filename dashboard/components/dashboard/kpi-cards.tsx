'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/card'
import { CardSkeleton } from '@/components/ui/skeleton'
import { Building2, Calendar, ClipboardList, Users } from 'lucide-react'

interface KpiData {
  activeJobsites: number
  todayVisits: { completed: number; total: number }
  pendingOrders: number
  teamMembers: number
}

export function KpiCards() {
  const [data, setData] = useState<KpiData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchKpis() {
      const supabase = createClient()
      // Use the device's local date rather than UTC so "today" matches what
      // the user sees on their wall clock (toISOString returns UTC).
      const now = new Date()
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

      // Pending = anything that is scheduled but not yet completed or closed out.
      // No 'pending' status exists in the enum, so we count the open statuses
      // that live in the scheduling queue: scheduled + in_progress.
      const OPEN_STATUSES = ['scheduled', 'in_progress']

      const [jobsitesRes, todayOrdersRes, pendingRes, membersRes] = await Promise.all([
        supabase
          .from('jobsites')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'active'),
        supabase
          .from('service_orders')
          .select('id, status')
          .eq('scheduled_date', today),
        supabase
          .from('service_orders')
          .select('id', { count: 'exact', head: true })
          .in('status', OPEN_STATUSES),
        supabase
          .from('org_members')
          .select('id', { count: 'exact', head: true }),
      ])

      const totalVisits = todayOrdersRes.data?.length ?? 0
      const completedVisits =
        todayOrdersRes.data?.filter(
          (o) => o.status === 'completed' || o.status === 'invoiced'
        ).length ?? 0

      setData({
        activeJobsites: jobsitesRes.count ?? 0,
        todayVisits: { completed: completedVisits, total: totalVisits },
        pendingOrders: pendingRes.count ?? 0,
        teamMembers: membersRes.count ?? 0,
      })
      setLoading(false)
    }

    fetchKpis()
  }, [])

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    )
  }

  if (!data) return null

  const kpis = [
    {
      label: 'Active Sites',
      value: data.activeJobsites.toString(),
      icon: Building2,
      color: 'text-indigo-600 bg-indigo-50',
    },
    {
      label: "Today's Visits",
      value: `${data.todayVisits.completed} / ${data.todayVisits.total}`,
      icon: Calendar,
      color: 'text-emerald-600 bg-emerald-50',
    },
    {
      label: 'Pending Orders',
      value: data.pendingOrders.toString(),
      icon: ClipboardList,
      color: 'text-amber-600 bg-amber-50',
    },
    {
      label: 'Team Members',
      value: data.teamMembers.toString(),
      icon: Users,
      color: 'text-violet-600 bg-violet-50',
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {kpis.map((kpi) => (
        <Card key={kpi.label}>
          <div className="flex items-center gap-4">
            <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${kpi.color}`}>
              <kpi.icon className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-sand-500">{kpi.label}</p>
              <p className="text-2xl font-bold text-sand-900">{kpi.value}</p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}
