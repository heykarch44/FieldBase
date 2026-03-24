'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Modal } from '@/components/ui/modal'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDateTime, formatTime, capitalizeFirst } from '@/lib/utils'
import type {
  ServiceVisit,
  Customer,
  User,
  ChemicalLog,
  VisitPhoto,
  RepairRequest,
  VisitStatus,
} from '@/lib/types'
import { Clock, FileText, FlaskConical, Camera, Wrench, MapPin, AlertTriangle, CheckCircle2, Circle, ClipboardList } from 'lucide-react'

interface VisitDetailModalProps {
  visitId: string | null
  open: boolean
  onClose: () => void
}

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

function formatDuration(arrivedAt: string, departedAt: string): string {
  const ms = new Date(departedAt).getTime() - new Date(arrivedAt).getTime()
  const mins = Math.round(ms / 60000)
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  const rem = mins % 60
  return rem > 0 ? `${hrs}h ${rem}m` : `${hrs}h`
}

export function VisitDetailModal({ visitId, open, onClose }: VisitDetailModalProps) {
  const [visit, setVisit] = useState<VisitWithRelations | null>(null)
  const [chemicals, setChemicals] = useState<ChemicalLog[]>([])
  const [photos, setPhotos] = useState<VisitPhoto[]>([])
  const [repairs, setRepairs] = useState<RepairRequest[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!visitId || !open) return

    setLoading(true)
    async function fetchVisitData() {
      const supabase = createClient()

      const [visitRes, chemRes, photoRes, repairRes] = await Promise.all([
        supabase
          .from('service_visits')
          .select(
            `*, customer:customers(*), technician:users!service_visits_technician_id_fkey(full_name, email, phone)`
          )
          .eq('id', visitId!)
          .single(),
        supabase
          .from('chemical_logs')
          .select('*')
          .eq('visit_id', visitId!)
          .order('logged_at', { ascending: true }),
        supabase
          .from('visit_photos')
          .select('*')
          .eq('visit_id', visitId!)
          .order('uploaded_at', { ascending: true }),
        supabase
          .from('repair_requests')
          .select('*')
          .eq('visit_id', visitId!)
          .order('created_at', { ascending: true }),
      ])

      setVisit((visitRes.data as unknown as VisitWithRelations) ?? null)
      setChemicals((chemRes.data as ChemicalLog[]) ?? [])
      setPhotos((photoRes.data as VisitPhoto[]) ?? [])
      setRepairs((repairRes.data as RepairRequest[]) ?? [])
      setLoading(false)
    }

    fetchVisitData()
  }, [visitId, open])

  // storage_url from the DB is already the full public URL (set by sync-engine)
  // so we use it directly — no need to prepend the Supabase URL

  return (
    <Modal open={open} onClose={onClose} title="Visit Details" className="max-w-2xl">
      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : !visit ? (
        <p className="py-8 text-center text-sm text-sand-500">Visit not found</p>
      ) : (
        <div className="space-y-5">
          {/* Header */}
          <div>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-sand-900">
                  {visit.customer?.first_name} {visit.customer?.last_name}
                </h3>
                <p className="text-sm text-sand-500">
                  {visit.customer?.address_line1}, {visit.customer?.city},{' '}
                  {visit.customer?.state} {visit.customer?.zip}
                </p>
              </div>
              <Badge variant={statusBadgeVariant[visit.status]}>
                {capitalizeFirst(visit.status.replace('_', ' '))}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-sand-400">
              Technician: {visit.technician?.full_name ?? 'Unknown'}
              {visit.technician?.phone && ` · ${visit.technician.phone}`}
            </p>
          </div>

          {/* Timestamps & GPS */}
          <div className="rounded-lg bg-sand-50 p-3">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-sand-400" />
              <span className="text-sm font-medium text-sand-700">Timestamps</span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-sand-400">Arrived</p>
                <p className="text-sand-700">
                  {visit.arrived_at ? formatDateTime(visit.arrived_at) : '—'}
                </p>
                {visit.arrived_lat != null && visit.arrived_lng != null && (
                  <p className="text-[10px] text-sand-400">
                    <MapPin className="mr-0.5 inline h-3 w-3" />
                    {visit.arrived_lat.toFixed(5)}, {visit.arrived_lng.toFixed(5)}
                  </p>
                )}
                {visit.geofence_flagged && (
                  <div className="mt-1 flex items-center gap-1 rounded bg-red-50 px-2 py-1">
                    <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                    <span className="text-xs font-medium text-red-600">
                      Geofence alert — {visit.arrived_distance_meters != null
                        ? `${Math.round(visit.arrived_distance_meters)}m from location`
                        : 'Outside service area'}
                    </span>
                  </div>
                )}
                {visit.arrived_distance_meters != null && !visit.geofence_flagged && (
                  <p className="text-[10px] text-sand-400">
                    {Math.round(visit.arrived_distance_meters)}m from service address
                  </p>
                )}
              </div>
              <div>
                <p className="text-xs text-sand-400">Departed</p>
                <p className="text-sand-700">
                  {visit.departed_at ? formatDateTime(visit.departed_at) : '—'}
                </p>
                {visit.departed_lat != null && visit.departed_lng != null && (
                  <p className="text-[10px] text-sand-400">
                    <MapPin className="mr-0.5 inline h-3 w-3" />
                    {visit.departed_lat.toFixed(5)}, {visit.departed_lng.toFixed(5)}
                  </p>
                )}
              </div>
            </div>
            {visit.arrived_at && visit.departed_at && (
              <p className="mt-2 text-xs font-medium text-aqua-600">
                Duration: {formatDuration(visit.arrived_at, visit.departed_at)}
              </p>
            )}
          </div>

          {/* Service Checklist */}
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <ClipboardList className="h-4 w-4 text-aqua-500" />
              <span className="text-sm font-medium text-sand-700">Service Checklist</span>
            </div>
            {visit.checklist && typeof visit.checklist === 'object' && Object.keys(visit.checklist).length > 0 ? (
              <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                {CHECKLIST_ITEMS.map((item) => {
                  const checked = !!(visit.checklist as Record<string, boolean>)?.[item.key]
                  return (
                    <div key={item.key} className="flex items-center gap-2 rounded-md px-2 py-1">
                      {checked ? (
                        <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-500" />
                      ) : (
                        <Circle className="h-4 w-4 flex-shrink-0 text-sand-300" />
                      )}
                      <span className={`text-sm ${checked ? 'text-sand-700' : 'text-sand-400'}`}>
                        {item.label}
                      </span>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-sand-400 italic">No checklist recorded</p>
            )}
          </div>

          {/* Technician Notes */}
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <FileText className="h-4 w-4 text-sand-400" />
              <span className="text-sm font-medium text-sand-700">Technician Notes</span>
            </div>
            {visit.notes ? (
              <p className="rounded-lg bg-sand-50 p-3 text-sm text-sand-700 whitespace-pre-wrap">
                {visit.notes}
              </p>
            ) : (
              <p className="text-sm text-sand-400 italic">No notes recorded</p>
            )}
          </div>

          {/* Chemical Log */}
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <FlaskConical className="h-4 w-4 text-emerald-500" />
              <span className="text-sm font-medium text-sand-700">Chemical Log</span>
            </div>
            {chemicals.length === 0 ? (
              <p className="text-sm text-sand-400 italic">No chemicals logged</p>
            ) : (
              <div className="space-y-3">
                {chemicals.map((chem) => (
                  <div
                    key={chem.id}
                    className="rounded-lg border border-sand-100 bg-white p-3"
                  >
                    {chem.chemical_name && (
                      <p className="mb-1.5 text-sm font-medium text-sand-800">
                        {chem.chemical_name}
                        {chem.amount != null && chem.unit && (
                          <span className="ml-2 font-normal text-sand-500">
                            {chem.amount} {chem.unit}
                          </span>
                        )}
                      </p>
                    )}
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-3">
                      {chem.ph_before != null && (
                        <ReadingRow label="pH" before={chem.ph_before} after={chem.ph_after} />
                      )}
                      {chem.chlorine_before != null && (
                        <ReadingRow
                          label="Chlorine"
                          before={chem.chlorine_before}
                          after={chem.chlorine_after}
                        />
                      )}
                      {chem.alkalinity_before != null && (
                        <ReadingRow
                          label="Alkalinity"
                          before={chem.alkalinity_before}
                          after={chem.alkalinity_after}
                        />
                      )}
                      {chem.cya_before != null && (
                        <ReadingRow label="CYA" before={chem.cya_before} after={chem.cya_after} />
                      )}
                      {chem.calcium_hardness != null && (
                        <div className="col-span-1">
                          <span className="text-sand-400">Calcium: </span>
                          <span className="text-sand-700">{chem.calcium_hardness}</span>
                        </div>
                      )}
                      {chem.salt_level != null && (
                        <div className="col-span-1">
                          <span className="text-sand-400">Salt: </span>
                          <span className="text-sand-700">{chem.salt_level}</span>
                        </div>
                      )}
                      {chem.water_temp != null && (
                        <div className="col-span-1">
                          <span className="text-sand-400">Temp: </span>
                          <span className="text-sand-700">{chem.water_temp}°F</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Photos */}
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <Camera className="h-4 w-4 text-violet-500" />
              <span className="text-sm font-medium text-sand-700">Photos</span>
            </div>
            {photos.length === 0 ? (
              <p className="text-sm text-sand-400 italic">No photos taken</p>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {photos.map((photo) => {
                  const fullUrl = photo.storage_url
                  return (
                    <a
                      key={photo.id}
                      href={fullUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group relative overflow-hidden rounded-lg"
                    >
                      <img
                        src={fullUrl}
                        alt={photo.caption ?? 'Visit photo'}
                        className="h-28 w-full object-cover transition-transform group-hover:scale-105"
                      />
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-1.5">
                        <Badge variant="gray" className="text-[10px]">
                          {capitalizeFirst(photo.photo_type)}
                        </Badge>
                        {photo.caption && (
                          <p className="mt-0.5 text-[10px] text-white truncate">
                            {photo.caption}
                          </p>
                        )}
                      </div>
                    </a>
                  )
                })}
              </div>
            )}
          </div>

          {/* Repair Requests */}
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <Wrench className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-medium text-sand-700">Repair Requests</span>
            </div>
            {repairs.length === 0 ? (
              <p className="text-sm text-sand-400 italic">No repairs requested</p>
            ) : (
              <div className="space-y-2">
                {repairs.map((repair) => (
                  <div
                    key={repair.id}
                    className="rounded-lg border border-sand-100 bg-white p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-sand-800">
                        {capitalizeFirst(repair.category.replace(/_/g, ' '))}
                      </p>
                      <div className="flex gap-1.5">
                        <Badge variant={urgencyVariant(repair.urgency)}>
                          {capitalizeFirst(repair.urgency)}
                        </Badge>
                        <Badge variant="gray">
                          {capitalizeFirst(repair.status.replace(/_/g, ' '))}
                        </Badge>
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-sand-500">{repair.description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}

function ReadingRow({
  label,
  before,
  after,
}: {
  label: string
  before: number | null
  after: number | null
}) {
  return (
    <div className="col-span-1">
      <span className="text-sand-400">{label}: </span>
      <span className="text-sand-700">
        {before}
        {after != null && <span className="text-sand-400"> → </span>}
        {after != null && <span className="text-emerald-600">{after}</span>}
      </span>
    </div>
  )
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
