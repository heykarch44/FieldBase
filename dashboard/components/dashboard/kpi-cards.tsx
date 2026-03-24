'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { CardSkeleton } from '@/components/ui/skeleton'
import { Users, Calendar, Wrench, DollarSign } from 'lucide-react'

interface KpiData {
  activeCustomers: number
  todayVisits: { completed: number; total: number }
  pendingRepairs: number
  mrr: number
}

export function KpiCards() {
  const [data, setData] = useState<KpiData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchKpis() {
      const supabase = createClient()
      const today = new Date().toISOString().split('T')[0]

      const [customersRes, visitsRes, repairsRes, mrrRes] = await Promise.all([
        supabase
          .from('customers')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'active'),
        supabase
          .from('service_visits')
          .select('id, status')
          .eq('scheduled_date', today),
        supabase
          .from('repair_requests')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending_review'),
        supabase
          .from('customers')
          .select('monthly_rate')
          .eq('status', 'active')
          .not('monthly_rate', 'is', null),
      ])

      const totalVisits = visitsRes.data?.length ?? 0
      const completedVisits = visitsRes.data?.filter((v) => v.status === 'completed').length ?? 0
      const mrr = mrrRes.data?.reduce((sum, c) => sum + (Number(c.monthly_rate) || 0), 0) ?? 0

      setData({
        activeCustomers: customersRes.count ?? 0,
        todayVisits: { completed: completedVisits, total: totalVisits },
        pendingRepairs: repairsRes.count ?? 0,
        mrr,
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
      label: 'Active Customers',
      value: data.activeCustomers.toString(),
      icon: Users,
      color: 'text-aqua-600 bg-aqua-50',
    },
    {
      label: "Today's Visits",
      value: `${data.todayVisits.completed} / ${data.todayVisits.total}`,
      icon: Calendar,
      color: 'text-emerald-600 bg-emerald-50',
    },
    {
      label: 'Pending Repairs',
      value: data.pendingRepairs.toString(),
      icon: Wrench,
      color: 'text-amber-600 bg-amber-50',
    },
    {
      label: 'Monthly Revenue',
      value: formatCurrency(data.mrr),
      icon: DollarSign,
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
