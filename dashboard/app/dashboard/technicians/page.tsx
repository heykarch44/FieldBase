'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate } from '@/lib/utils'
import type { Route } from '@/lib/types'
import { HardHat, MapPin, Phone, Mail, Clock, CheckCircle } from 'lucide-react'

interface TechUser {
  id: string
  full_name: string
  email: string
  phone: string | null
}

interface RecentVisit {
  id: string
  scheduled_date: string
  arrived_at: string | null
  departed_at: string | null
  jobsite: { name: string }
}

interface TechData {
  user: TechUser
  todayRoute: Route | null
  todayVisits: { completed: number; total: number }
  weekVisits: number
  monthVisits: number
  avgMinutes: number
  recentVisits: RecentVisit[]
}

export default function TechniciansPage() {
  const [technicians, setTechnicians] = useState<TechData[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedTech, setExpandedTech] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient()

      // Get technicians from org_members joined with users
      const { data: members } = await supabase
        .from('org_members')
        .select('user_id, users(id, full_name, email, phone)')
        .eq('role', 'technician')

      if (!members || members.length === 0) {
        setLoading(false)
        return
      }

      const today = new Date()
      const todayStr = today.toISOString().split('T')[0]
      const dayMap: Record<number, string> = {
        0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat',
      }
      const todayDay = dayMap[today.getDay()]

      const weekAgo = new Date(today)
      weekAgo.setDate(weekAgo.getDate() - 7)
      const monthAgo = new Date(today)
      monthAgo.setDate(monthAgo.getDate() - 30)

      const techDataList: TechData[] = []

      for (const member of members as Array<{ user_id: string; users: TechUser | null }>) {
        const user = member.users
        if (!user) continue

        const [routeRes, todayVisitsRes, weekRes, monthRes, recentRes] = await Promise.all([
          supabase
            .from('routes')
            .select('*')
            .eq('technician_id', user.id)
            .eq('day_of_week', todayDay)
            .limit(1)
            .maybeSingle(),
          supabase
            .from('visits')
            .select('id, status')
            .eq('technician_id', user.id)
            .eq('scheduled_date', todayStr),
          supabase
            .from('visits')
            .select('id', { count: 'exact', head: true })
            .eq('technician_id', user.id)
            .eq('status', 'completed')
            .gte('scheduled_date', weekAgo.toISOString().split('T')[0]),
          supabase
            .from('visits')
            .select('id', { count: 'exact', head: true })
            .eq('technician_id', user.id)
            .eq('status', 'completed')
            .gte('scheduled_date', monthAgo.toISOString().split('T')[0]),
          supabase
            .from('visits')
            .select('id, scheduled_date, arrived_at, departed_at, jobsite:jobsites(name)')
            .eq('technician_id', user.id)
            .eq('status', 'completed')
            .order('scheduled_date', { ascending: false })
            .limit(10),
        ])

        const todayData = todayVisitsRes.data ?? []
        const completedVisits = recentRes.data ?? []

        // Calculate average minutes
        let totalMinutes = 0
        let countWithTime = 0
        for (const v of completedVisits as unknown as RecentVisit[]) {
          if (v.arrived_at && v.departed_at) {
            totalMinutes += (new Date(v.departed_at).getTime() - new Date(v.arrived_at).getTime()) / 60000
            countWithTime++
          }
        }

        techDataList.push({
          user,
          todayRoute: routeRes.data as Route | null,
          todayVisits: {
            completed: todayData.filter((v) => v.status === 'completed').length,
            total: todayData.length,
          },
          weekVisits: weekRes.count ?? 0,
          monthVisits: monthRes.count ?? 0,
          avgMinutes: countWithTime > 0 ? Math.round(totalMinutes / countWithTime) : 0,
          recentVisits: (completedVisits ?? []) as unknown as RecentVisit[],
        })
      }

      setTechnicians(techDataList)
      setLoading(false)
    }

    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-sand-900">Technicians</h1>
        <p className="text-sm text-sand-500">Monitor technician performance and activity</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {technicians.map((tech) => (
          <Card key={tech.user.id} className="p-5">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-aqua-50">
                <HardHat className="h-6 w-6 text-aqua-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-sand-900">{tech.user.full_name}</h3>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-sand-500">
                  {tech.user.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {tech.user.phone}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    {tech.user.email}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-4 gap-2">
              <div className="rounded-lg bg-sand-50 p-2 text-center">
                <p className="text-lg font-bold text-sand-900">
                  {tech.todayVisits.completed}/{tech.todayVisits.total}
                </p>
                <p className="text-xs text-sand-500">Today</p>
              </div>
              <div className="rounded-lg bg-sand-50 p-2 text-center">
                <p className="text-lg font-bold text-sand-900">{tech.weekVisits}</p>
                <p className="text-xs text-sand-500">This Week</p>
              </div>
              <div className="rounded-lg bg-sand-50 p-2 text-center">
                <p className="text-lg font-bold text-sand-900">{tech.monthVisits}</p>
                <p className="text-xs text-sand-500">This Month</p>
              </div>
              <div className="rounded-lg bg-sand-50 p-2 text-center">
                <p className="text-lg font-bold text-sand-900">
                  {tech.avgMinutes > 0 ? `${tech.avgMinutes}m` : '—'}
                </p>
                <p className="text-xs text-sand-500">Avg Time</p>
              </div>
            </div>

            {tech.todayRoute && (
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-aqua-50 p-2 text-xs">
                <MapPin className="h-3.5 w-3.5 text-aqua-600" />
                <span className="font-medium text-aqua-700">
                  {"Today's route:"} {tech.todayRoute.name}
                </span>
              </div>
            )}

            <button
              className="mt-3 w-full text-center text-xs font-medium text-aqua-600 hover:text-aqua-700"
              onClick={() =>
                setExpandedTech(expandedTech === tech.user.id ? null : tech.user.id)
              }
            >
              {expandedTech === tech.user.id ? 'Hide visit history' : 'Show visit history'}
            </button>

            {expandedTech === tech.user.id && (
              <div className="mt-3 space-y-2">
                {tech.recentVisits.length === 0 ? (
                  <p className="text-xs text-sand-400">No recent visits</p>
                ) : (
                  tech.recentVisits.map((visit) => (
                    <div
                      key={visit.id}
                      className="flex items-center gap-3 rounded-lg border border-sand-100 p-2 text-xs"
                    >
                      <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sand-800">
                          {visit.jobsite?.name ?? 'Unknown jobsite'}
                        </p>
                        <p className="text-sand-400">{formatDate(visit.scheduled_date)}</p>
                      </div>
                      {visit.arrived_at && visit.departed_at && (
                        <span className="text-sand-400 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {Math.round(
                            (new Date(visit.departed_at).getTime() - new Date(visit.arrived_at).getTime()) / 60000
                          )}m
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </Card>
        ))}

        {technicians.length === 0 && (
          <Card className="col-span-2">
            <div className="py-8 text-center">
              <HardHat className="mx-auto mb-2 h-8 w-8 text-sand-300" />
              <p className="text-sm text-sand-500">No technicians found</p>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
