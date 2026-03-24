'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardTitle, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'

interface VisitsByStatus {
  status: string
  count: number
}

interface OrdersByUrgency {
  urgency: string
  count: number
}

interface TechVisits {
  name: string
  completedVisits: number
  avgMinutes: number
}

const CHART_COLORS = ['#0891B2', '#D97706', '#059669', '#7C3AED', '#DC2626', '#2563EB']

export default function ReportsPage() {
  const [loading, setLoading] = useState(true)
  const [visitsByStatus, setVisitsByStatus] = useState<VisitsByStatus[]>([])
  const [ordersByUrgency, setOrdersByUrgency] = useState<OrdersByUrgency[]>([])
  const [techVisits, setTechVisits] = useState<TechVisits[]>([])
  const [totalVisits, setTotalVisits] = useState(0)
  const [totalOrders, setTotalOrders] = useState(0)
  const [totalJobsites, setTotalJobsites] = useState(0)

  useEffect(() => {
    async function fetchAll() {
      const supabase = createClient()

      // Fetch visits grouped by status
      const { data: visitsData } = await supabase
        .from('visits')
        .select('id, status')

      const statusCounts = new Map<string, number>()
      let total = 0
      for (const v of visitsData ?? []) {
        statusCounts.set(v.status, (statusCounts.get(v.status) ?? 0) + 1)
        total++
      }
      setTotalVisits(total)
      setVisitsByStatus(
        Array.from(statusCounts.entries()).map(([status, count]) => ({
          status: status.replace(/_/g, ' '),
          count,
        }))
      )

      // Fetch service orders grouped by urgency
      const { data: ordersData } = await supabase
        .from('service_orders')
        .select('id, urgency')

      const urgencyCounts = new Map<string, number>()
      let orderTotal = 0
      for (const o of ordersData ?? []) {
        urgencyCounts.set(o.urgency, (urgencyCounts.get(o.urgency) ?? 0) + 1)
        orderTotal++
      }
      setTotalOrders(orderTotal)
      setOrdersByUrgency(
        Array.from(urgencyCounts.entries()).map(([urgency, count]) => ({
          urgency,
          count,
        }))
      )

      // Fetch jobsite count
      const { count: jobsiteCount } = await supabase
        .from('jobsites')
        .select('id', { count: 'exact', head: true })
      setTotalJobsites(jobsiteCount ?? 0)

      // Fetch technician visit stats from org_members + visits
      const { data: members } = await supabase
        .from('org_members')
        .select('user_id, users(full_name)')
        .eq('role', 'technician')

      const techData: TechVisits[] = []
      for (const member of (members ?? []) as Array<{ user_id: string; users: { full_name: string } | null }>) {
        const name = member.users?.full_name ?? 'Unknown'

        const { count } = await supabase
          .from('visits')
          .select('id', { count: 'exact', head: true })
          .eq('technician_id', member.user_id)
          .eq('status', 'completed')

        const { data: recentVisits } = await supabase
          .from('visits')
          .select('arrived_at, departed_at')
          .eq('technician_id', member.user_id)
          .eq('status', 'completed')
          .not('arrived_at', 'is', null)
          .not('departed_at', 'is', null)
          .limit(50)

        let totalMin = 0
        let counted = 0
        for (const v of recentVisits ?? []) {
          if (v.arrived_at && v.departed_at) {
            totalMin += (new Date(v.departed_at).getTime() - new Date(v.arrived_at).getTime()) / 60000
            counted++
          }
        }

        techData.push({
          name,
          completedVisits: count ?? 0,
          avgMinutes: counted > 0 ? Math.round(totalMin / counted) : 0,
        })
      }
      setTechVisits(techData)

      setLoading(false)
    }

    fetchAll()
  }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-72" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-sand-900">Reports</h1>
        <p className="text-sm text-sand-500">Analytics and performance metrics</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="p-5 text-center">
          <p className="text-sm text-sand-500">Total Visits</p>
          <p className="text-3xl font-bold text-sand-900">{totalVisits}</p>
        </Card>
        <Card className="p-5 text-center">
          <p className="text-sm text-sand-500">Service Orders</p>
          <p className="text-3xl font-bold text-primary-600">{totalOrders}</p>
        </Card>
        <Card className="p-5 text-center">
          <p className="text-sm text-sand-500">Active Jobsites</p>
          <p className="text-3xl font-bold text-sand-900">{totalJobsites}</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Visits by Status */}
        <Card>
          <CardTitle>Visits by Status</CardTitle>
          <CardContent>
            {visitsByStatus.length === 0 ? (
              <p className="py-8 text-center text-sm text-sand-400">No visit data</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={visitsByStatus}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="count"
                    nameKey="status"
                    label={({ status, count }) => `${status ?? ''}: ${count}`}
                  >
                    {visitsByStatus.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Service Orders by Urgency */}
        <Card>
          <CardTitle>Service Orders by Urgency</CardTitle>
          <CardContent>
            {ordersByUrgency.length === 0 ? (
              <p className="py-8 text-center text-sm text-sand-400">No service order data</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={ordersByUrgency}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e0" />
                  <XAxis dataKey="urgency" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="count" name="Orders" fill="#D97706" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Technician Performance */}
        <Card className="lg:col-span-2">
          <CardTitle>Visits per Technician</CardTitle>
          <CardContent>
            {techVisits.length === 0 ? (
              <p className="py-8 text-center text-sm text-sand-400">No technician data</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={techVisits} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e0" />
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 11 }}
                    width={100}
                  />
                  <Tooltip />
                  <Bar dataKey="completedVisits" name="Completed Visits" fill="#0891B2" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="avgMinutes" name="Avg Minutes" fill="#D97706" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
