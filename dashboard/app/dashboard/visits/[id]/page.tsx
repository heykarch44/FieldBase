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
import type { VisitStatus } from '@/lib/types'
import {
  ArrowLeft,
  Clock,
  FileText,
  Camera,
  Wrench,
  MapPin,
  AlertTriangle,
  Layers,
  Phone,
  PenTool,
} from 'lucide-react'

interface Jobsite {
  id: string
  name: string
  address_line1: string
  city: string | null
  state: string | null
  zip: string | null
  contact_name: string | null
  contact_phone: string | null
}

interface Technician {
  full_name: string
  email: string | null
  phone: string | null
}

interface Visit {
  id: string
  status: VisitStatus
  scheduled_date: string
  arrived_at: string | null
  departed_at: string | null
  arrived_lat: number | null
  arrived_lng: number | null
  departed_lat: number | null
  departed_lng: number | null
  geofence_verified: boolean | null
  notes: string | null
  jobsite: Jobsite
  technician: Technician
}

interface FieldValue {
  id: string
  value: string | null
  field_definition: {
    id: string
    label: string
    field_type: string
    sort_order: number
  }
}

interface Photo {
  id: string
  storage_url: string
  caption: string | null
  photo_type: string
}

interface ServiceOrder {
  id: string
  title: string
  description: string | null
  urgency: string
  status: string
  estimated_cost: number | null
}

interface Signature {
  id: string
  signer_name: string | null
  storage_url: string
  signed_at: string
}

const statusBadgeVariant: Record<VisitStatus, 'green' | 'teal' | 'gray' | 'red'> = {
  completed: 'green',
  in_progress: 'teal',
  scheduled: 'gray',
  skipped: 'red',
}

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

export default function VisitDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string

  const [visit, setVisit] = useState<Visit | null>(null)
  const [fieldValues, setFieldValues] = useState<FieldValue[]>([])
  const [photos, setPhotos] = useState<Photo[]>([])
  const [serviceOrders, setServiceOrders] = useState<ServiceOrder[]>([])
  const [signatures, setSignatures] = useState<Signature[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!id) return

    setLoading(true)
    async function fetchVisitData() {
      const supabase = createClient()

      const [visitRes, fieldValuesRes, photosRes, ordersRes, signaturesRes] = await Promise.all([
        supabase
          .from('visits')
          .select(
            `*, jobsite:jobsites(id, name, address_line1, city, state, zip, contact_name, contact_phone),
             technician:users!visits_technician_id_fkey(full_name, email, phone)`
          )
          .eq('id', id)
          .single(),
        supabase
          .from('field_values')
          .select('id, value, field_definition:field_definitions(id, label, field_type, sort_order)')
          .eq('entity_type', 'visit')
          .eq('entity_id', id)
          .order('created_at', { ascending: true }),
        supabase
          .from('photos')
          .select('id, storage_url, caption, photo_type')
          .eq('entity_type', 'visit')
          .eq('entity_id', id)
          .order('created_at', { ascending: true }),
        supabase
          .from('service_orders')
          .select('id, title, description, urgency, status, estimated_cost')
          .eq('visit_id', id)
          .order('created_at', { ascending: true }),
        supabase
          .from('signatures')
          .select('id, signer_name, storage_url, signed_at')
          .eq('entity_type', 'visit')
          .eq('entity_id', id)
          .order('signed_at', { ascending: true }),
      ])

      if (!visitRes.data) {
        setNotFound(true)
        setLoading(false)
        return
      }

      setVisit(visitRes.data as unknown as Visit)
      setFieldValues((fieldValuesRes.data ?? []) as unknown as FieldValue[])
      setPhotos((photosRes.data ?? []) as Photo[])
      setServiceOrders((ordersRes.data ?? []) as ServiceOrder[])
      setSignatures((signaturesRes.data ?? []) as Signature[])
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

  const sortedFieldValues = [...fieldValues].sort((a, b) => {
    const aOrder = a.field_definition?.sort_order ?? 0
    const bOrder = b.field_definition?.sort_order ?? 0
    return aOrder - bOrder
  })

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
            {visit.jobsite?.name ?? 'Visit'}
          </h1>
          <p className="mt-0.5 text-sm text-sand-500">
            {visit.jobsite?.address_line1}
            {visit.jobsite?.city && `, ${visit.jobsite.city}`}
            {visit.jobsite?.state && `, ${visit.jobsite.state}`}
            {visit.jobsite?.zip && ` ${visit.jobsite.zip}`}
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
            {visit.geofence_verified === false && (
              <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
                <AlertTriangle className="h-4 w-4 flex-shrink-0 text-red-500" />
                Geofence alert — Technician was outside the expected area when they arrived
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
              <p className="mt-3 text-sm font-medium text-teal-600">
                Duration: {formatDuration(visit.arrived_at, visit.departed_at)}
              </p>
            )}

            {/* Technician info */}
            <div className="mt-4 flex items-center gap-3 border-t border-sand-100 pt-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-50 text-teal-600">
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

            {/* Jobsite contact */}
            {visit.jobsite?.contact_name && (
              <div className="mt-3 flex items-center gap-2 border-t border-sand-100 pt-3 text-sm text-sand-500">
                <span className="font-medium">Site contact:</span>
                {visit.jobsite.contact_name}
                {visit.jobsite.contact_phone && ` · ${visit.jobsite.contact_phone}`}
              </div>
            )}
          </Card>

          {/* Dynamic Field Values Card */}
          <Card>
            <CardTitle>
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-teal-500" />
                Field Data
              </div>
            </CardTitle>
            {sortedFieldValues.length === 0 ? (
              <p className="text-sm italic text-sand-400">No field data recorded</p>
            ) : (
              <div className="divide-y divide-sand-50">
                {sortedFieldValues.map((fv) => (
                  <div key={fv.id} className="flex items-start justify-between gap-4 py-2.5">
                    <p className="text-sm font-medium text-sand-600">
                      {fv.field_definition?.label ?? 'Unknown field'}
                    </p>
                    <p className="text-sm text-sand-800 text-right">
                      {fv.value ?? '—'}
                    </p>
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

          {/* Service Orders Card */}
          <Card>
            <CardTitle>
              <div className="flex items-center gap-2">
                <Wrench className="h-4 w-4 text-amber-500" />
                Service Orders
                {serviceOrders.length > 0 && (
                  <span className="ml-auto text-xs font-normal text-sand-400">{serviceOrders.length}</span>
                )}
              </div>
            </CardTitle>
            {serviceOrders.length === 0 ? (
              <p className="text-sm italic text-sand-400">No service orders</p>
            ) : (
              <div className="space-y-3">
                {serviceOrders.map((order) => (
                  <div key={order.id} className="rounded-lg border border-sand-100 bg-white p-3">
                    <div className="flex flex-wrap items-start justify-between gap-1.5">
                      <p className="text-sm font-medium text-sand-800">{order.title}</p>
                      <div className="flex flex-wrap gap-1">
                        <Badge variant={urgencyVariant(order.urgency)}>
                          {capitalizeFirst(order.urgency)}
                        </Badge>
                        <Badge variant="gray">
                          {capitalizeFirst(order.status.replace(/_/g, ' '))}
                        </Badge>
                      </div>
                    </div>
                    {order.description && (
                      <p className="mt-1.5 text-xs text-sand-500">{order.description}</p>
                    )}
                    {order.estimated_cost != null && (
                      <p className="mt-1 text-xs font-medium text-sand-600">
                        Est. cost: ${order.estimated_cost.toFixed(2)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Signatures Card */}
          <Card>
            <CardTitle>
              <div className="flex items-center gap-2">
                <PenTool className="h-4 w-4 text-indigo-500" />
                Signatures
                {signatures.length > 0 && (
                  <span className="ml-auto text-xs font-normal text-sand-400">{signatures.length}</span>
                )}
              </div>
            </CardTitle>
            {signatures.length === 0 ? (
              <p className="text-sm italic text-sand-400">No signatures captured</p>
            ) : (
              <div className="space-y-3">
                {signatures.map((sig) => (
                  <div key={sig.id} className="rounded-lg border border-sand-100 bg-white p-3">
                    <p className="text-sm font-medium text-sand-800">
                      {sig.signer_name ?? 'Unknown signer'}
                    </p>
                    <p className="text-xs text-sand-400">{formatDateTime(sig.signed_at)}</p>
                    <img
                      src={sig.storage_url}
                      alt={`Signature by ${sig.signer_name ?? 'unknown'}`}
                      className="mt-2 h-16 rounded border border-sand-100"
                    />
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
