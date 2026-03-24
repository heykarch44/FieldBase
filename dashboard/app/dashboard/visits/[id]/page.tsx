'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Card, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { formatDateTime, capitalizeFirst, cn } from '@/lib/utils'
import type {
  ServiceVisit,
  Customer,
  User,
  ChemicalLog,
  VisitPhoto,
  RepairRequest,
  VisitStatus,
} from '@/lib/types'
import {
  ArrowLeft,
  Clock,
  FileText,
  FlaskConical,
  Camera,
  Wrench,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  Circle,
  ClipboardList,
  Phone,
} from 'lucide-react'

type VisitWithRelations = ServiceVisit & {
  customer: Customer
  technician: Pick<User, 'full_name' | 'email' | 'phone'>
}

const statusBadgeVariant: Record<VisitStatus, 'green' | 'aqua' | 'gray' | 'red'> = {
  completed: 'green',
  in_progress: 'aqua',
  scheduled: 'gray',
  skipped: 'red',
}

const CHECKLIST_ITEMS = [
  { key: 'skim_surface', label: 'Skim surface' },
  { key: 'brush_walls', label: 'Brush walls & tile' },
  { key: 'vacuum_pool', label: 'Vacuum pool' },
  { key: 'empty_skimmer_baskets', label: 'Empty skimmer baskets' },
  { key: 'empty_pump_basket', label: 'Empty pump basket' },
  { key: 'backwash_filter', label: 'Backwash filter' },
  { key: 'check_equipment', label: 'Check equipment operation' },
]

const CHEMICAL_FIELDS = [
  { label: 'pH', beforeKey: 'ph_before', afterKey: 'ph_after', unit: null },
  { label: 'Chlorine', beforeKey: 'chlorine_before', afterKey: 'chlorine_after', unit: 'ppm' },
  { label: 'Alkalinity', beforeKey: 'alkalinity_before', afterKey: 'alkalinity_after', unit: 'ppm' },
  { label: 'CYA', beforeKey: 'cya_before', afterKey: 'cya_after', unit: null },
] as const

const CHEMICAL_SINGLE_FIELDS = [
  { label: 'Calcium Hardness', key: 'calcium_hardness', unit: null },
  { label: 'Salt Level', key: 'salt_level', unit: null },
  { label: 'Water Temp', key: 'water_temp', unit: '°F' },
] as const

function formatDuration(arrivedAt: string, departedAt: string): string {
  const ms = new Date(departedAt).getTime() - new Date(arrivedAt).getTime()
  const mins = Math.round(ms / 60000)
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  const rem = mins % 60
  return rem > 0 ? `${hrs}h ${rem}m` : `${hrs}h`
}

function urgencyVariant(urgency: string): 'green' | 'amber' | 'red' | 'gray' {
  switch (urgency) {
    case 'low':
      return 'green'
    case 'medium':
      return 'amber'
    case 'high':
    case 'emergency':
      return 'red'
    default:
      return 'gray'
  }
}

function MissingReading() {
  return (
    <span className="inline-flex items-center gap-1 text-sand-400">
      <span>—</span>
      <AlertTriangle className="h-3.5 w-3.5 text-amber-400" aria-label="Not tested" />
    </span>
  )
}

export default function VisitDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string

  const [visit, setVisit] = useState<VisitWithRelations | null>(null)
  const [chemicals, setChemicals] = useState<ChemicalLog[]>([])
  const [photos, setPhotos] = useState<VisitPhoto[]>([])
  const [repairs, setRepairs] = useState<RepairRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!id) return

    setLoading(true)
    async function fetchVisitData() {
      const supabase = createClient()

      const [visitRes, chemRes, photoRes, repairRes] = await Promise.all([
        supabase
          .from('service_visits')
          .select(
            `*, customer:customers(*), technician:users!service_visits_technician_id_fkey(full_name, email, phone)`
          )
          .eq('id', id)
          .single(),
        supabase
          .from('chemical_logs')
          .select('*')
          .eq('visit_id', id)
          .order('logged_at', { ascending: true }),
        supabase
          .from('visit_photos')
          .select('*')
          .eq('visit_id', id)
          .order('uploaded_at', { ascending: true }),
        supabase
          .from('repair_requests')
          .select('*')
          .eq('visit_id', id)
          .order('created_at', { ascending: true }),
      ])

      if (!visitRes.data) {
        setNotFound(true)
        setLoading(false)
        return
      }

      setVisit((visitRes.data as unknown as VisitWithRelations) ?? null)
      setChemicals((chemRes.data as ChemicalLog[]) ?? [])
      setPhotos((photoRes.data as VisitPhoto[]) ?? [])
      setRepairs((repairRes.data as RepairRequest[]) ?? [])
      setLoading(false)
    }

    fetchVisitData()
  }, [id])

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-6 p-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-56 w-full" />
            <Skeleton className="h-72 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
      </div>
    )
  }

  if (notFound || !visit) {
    return (
      <div className="mx-auto max-w-6xl p-6">
        <Button variant="ghost" className="mb-6" onClick={() => router.push('/dashboard')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>
        <div className="flex flex-col items-center py-16 text-center">
          <p className="text-lg font-medium text-sand-700">Visit not found</p>
          <p className="mt-1 text-sm text-sand-400">This visit may have been removed.</p>
        </div>
      </div>
    )
  }

  const checklist = visit.checklist as Record<string, boolean> | null

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      {/* Back button */}
      <div>
        <button
          onClick={() => router.push('/dashboard')}
          className="inline-flex items-center gap-1.5 text-sm text-sand-500 transition-colors hover:text-sand-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </button>
      </div>

      {/* Page header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-sand-900 sm:text-3xl">
            {visit.customer?.first_name} {visit.customer?.last_name}
          </h1>
          <p className="mt-0.5 text-sm text-sand-500">
            {visit.customer?.address_line1}
            {visit.customer?.city && `, ${visit.customer.city}`}
            {visit.customer?.state && `, ${visit.customer.state}`}
            {visit.customer?.zip && ` ${visit.customer.zip}`}
          </p>

        </div>
        <div className="flex-shrink-0">
          <Badge variant={statusBadgeVariant[visit.status]} className="text-sm">
            {capitalizeFirst(visit.status.replace('_', ' '))}
          </Badge>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* LEFT COLUMN — main content */}
        <div className="space-y-5 lg:col-span-2">

          {/* Timestamps & GPS Card */}
          <Card>
            <CardTitle>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-sand-400" />
                Timestamps &amp; Location
              </div>
            </CardTitle>
            {visit.geofence_flagged && (
              <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
                <AlertTriangle className="h-4 w-4 flex-shrink-0 text-red-500" />
                Geofence alert —{' '}
                {visit.arrived_distance_meters != null
                  ? `${Math.round(visit.arrived_distance_meters)}m from service address`
                  : 'Technician was outside the service area when they arrived'}
              </div>
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-lg bg-sand-50 p-3">
                <p className="text-xs font-medium text-sand-400 uppercase tracking-wide">Arrived</p>
                <p className="mt-1 text-sm font-medium text-sand-800">
                  {visit.arrived_at ? formatDateTime(visit.arrived_at) : '—'}
                </p>
                {visit.arrived_lat != null && visit.arrived_lng != null && (
                  <p className="mt-1 flex items-center gap-0.5 text-[11px] text-sand-400">
                    <MapPin className="h-3 w-3" />
                    {visit.arrived_lat.toFixed(5)}, {visit.arrived_lng.toFixed(5)}
                  </p>
                )}
                {visit.arrived_distance_meters != null && !visit.geofence_flagged && (
                  <p className="mt-0.5 text-[11px] text-sand-400">
                    {Math.round(visit.arrived_distance_meters)}m from service address
                  </p>
                )}
              </div>
              <div className="rounded-lg bg-sand-50 p-3">
                <p className="text-xs font-medium text-sand-400 uppercase tracking-wide">Departed</p>
                <p className="mt-1 text-sm font-medium text-sand-800">
                  {visit.departed_at ? formatDateTime(visit.departed_at) : '—'}
                </p>
                {visit.departed_lat != null && visit.departed_lng != null && (
                  <p className="mt-1 flex items-center gap-0.5 text-[11px] text-sand-400">
                    <MapPin className="h-3 w-3" />
                    {visit.departed_lat.toFixed(5)}, {visit.departed_lng.toFixed(5)}
                  </p>
                )}
              </div>
            </div>
            {visit.arrived_at && visit.departed_at && (
              <p className="mt-3 text-sm font-medium text-aqua-600">
                Duration: {formatDuration(visit.arrived_at, visit.departed_at)}
              </p>
            )}

            {/* Technician info */}
            <div className="mt-4 flex items-center gap-3 border-t border-sand-100 pt-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-aqua-50 text-aqua-600">
                <span className="text-sm font-semibold">
                  {(visit.technician?.full_name ?? 'U').charAt(0)}
                </span>
              </div>
              <div className="text-sm">
                <p className="font-medium text-sand-700">{visit.technician?.full_name ?? 'Unknown'}</p>
                <div className="flex items-center gap-2 text-xs text-sand-400">
                  {visit.technician?.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {visit.technician.phone}
                    </span>
                  )}
                  {visit.technician?.email && (
                    <span>{visit.technician.email}</span>
                  )}
                </div>
              </div>
            </div>
          </Card>

          {/* Service Checklist Card */}
          <Card>
            <CardTitle>
              <div className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-aqua-500" />
                Service Checklist
              </div>
            </CardTitle>
            {checklist && typeof checklist === 'object' && Object.keys(checklist).length > 0 ? (
              <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                {CHECKLIST_ITEMS.map((item) => {
                  const checked = !!(checklist)?.[item.key]
                  return (
                    <div
                      key={item.key}
                      className="flex items-center gap-2.5 rounded-md px-2 py-1.5"
                    >
                      {checked ? (
                        <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-500" />
                      ) : (
                        <Circle className="h-4 w-4 flex-shrink-0 text-sand-300" />
                      )}
                      <span className={cn('text-sm', checked ? 'text-sand-700' : 'text-sand-400')}>
                        {item.label}
                      </span>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm italic text-sand-400">No checklist recorded</p>
            )}
          </Card>

          {/* Chemical Log Card */}
          <Card>
            <CardTitle>
              <div className="flex items-center gap-2">
                <FlaskConical className="h-4 w-4 text-emerald-500" />
                Chemical Log
              </div>
            </CardTitle>

            {chemicals.length === 0 ? (
              <div className="flex items-start gap-3 rounded-lg bg-amber-50 px-4 py-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-500" />
                <div>
                  <p className="text-sm font-medium text-amber-800">No chemical log recorded</p>
                  <p className="text-xs text-amber-600">The technician did not log any chemical readings for this visit.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                {chemicals.map((chem) => (
                  <div key={chem.id} className="rounded-lg border border-sand-100 bg-white p-4">
                    {/* Before/After readings */}
                    <div className="mb-4">
                      <div className="mb-2 grid grid-cols-3 gap-2 text-xs font-medium text-sand-400 uppercase tracking-wide">
                        <div>Parameter</div>
                        <div>Before</div>
                        <div>After</div>
                      </div>
                      <div className="divide-y divide-sand-50">
                        {CHEMICAL_FIELDS.map(({ label, beforeKey, afterKey, unit }) => {
                          const beforeVal = chem[beforeKey]
                          const afterVal = chem[afterKey]
                          return (
                            <div key={label} className="grid grid-cols-3 gap-2 py-2 text-sm">
                              <div className="font-medium text-sand-600">
                                {label}
                                {unit && <span className="ml-1 text-xs font-normal text-sand-400">({unit})</span>}
                              </div>
                              <div>
                                {beforeVal != null ? (
                                  <span className="text-sand-800">{beforeVal}</span>
                                ) : (
                                  <MissingReading />
                                )}
                              </div>
                              <div>
                                {afterVal != null ? (
                                  <span className="font-medium text-emerald-600">{afterVal}</span>
                                ) : (
                                  <MissingReading />
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Single value readings */}
                    <div className="grid grid-cols-3 gap-3 border-t border-sand-100 pt-3">
                      {CHEMICAL_SINGLE_FIELDS.map(({ label, key, unit }) => {
                        const val = chem[key]
                        return (
                          <div key={key}>
                            <p className="text-xs text-sand-400">{label}</p>
                            <p className="mt-0.5 text-sm">
                              {val != null ? (
                                <span className="font-medium text-sand-800">
                                  {val}{unit}
                                </span>
                              ) : (
                                <MissingReading />
                              )}
                            </p>
                          </div>
                        )
                      })}
                    </div>

                    {/* Chemicals added sub-section */}
                    {chem.chemical_name && (
                      <div className="mt-4 border-t border-sand-100 pt-3">
                        <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-sand-400">
                          Chemicals Added
                        </p>
                        <div className="flex items-center gap-2 text-sm text-sand-700">
                          <span className="font-medium">{chem.chemical_name}</span>
                          {chem.amount != null && chem.unit && (
                            <span className="text-sand-500">
                              — {chem.amount} {chem.unit}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Technician Notes Card */}
          <Card>
            <CardTitle>
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-sand-400" />
                Technician Notes
              </div>
            </CardTitle>
            {visit.notes ? (
              <p className="whitespace-pre-wrap text-sm text-sand-700">{visit.notes}</p>
            ) : (
              <p className="text-sm italic text-sand-400">No notes recorded</p>
            )}
          </Card>
        </div>

        {/* RIGHT COLUMN — sidebar */}
        <div className="space-y-5">

          {/* Photos Card */}
          <Card>
            <CardTitle>
              <div className="flex items-center gap-2">
                <Camera className="h-4 w-4 text-violet-500" />
                Photos
                {photos.length > 0 && (
                  <span className="ml-auto text-xs font-normal text-sand-400">{photos.length}</span>
                )}
              </div>
            </CardTitle>
            {photos.length === 0 ? (
              <p className="text-sm italic text-sand-400">No photos taken</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {photos.map((photo) => (
                  <a
                    key={photo.id}
                    href={photo.storage_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative overflow-hidden rounded-lg"
                  >
                    <img
                      src={photo.storage_url}
                      alt={photo.caption ?? 'Visit photo'}
                      className="h-36 w-full object-cover transition-transform duration-200 group-hover:scale-105"
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                      <Badge variant="gray" className="text-[10px]">
                        {capitalizeFirst(photo.photo_type)}
                      </Badge>
                      {photo.caption && (
                        <p className="mt-0.5 truncate text-[10px] text-white">{photo.caption}</p>
                      )}
                    </div>
                  </a>
                ))}
              </div>
            )}
          </Card>

          {/* Repair Requests Card */}
          <Card>
            <CardTitle>
              <div className="flex items-center gap-2">
                <Wrench className="h-4 w-4 text-amber-500" />
                Repair Requests
                {repairs.length > 0 && (
                  <span className="ml-auto text-xs font-normal text-sand-400">{repairs.length}</span>
                )}
              </div>
            </CardTitle>
            {repairs.length === 0 ? (
              <p className="text-sm italic text-sand-400">No repairs requested</p>
            ) : (
              <div className="space-y-3">
                {repairs.map((repair) => (
                  <div key={repair.id} className="rounded-lg border border-sand-100 bg-white p-3">
                    <div className="flex flex-wrap items-start justify-between gap-1.5">
                      <p className="text-sm font-medium text-sand-800">
                        {capitalizeFirst(repair.category.replace(/_/g, ' '))}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        <Badge variant={urgencyVariant(repair.urgency)}>
                          {capitalizeFirst(repair.urgency)}
                        </Badge>
                        <Badge variant="gray">
                          {capitalizeFirst(repair.status.replace(/_/g, ' '))}
                        </Badge>
                      </div>
                    </div>
                    <p className="mt-1.5 text-xs text-sand-500">{repair.description}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
