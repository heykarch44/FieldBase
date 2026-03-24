'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDayOfWeek } from '@/lib/utils'
import type { Route, User, DayOfWeek } from '@/lib/types'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { MapPin, Clock, GripVertical, ChevronDown, ChevronUp, User as UserIcon, Eye } from 'lucide-react'

type RouteWithTech = Route & { technician: Pick<User, 'full_name'> }

interface Jobsite {
  id: string
  name: string
  address_line1: string
  city: string
}

interface RouteStop {
  id: string
  jobsite: Jobsite | null
}

const DAYS: DayOfWeek[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

function SortableStop({
  stop,
  index,
  onClick,
}: {
  stop: RouteStop
  index: number
  onClick?: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: stop.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 rounded-lg border border-sand-100 bg-white p-3 transition-colors hover:bg-sand-50"
    >
      <button
        className="cursor-grab text-sand-400 hover:text-sand-600 active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div
        className="flex flex-1 cursor-pointer items-center gap-3 min-w-0"
        onClick={onClick}
      >
        <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-aqua-100 text-xs font-medium text-aqua-700">
          {index + 1}
        </span>
        {stop.jobsite ? (
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sand-900">
              {stop.jobsite.name}
            </p>
            <p className="text-xs text-sand-500 truncate">
              {stop.jobsite.address_line1}, {stop.jobsite.city}
            </p>
          </div>
        ) : (
          <p className="text-sm text-sand-400">Unknown jobsite</p>
        )}
        <Eye className="h-4 w-4 flex-shrink-0 text-sand-300" />
      </div>
    </div>
  )
}

function RouteCard({ route, jobsites }: { route: RouteWithTech; jobsites: Jobsite[] }) {
  const router = useRouter()
  const [expanded, setExpanded] = useState(false)
  const [stops, setStops] = useState<RouteStop[]>([])

  async function handleStopClick(jobsiteId: string) {
    const supabase = createClient()
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('visits')
      .select('id')
      .eq('jobsite_id', jobsiteId)
      .eq('scheduled_date', today)
      .order('created_at', { ascending: false })
      .limit(1)

    if (data && data.length > 0) {
      router.push(`/dashboard/visits/${data[0].id}`)
    }
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  useEffect(() => {
    const order = Array.isArray(route.optimized_order) ? route.optimized_order : []
    const routeStops: RouteStop[] = order.map((jobsiteId: string) => ({
      id: jobsiteId,
      jobsite: jobsites.find((j) => j.id === jobsiteId) ?? null,
    }))
    setStops(routeStops)
  }, [route.optimized_order, jobsites])

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = stops.findIndex((s) => s.id === active.id)
    const newIndex = stops.findIndex((s) => s.id === over.id)
    const newStops = arrayMove(stops, oldIndex, newIndex)
    setStops(newStops)

    // Persist new order
    const supabase = createClient()
    await supabase
      .from('routes')
      .update({ optimized_order: newStops.map((s) => s.id) })
      .eq('id', route.id)
  }

  return (
    <Card className="p-4">
      <button
        className="flex w-full items-center justify-between text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-aqua-50 text-aqua-600">
            <MapPin className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-sand-900">{route.name}</p>
            <div className="flex items-center gap-3 text-xs text-sand-500">
              <span className="flex items-center gap-1">
                <UserIcon className="h-3 w-3" />
                {route.technician?.full_name ?? 'Unassigned'}
              </span>
              <span>{stops.length} stops</span>
              {route.total_estimated_minutes && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {route.total_estimated_minutes} min
                </span>
              )}
              {route.total_distance_miles && (
                <span>{Number(route.total_distance_miles)} mi</span>
              )}
            </div>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="h-5 w-5 text-sand-400" />
        ) : (
          <ChevronDown className="h-5 w-5 text-sand-400" />
        )}
      </button>

      {expanded && (
        <div className="mt-4 space-y-2">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={stops.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              {stops.map((stop, i) => (
                <SortableStop
                  key={stop.id}
                  stop={stop}
                  index={i}
                  onClick={() => handleStopClick(stop.id)}
                />
              ))}
            </SortableContext>
          </DndContext>

          {stops.length === 0 && (
            <p className="py-4 text-center text-sm text-sand-400">No stops assigned</p>
          )}
        </div>
      )}
    </Card>
  )
}

export default function RoutesPage() {
  const [routes, setRoutes] = useState<RouteWithTech[]>([])
  const [jobsites, setJobsites] = useState<Jobsite[]>([])
  const [loading, setLoading] = useState(true)
  const [activeDay, setActiveDay] = useState<DayOfWeek>('mon')

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient()
      const [routesRes, jobsitesRes] = await Promise.all([
        supabase
          .from('routes')
          .select('*, technician:users!routes_technician_id_fkey(full_name)')
          .order('name'),
        supabase.from('jobsites').select('id, name, address_line1, city'),
      ])
      setRoutes((routesRes.data ?? []) as unknown as RouteWithTech[])
      setJobsites((jobsitesRes.data ?? []) as Jobsite[])
      setLoading(false)

      // Set active day to first day that has routes
      const routeData = (routesRes.data ?? []) as unknown as RouteWithTech[]
      const daysWithRoutes = new Set(routeData.map((r) => r.day_of_week))
      const firstDay = DAYS.find((d) => daysWithRoutes.has(d))
      if (firstDay) setActiveDay(firstDay)
    }
    fetchData()
  }, [])

  const filteredRoutes = routes.filter((r) => r.day_of_week === activeDay)

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-12 w-full" />
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-sand-900">Routes</h1>
        <p className="text-sm text-sand-500">Manage daily service routes and stop ordering</p>
      </div>

      <div className="flex gap-1 rounded-lg bg-sand-100 p-1">
        {DAYS.map((day) => {
          const count = routes.filter((r) => r.day_of_week === day).length
          return (
            <button
              key={day}
              onClick={() => setActiveDay(day)}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                activeDay === day
                  ? 'bg-white text-aqua-700 shadow-sm'
                  : 'text-sand-500 hover:text-sand-700'
              }`}
            >
              {formatDayOfWeek(day).slice(0, 3)}
              {count > 0 && (
                <span className="ml-1 text-xs text-sand-400">({count})</span>
              )}
            </button>
          )
        })}
      </div>

      <div className="space-y-4">
        {filteredRoutes.length === 0 ? (
          <Card>
            <div className="py-8 text-center">
              <MapPin className="mx-auto mb-2 h-8 w-8 text-sand-300" />
              <p className="text-sm text-sand-500">
                No routes scheduled for {formatDayOfWeek(activeDay)}
              </p>
            </div>
          </Card>
        ) : (
          filteredRoutes.map((route) => (
            <RouteCard key={route.id} route={route} jobsites={jobsites} />
          ))
        )}
      </div>
    </div>
  )
}
