'use client'

export const dynamic = 'force-dynamic'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Card, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Clock, Loader2, MapPin } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'
import type { TimeClockEvent } from '@/lib/types'

interface EventRow extends TimeClockEvent {
  user?: { id: string; full_name: string | null; email: string }
  jobsite?: { id: string; name: string }
}

interface TechSummary {
  userId: string
  userName: string
  email: string
  totalTodayMs: number
  totalWeekMs: number
  activeSinceIso: string | null
  activeJobsiteName: string | null
  activeJobsiteId: string | null
  lastEventIso: string | null
}

export default function TimeClockGlobalPage() {
  const [loading, setLoading] = useState(true)
  const [orgId, setOrgId] = useState<string | null>(null)
  const [events, setEvents] = useState<EventRow[]>([])

  const startOfWeek = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    const day = d.getDay() // Sun = 0
    d.setDate(d.getDate() - day)
    return d
  }, [])

  const startOfToday = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }
    const { data: userData } = await supabase
      .from('users')
      .select('active_org_id')
      .eq('id', user.id)
      .single()
    if (!userData?.active_org_id) {
      setLoading(false)
      return
    }
    setOrgId(userData.active_org_id)

    const { data } = await supabase
      .from('time_clock_events')
      .select(
        '*, user:users!time_clock_events_user_id_fkey(id, full_name, email), jobsite:jobsites!time_clock_events_jobsite_id_fkey(id, name)'
      )
      .eq('org_id', userData.active_org_id)
      .gte('occurred_at', startOfWeek.toISOString())
      .order('occurred_at', { ascending: false })

    setEvents((data ?? []) as EventRow[])
    setLoading(false)
  }, [startOfWeek])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const summaries = useMemo(
    () => computeSummaries(events, startOfToday, startOfWeek),
    [events, startOfToday, startOfWeek]
  )
  const activeCount = summaries.filter((s) => s.activeSinceIso).length

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-12 w-full" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      </div>
    )
  }

  if (!orgId) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-2xl font-bold text-sand-900">Time Clock</h1>
        <Card>
          <p className="text-sm text-sand-500">No active organization. Sign in again.</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-sand-900">Time Clock</h1>
          <p className="mt-1 text-sm text-sand-500">
            {summaries.length} tech{summaries.length !== 1 ? 's' : ''} tracked ·{' '}
            <span className="font-medium text-teal-700">{activeCount} active right now</span>
          </p>
        </div>
      </div>

      {summaries.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center py-12 text-center">
            <Clock className="mb-3 h-10 w-10 text-sand-300" />
            <p className="font-medium text-sand-600">No clock events yet this week</p>
            <p className="mt-1 text-sm text-sand-400">
              Techs can clock in/out from mobile sites.
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {summaries.map((s) => (
            <Card key={s.userId}>
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <CardTitle className="truncate">{s.userName}</CardTitle>
                  <p className="text-xs text-sand-400 truncate">{s.email}</p>
                </div>
                {s.activeSinceIso ? (
                  <Badge variant="green">Active</Badge>
                ) : (
                  <Badge variant="gray">Clocked out</Badge>
                )}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-center">
                <div className="rounded-lg bg-sand-50 p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-sand-400">
                    Today
                  </p>
                  <p className="mt-1 text-lg font-semibold text-sand-900">
                    {formatDurationHours(s.totalTodayMs)}
                  </p>
                </div>
                <div className="rounded-lg bg-sand-50 p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-sand-400">
                    This Week
                  </p>
                  <p className="mt-1 text-lg font-semibold text-sand-900">
                    {formatDurationHours(s.totalWeekMs)}
                  </p>
                </div>
              </div>

              {s.activeSinceIso && (
                <div className="mt-4 rounded-lg border border-teal-100 bg-teal-50 p-3">
                  <p className="text-xs font-medium text-teal-700">
                    Clocked in since {formatDateTime(s.activeSinceIso)}
                  </p>
                  {s.activeJobsiteId && s.activeJobsiteName && (
                    <Link
                      href={`/dashboard/jobsites/${s.activeJobsiteId}`}
                      className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:text-teal-900"
                    >
                      <MapPin className="h-3 w-3" />
                      {s.activeJobsiteName}
                    </Link>
                  )}
                </div>
              )}

              {s.lastEventIso && !s.activeSinceIso && (
                <p className="mt-3 text-xs text-sand-400">
                  Last event {formatDateTime(s.lastEventIso)}
                </p>
              )}
            </Card>
          ))}
        </div>
      )}

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-sand-500">
          Recent Events
        </h2>
        {events.length === 0 ? (
          <Card>
            <p className="text-sm text-sand-400">No events yet.</p>
          </Card>
        ) : (
          <div className="overflow-hidden rounded-xl border border-sand-200 bg-white">
            <table className="w-full">
              <thead>
                <tr className="border-b border-sand-100 bg-sand-50/50">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-sand-500">Tech</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-sand-500">Site</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-sand-500">Event</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-sand-500">Source</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-sand-500">When</th>
                </tr>
              </thead>
              <tbody>
                {events.slice(0, 50).map((ev) => (
                  <tr key={ev.id} className="border-b border-sand-50">
                    <td className="px-4 py-2 text-sm text-sand-800">
                      {ev.user?.full_name ?? ev.user?.email ?? '—'}
                    </td>
                    <td className="px-4 py-2 text-sm text-sand-600">
                      {ev.jobsite ? (
                        <Link
                          className="text-teal-700 hover:text-teal-900"
                          href={`/dashboard/jobsites/${ev.jobsite.id}`}
                        >
                          {ev.jobsite.name}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <Badge variant={ev.event_type === 'clock_in' ? 'green' : 'gray'}>
                        {ev.event_type === 'clock_in' ? 'Clock In' : 'Clock Out'}
                      </Badge>
                    </td>
                    <td className="px-4 py-2">
                      <Badge variant={ev.source === 'auto_geofence' ? 'teal' : 'amber'}>
                        {ev.source === 'auto_geofence' ? 'Auto' : 'Manual'}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 text-sm text-sand-600">
                      {formatDateTime(ev.occurred_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function computeSummaries(
  events: EventRow[],
  startOfToday: Date,
  startOfWeek: Date
): TechSummary[] {
  const byUser: Record<string, EventRow[]> = {}
  for (const ev of events) {
    if (!byUser[ev.user_id]) byUser[ev.user_id] = []
    byUser[ev.user_id].push(ev)
  }

  const now = Date.now()
  const summaries: TechSummary[] = []

  for (const uid of Object.keys(byUser)) {
    const userEvents = [...byUser[uid]].sort(
      (a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime()
    )
    const userName =
      userEvents[0].user?.full_name ?? userEvents[0].user?.email ?? 'Unknown'
    const email = userEvents[0].user?.email ?? ''

    let openIn: EventRow | null = null
    let totalTodayMs = 0
    let totalWeekMs = 0

    const addDuration = (fromIso: string, toMs: number, siteJobsiteId?: string | null) => {
      void siteJobsiteId
      const fromMs = new Date(fromIso).getTime()
      // Clip to today boundary
      const todayStart = startOfToday.getTime()
      const weekStart = startOfWeek.getTime()
      totalWeekMs += Math.max(0, toMs - Math.max(fromMs, weekStart))
      totalTodayMs += Math.max(0, toMs - Math.max(fromMs, todayStart))
    }

    for (const ev of userEvents) {
      if (ev.event_type === 'clock_in') {
        if (openIn) {
          // unpaired previous in — assume it was open
          // treat as open until now (fall-through; we'll finalize after loop)
        }
        openIn = ev
      } else if (ev.event_type === 'clock_out' && openIn) {
        addDuration(openIn.occurred_at, new Date(ev.occurred_at).getTime())
        openIn = null
      }
    }

    let activeSinceIso: string | null = null
    let activeJobsiteId: string | null = null
    let activeJobsiteName: string | null = null
    if (openIn) {
      addDuration(openIn.occurred_at, now)
      activeSinceIso = openIn.occurred_at
      activeJobsiteId = openIn.jobsite?.id ?? openIn.jobsite_id
      activeJobsiteName = openIn.jobsite?.name ?? null
    }

    const lastEventIso = userEvents[userEvents.length - 1]?.occurred_at ?? null

    summaries.push({
      userId: uid,
      userName,
      email,
      totalTodayMs,
      totalWeekMs,
      activeSinceIso,
      activeJobsiteId,
      activeJobsiteName,
      lastEventIso,
    })
  }

  return summaries.sort((a, b) => {
    if (a.activeSinceIso && !b.activeSinceIso) return -1
    if (!a.activeSinceIso && b.activeSinceIso) return 1
    return b.totalWeekMs - a.totalWeekMs
  })
}

function formatDurationHours(ms: number): string {
  if (ms <= 0) return '0h'
  const mins = Math.round(ms / 60000)
  const hrs = Math.floor(mins / 60)
  const rem = mins % 60
  if (hrs === 0) return `${rem}m`
  return rem > 0 ? `${hrs}h ${rem}m` : `${hrs}h`
}
