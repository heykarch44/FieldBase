'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatDateTime } from '@/lib/utils'
import { Card, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Clock, ClipboardList, MapPin, AlertTriangle } from 'lucide-react'

interface FeedEvent {
  id: string
  visitId?: string
  type: 'visit' | 'order'
  description: string
  technician: string
  jobsite: string
  timestamp: string
  geofence_flagged?: boolean
}

export function ServiceFeed() {
  const router = useRouter()
  const [events, setEvents] = useState<FeedEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchRecentActivity() {
      const supabase = createClient()
      const feedEvents: FeedEvent[] = []

      // Recent visits
      const { data: visits } = await supabase
        .from('visits')
        .select(`
          id, status, arrived_at, departed_at, scheduled_date, geofence_flagged,
          jobsite:jobsites(name),
          technician:users!visits_technician_id_fkey(full_name)
        `)
        .order('updated_at', { ascending: false })
        .limit(10)

      if (visits) {
        for (const v of visits) {
          const visit = v as unknown as {
            id: string
            status: string
            arrived_at: string | null
            departed_at: string | null
            geofence_flagged: boolean
            jobsite: { name: string }
            technician: { full_name: string }
          }
          const jobName = visit.jobsite?.name ?? 'Unknown'
          const techName = visit.technician?.full_name ?? 'Unknown'

          if (visit.status === 'completed' && visit.departed_at) {
            feedEvents.push({
              id: `visit-departed-${visit.id}`,
              visitId: visit.id,
              type: 'visit',
              description: 'Completed visit',
              technician: techName,
              jobsite: jobName,
              timestamp: visit.departed_at,
              geofence_flagged: visit.geofence_flagged,
            })
          } else if (visit.arrived_at) {
            feedEvents.push({
              id: `visit-arrived-${visit.id}`,
              visitId: visit.id,
              type: 'visit',
              description: 'Arrived at location',
              technician: techName,
              jobsite: jobName,
              timestamp: visit.arrived_at,
              geofence_flagged: visit.geofence_flagged,
            })
          }
        }
      }

      // Recent service orders
      const { data: orders } = await supabase
        .from('service_orders')
        .select(`
          id, title, created_at,
          jobsite:jobsites(name),
          requester:users!service_orders_requested_by_fkey(full_name)
        `)
        .order('created_at', { ascending: false })
        .limit(5)

      if (orders) {
        for (const o of orders) {
          const order = o as unknown as {
            id: string
            title: string
            created_at: string
            jobsite: { name: string }
            requester: { full_name: string }
          }

          feedEvents.push({
            id: `order-${order.id}`,
            type: 'order',
            description: `New service order: ${order.title}`,
            technician: order.requester?.full_name ?? 'Unknown',
            jobsite: order.jobsite?.name ?? 'Unknown',
            timestamp: order.created_at,
          })
        }
      }

      // Sort by timestamp descending
      feedEvents.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )

      setEvents(feedEvents.slice(0, 20))
      setLoading(false)
    }

    fetchRecentActivity()

    // Set up realtime subscription
    const supabase = createClient()
    const channel = supabase
      .channel('service-feed')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'visits' },
        () => {
          fetchRecentActivity()
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'service_orders' },
        () => {
          fetchRecentActivity()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const iconMap = {
    visit: MapPin,
    order: ClipboardList,
  }

  const colorMap = {
    visit: 'text-indigo-600 bg-indigo-50',
    order: 'text-amber-600 bg-amber-50',
  }

  return (
    <Card>
      <CardTitle>Recent Activity</CardTitle>
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="flex flex-col items-center py-8 text-center">
          <Clock className="mb-2 h-8 w-8 text-sand-300" />
          <p className="text-sm text-sand-500">No recent activity</p>
        </div>
      ) : (
        <div className="space-y-1">
          {events.map((event) => {
            const Icon = iconMap[event.type]
            const isClickable = event.type === 'visit' && !!event.visitId
            return (
              <div
                key={event.id}
                className={`flex items-start gap-3 rounded-lg p-2 hover:bg-sand-50 ${
                  isClickable ? 'cursor-pointer transition-colors hover:bg-indigo-50/50' : ''
                }`}
                onClick={
                  isClickable
                    ? () => router.push(`/dashboard/visits/${event.visitId}`)
                    : undefined
                }
              >
                <div
                  className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${colorMap[event.type]}`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-sand-900">
                    <span className="font-medium">{event.technician}</span>{' '}
                    {event.description}
                    {event.geofence_flagged && (
                      <AlertTriangle className="ml-1 inline h-3.5 w-3.5 text-red-500" />
                    )}
                  </p>
                  <p className="text-xs text-sand-400">
                    {event.jobsite} &middot; {formatDateTime(event.timestamp)}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}
