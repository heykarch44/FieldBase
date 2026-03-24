'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatDateTime } from '@/lib/utils'
import { Card, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { ServiceVisit, User, Customer } from '@/lib/types'
import { Clock, Camera, FlaskConical, Wrench, MapPin, AlertTriangle } from 'lucide-react'

interface FeedEvent {
  id: string
  visitId?: string
  type: 'visit' | 'photo' | 'chemical' | 'repair'
  description: string
  technician: string
  customer: string
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
        .from('service_visits')
        .select(`
          id, status, arrived_at, departed_at, scheduled_date, geofence_flagged,
          customer:customers(first_name, last_name),
          technician:users!service_visits_technician_id_fkey(full_name)
        `)
        .order('updated_at', { ascending: false })
        .limit(10)

      if (visits) {
        for (const v of visits) {
          const visit = v as unknown as ServiceVisit & {
            customer: Pick<Customer, 'first_name' | 'last_name'>
            technician: Pick<User, 'full_name'>
          }
          const custName = visit.customer
            ? `${visit.customer.first_name} ${visit.customer.last_name}`
            : 'Unknown'
          const techName = visit.technician?.full_name ?? 'Unknown'

          if (visit.status === 'completed' && visit.departed_at) {
            feedEvents.push({
              id: `visit-departed-${visit.id}`,
              visitId: visit.id,
              type: 'visit',
              description: `Completed service visit`,
              technician: techName,
              customer: custName,
              timestamp: visit.departed_at,
              geofence_flagged: visit.geofence_flagged,
            })
          } else if (visit.arrived_at) {
            feedEvents.push({
              id: `visit-arrived-${visit.id}`,
              visitId: visit.id,
              type: 'visit',
              description: `Arrived at location`,
              technician: techName,
              customer: custName,
              timestamp: visit.arrived_at,
              geofence_flagged: visit.geofence_flagged,
            })
          }
        }
      }

      // Recent repair requests
      const { data: repairs } = await supabase
        .from('repair_requests')
        .select(`
          id, category, created_at,
          customer:customers(first_name, last_name),
          requester:users!repair_requests_requested_by_fkey(full_name)
        `)
        .order('created_at', { ascending: false })
        .limit(5)

      if (repairs) {
        for (const r of repairs) {
          const repair = r as unknown as {
            id: string
            category: string
            created_at: string
            customer: Pick<Customer, 'first_name' | 'last_name'>
            requester: Pick<User, 'full_name'>
          }
          const custName = repair.customer
            ? `${repair.customer.first_name} ${repair.customer.last_name}`
            : 'Unknown'

          feedEvents.push({
            id: `repair-${repair.id}`,
            type: 'repair',
            description: `New repair request: ${repair.category}`,
            technician: repair.requester?.full_name ?? 'Unknown',
            customer: custName,
            timestamp: repair.created_at,
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
        { event: '*', schema: 'public', table: 'service_visits' },
        () => {
          fetchRecentActivity()
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'repair_requests' },
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
    photo: Camera,
    chemical: FlaskConical,
    repair: Wrench,
  }

  const colorMap = {
    visit: 'text-aqua-600 bg-aqua-50',
    photo: 'text-violet-600 bg-violet-50',
    chemical: 'text-emerald-600 bg-emerald-50',
    repair: 'text-amber-600 bg-amber-50',
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
                  isClickable ? 'cursor-pointer transition-colors hover:bg-aqua-50/50' : ''
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
                    {event.customer} &middot; {formatDateTime(event.timestamp)}
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
