'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Card, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Modal } from '@/components/ui/modal'
import { formatDate, formatDateTime, capitalizeFirst, cn } from '@/lib/utils'
import type { Jobsite, ServiceOrder, Visit, Equipment, UrgencyLevel, ServiceOrderStatus } from '@/lib/types'
import {
  ArrowLeft,
  MapPin,
  Phone,
  Mail,
  FileText,
  ClipboardList,
  Clock,
  Wrench,
  Package,
  Plus,
  Building2,
  Calendar,
  User,
  AlertTriangle,
  Info,
  Upload,
  Download,
  Trash2,
  File,
  FileSpreadsheet,
  FileImage,
  Loader2,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TabKey = 'overview' | 'service_orders' | 'visits' | 'documents' | 'equipment'

interface Tab {
  key: TabKey
  label: string
  icon: React.ReactNode
}

const TABS: Tab[] = [
  { key: 'overview', label: 'Overview', icon: <Info className="h-4 w-4" /> },
  { key: 'service_orders', label: 'Service Orders', icon: <ClipboardList className="h-4 w-4" /> },
  { key: 'visits', label: 'Visits', icon: <Clock className="h-4 w-4" /> },
  { key: 'documents', label: 'Documents', icon: <FileText className="h-4 w-4" /> },
  { key: 'equipment', label: 'Equipment', icon: <Wrench className="h-4 w-4" /> },
]

// Urgency helpers
const urgencyColor: Record<string, string> = {
  low: 'bg-emerald-50 text-emerald-700',
  medium: 'bg-amber-50 text-amber-700',
  high: 'bg-orange-50 text-orange-700',
  emergency: 'bg-red-50 text-red-700',
}

function urgencyBadgeVariant(u: string): 'green' | 'amber' | 'red' | 'gray' {
  switch (u) {
    case 'low': return 'green'
    case 'medium': return 'amber'
    case 'high':
    case 'emergency': return 'red'
    default: return 'gray'
  }
}

function statusBadgeVariant(s: string): 'green' | 'teal' | 'amber' | 'gray' | 'red' {
  switch (s) {
    case 'completed': return 'green'
    case 'in_progress': return 'teal'
    case 'scheduled':
    case 'approved': return 'amber'
    case 'canceled':
    case 'cancelled': return 'red'
    default: return 'gray'
  }
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function SiteDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string

  const [site, setSite] = useState<Jobsite | null>(null)
  const [serviceOrders, setServiceOrders] = useState<ServiceOrder[]>([])
  const [visits, setVisits] = useState<Visit[]>([])
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [activeTab, setActiveTab] = useState<TabKey>('overview')
  const [showAddOrder, setShowAddOrder] = useState(false)
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!id) return
    setLoading(true)

    const supabase = createClient()

    // Get user's org_id
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: userData } = await supabase
        .from('users')
        .select('active_org_id')
        .eq('id', user.id)
        .single()
      if (userData?.active_org_id) setActiveOrgId(userData.active_org_id)
    }

    const [siteRes, ordersRes, visitsRes, equipmentRes] = await Promise.all([
      supabase
        .from('jobsites')
        .select('*')
        .eq('id', id)
        .single(),
      supabase
        .from('service_orders')
        .select('*, assignee:users!service_orders_assigned_to_fkey(full_name)')
        .eq('jobsite_id', id)
        .order('created_at', { ascending: false }),
      supabase
        .from('visits')
        .select('*, technician:users!visits_technician_id_fkey(full_name)')
        .eq('jobsite_id', id)
        .order('scheduled_date', { ascending: false }),
      supabase
        .from('equipment')
        .select('*')
        .eq('jobsite_id', id)
        .order('name'),
    ])

    if (!siteRes.data) {
      setNotFound(true)
      setLoading(false)
      return
    }

    setSite(siteRes.data as Jobsite)
    setServiceOrders((ordersRes.data ?? []) as ServiceOrder[])
    setVisits((visitsRes.data ?? []) as Visit[])
    setEquipment((equipmentRes.data ?? []) as Equipment[])
    setLoading(false)
  }, [id])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // ---------- Loading state ----------
  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-10 w-full max-w-xl" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-56 w-full" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-48 w-full" />
          </div>
        </div>
      </div>
    )
  }

  // ---------- Not found ----------
  if (notFound || !site) {
    return (
      <div className="mx-auto max-w-6xl p-6">
        <Button variant="ghost" className="mb-6" onClick={() => router.push('/dashboard/jobsites')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Sites
        </Button>
        <div className="flex flex-col items-center py-16 text-center">
          <Building2 className="mb-3 h-10 w-10 text-sand-300" />
          <p className="text-lg font-medium text-sand-700">Site not found</p>
          <p className="mt-1 text-sm text-sand-400">This site may have been removed.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      {/* Back button */}
      <div>
        <button
          onClick={() => router.push('/dashboard/jobsites')}
          className="inline-flex items-center gap-1.5 text-sm text-sand-500 transition-colors hover:text-sand-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Sites
        </button>
      </div>

      {/* Page header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-50">
              <MapPin className="h-5 w-5 text-teal-600" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold text-sand-900 sm:text-3xl">
                {site.name}
              </h1>
              <p className="mt-0.5 text-sm text-sand-500">
                {site.address_line1}
                {site.city && `, ${site.city}`}
                {site.state && `, ${site.state}`}
                {site.zip && ` ${site.zip}`}
              </p>
            </div>
          </div>
        </div>
        <div className="flex-shrink-0">
          <span
            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
              site.status === 'active'
                ? 'bg-emerald-50 text-emerald-700'
                : site.status === 'lead'
                ? 'bg-amber-50 text-amber-700'
                : 'bg-sand-100 text-sand-600'
            }`}
          >
            {capitalizeFirst(site.status)}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-sand-200">
        <nav className="-mb-px flex space-x-6 overflow-x-auto" aria-label="Tabs">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex items-center gap-2 whitespace-nowrap border-b-2 px-1 py-3 text-sm font-medium transition-colors',
                activeTab === tab.key
                  ? 'border-teal-600 text-teal-700'
                  : 'border-transparent text-sand-500 hover:border-sand-300 hover:text-sand-700'
              )}
            >
              {tab.icon}
              {tab.label}
              {tab.key === 'service_orders' && serviceOrders.length > 0 && (
                <span className="ml-1 rounded-full bg-sand-100 px-2 py-0.5 text-xs font-medium text-sand-600">
                  {serviceOrders.length}
                </span>
              )}
              {tab.key === 'visits' && visits.length > 0 && (
                <span className="ml-1 rounded-full bg-sand-100 px-2 py-0.5 text-xs font-medium text-sand-600">
                  {visits.length}
                </span>
              )}
              {tab.key === 'equipment' && equipment.length > 0 && (
                <span className="ml-1 rounded-full bg-sand-100 px-2 py-0.5 text-xs font-medium text-sand-600">
                  {equipment.length}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && (
        <OverviewTab site={site} serviceOrders={serviceOrders} visits={visits} equipment={equipment} />
      )}
      {activeTab === 'service_orders' && (
        <ServiceOrdersTab
          serviceOrders={serviceOrders}
          onAdd={() => setShowAddOrder(true)}
        />
      )}
      {activeTab === 'visits' && <VisitsTab visits={visits} />}
      {activeTab === 'documents' && <DocumentsTab orgId={activeOrgId} siteId={id} />}
      {activeTab === 'equipment' && <EquipmentTab equipment={equipment} />}

      {/* Add Service Order Modal */}
      <Modal
        open={showAddOrder}
        onClose={() => setShowAddOrder(false)}
        title="Add Service Order"
        className="max-w-xl"
      >
        <AddServiceOrderForm
          orgId={activeOrgId}
          jobsiteId={id}
          onSuccess={() => {
            setShowAddOrder(false)
            fetchData()
          }}
          onCancel={() => setShowAddOrder(false)}
        />
      </Modal>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab: Overview
// ---------------------------------------------------------------------------

function OverviewTab({
  site,
  serviceOrders,
  visits,
  equipment,
}: {
  site: Jobsite
  serviceOrders: ServiceOrder[]
  visits: Visit[]
  equipment: Equipment[]
}) {
  const activeOrders = serviceOrders.filter(
    (o) => !['completed', 'canceled', 'invoiced'].includes(o.status)
  ).length
  const completedVisits = visits.filter((v) => v.status === 'completed').length

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Left column */}
      <div className="space-y-5 lg:col-span-2">
        {/* Site Info Card */}
        <Card>
          <CardTitle>
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-teal-500" />
              Site Information
            </div>
          </CardTitle>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-lg bg-sand-50 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-sand-400">Address</p>
              <p className="mt-1 text-sm font-medium text-sand-800">
                {site.address_line1}
                {site.address_line2 && <><br />{site.address_line2}</>}
              </p>
              <p className="text-sm text-sand-600">
                {site.city}, {site.state} {site.zip}
              </p>
            </div>
            <div className="rounded-lg bg-sand-50 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-sand-400">Status</p>
              <p className="mt-1 text-sm font-medium text-sand-800">{capitalizeFirst(site.status)}</p>
              <p className="text-xs text-sand-400">
                Created {formatDate(site.created_at)}
              </p>
            </div>
          </div>

          {/* Contact info */}
          {(site.contact_name || site.contact_email || site.contact_phone) && (
            <div className="mt-4 border-t border-sand-100 pt-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-sand-400">
                Contact
              </p>
              <div className="space-y-2">
                {site.contact_name && (
                  <div className="flex items-center gap-2 text-sm text-sand-700">
                    <User className="h-4 w-4 text-sand-400" />
                    {site.contact_name}
                  </div>
                )}
                {site.contact_phone && (
                  <div className="flex items-center gap-2 text-sm text-sand-700">
                    <Phone className="h-4 w-4 text-sand-400" />
                    {site.contact_phone}
                  </div>
                )}
                {site.contact_email && (
                  <div className="flex items-center gap-2 text-sm text-sand-700">
                    <Mail className="h-4 w-4 text-sand-400" />
                    {site.contact_email}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Access Notes */}
          {site.access_notes && (
            <div className="mt-4 border-t border-sand-100 pt-4">
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-sand-400">
                Access Notes
              </p>
              <p className="whitespace-pre-wrap text-sm text-sand-700">{site.access_notes}</p>
            </div>
          )}

          {/* Tags */}
          {site.tags && site.tags.length > 0 && (
            <div className="mt-4 border-t border-sand-100 pt-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-sand-400">
                Tags
              </p>
              <div className="flex flex-wrap gap-1.5">
                {site.tags.map((tag) => (
                  <Badge key={tag} variant="teal">{tag}</Badge>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Right column — quick stats */}
      <div className="space-y-5">
        <Card>
          <CardTitle>Quick Stats</CardTitle>
          <div className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-sand-600">Active Orders</span>
              <span className="text-lg font-semibold text-teal-700">{activeOrders}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-sand-600">Total Orders</span>
              <span className="text-lg font-semibold text-sand-800">{serviceOrders.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-sand-600">Completed Visits</span>
              <span className="text-lg font-semibold text-sand-800">{completedVisits}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-sand-600">Total Visits</span>
              <span className="text-lg font-semibold text-sand-800">{visits.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-sand-600">Equipment</span>
              <span className="text-lg font-semibold text-sand-800">{equipment.length}</span>
            </div>
          </div>
        </Card>

        {/* Recent activity */}
        {visits.length > 0 && (
          <Card>
            <CardTitle>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-sand-400" />
                Recent Visits
              </div>
            </CardTitle>
            <div className="mt-3 space-y-3">
              {visits.slice(0, 3).map((v) => (
                <div key={v.id} className="rounded-lg border border-sand-100 bg-white p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-sand-800">
                      {formatDate(v.scheduled_date)}
                    </p>
                    <Badge variant={v.status === 'completed' ? 'green' : v.status === 'in_progress' ? 'teal' : 'gray'}>
                      {capitalizeFirst(v.status.replace(/_/g, ' '))}
                    </Badge>
                  </div>
                  {(v as unknown as { technician?: { full_name: string } }).technician && (
                    <p className="mt-1 text-xs text-sand-500">
                      {(v as unknown as { technician: { full_name: string } }).technician.full_name}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab: Service Orders
// ---------------------------------------------------------------------------

function ServiceOrdersTab({
  serviceOrders,
  onAdd,
}: {
  serviceOrders: ServiceOrder[]
  onAdd: () => void
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-sand-500">{serviceOrders.length} service order{serviceOrders.length !== 1 ? 's' : ''}</p>
        <Button onClick={onAdd}>
          <Plus className="h-4 w-4" />
          Add Service Order
        </Button>
      </div>

      {serviceOrders.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center py-12 text-center">
            <ClipboardList className="mb-3 h-10 w-10 text-sand-300" />
            <p className="font-medium text-sand-600">No service orders yet</p>
            <p className="mt-1 text-sm text-sand-400">Create your first service order for this site.</p>
          </div>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-xl border border-sand-200 bg-white">
          <table className="w-full">
            <thead>
              <tr className="border-b border-sand-100 bg-sand-50/50">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-sand-500">Title</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-sand-500">Urgency</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-sand-500">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-sand-500">Scheduled</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-sand-500">Assigned</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-sand-500">Created</th>
              </tr>
            </thead>
            <tbody>
              {serviceOrders.map((order) => (
                <tr
                  key={order.id}
                  className="border-b border-sand-50 transition-colors hover:bg-sand-50/50"
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-sand-900">{order.title}</p>
                    {order.description && (
                      <p className="mt-0.5 text-xs text-sand-400 line-clamp-1">{order.description}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={urgencyBadgeVariant(order.urgency)}>
                      {capitalizeFirst(order.urgency)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={statusBadgeVariant(order.status)}>
                      {capitalizeFirst(order.status.replace(/_/g, ' '))}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-sm text-sand-600">
                    {order.scheduled_date ? formatDate(order.scheduled_date) : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-sand-600">
                    {(order as unknown as { assignee?: { full_name: string } }).assignee?.full_name ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-sand-400">
                    {formatDate(order.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab: Visits
// ---------------------------------------------------------------------------

function VisitsTab({ visits }: { visits: Visit[] }) {
  const router = useRouter()

  return (
    <div className="space-y-4">
      <p className="text-sm text-sand-500">{visits.length} visit{visits.length !== 1 ? 's' : ''}</p>

      {visits.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center py-12 text-center">
            <Clock className="mb-3 h-10 w-10 text-sand-300" />
            <p className="font-medium text-sand-600">No visits yet</p>
            <p className="mt-1 text-sm text-sand-400">Visits to this site will appear here.</p>
          </div>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-xl border border-sand-200 bg-white">
          <table className="w-full">
            <thead>
              <tr className="border-b border-sand-100 bg-sand-50/50">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-sand-500">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-sand-500">Technician</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-sand-500">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-sand-500">Duration</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-sand-500">Notes</th>
              </tr>
            </thead>
            <tbody>
              {visits.map((visit) => {
                let duration = '—'
                if (visit.arrived_at && visit.departed_at) {
                  const ms = new Date(visit.departed_at).getTime() - new Date(visit.arrived_at).getTime()
                  const mins = Math.round(ms / 60000)
                  if (mins < 60) duration = `${mins}m`
                  else {
                    const hrs = Math.floor(mins / 60)
                    const rem = mins % 60
                    duration = rem > 0 ? `${hrs}h ${rem}m` : `${hrs}h`
                  }
                }

                return (
                  <tr
                    key={visit.id}
                    onClick={() => router.push(`/dashboard/visits/${visit.id}`)}
                    className="cursor-pointer border-b border-sand-50 transition-colors hover:bg-teal-50/50"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-sand-900">{formatDate(visit.scheduled_date)}</p>
                      {visit.arrived_at && (
                        <p className="text-xs text-sand-400">
                          Arrived {formatDateTime(visit.arrived_at)}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-sand-600">
                      {(visit as unknown as { technician?: { full_name: string } }).technician?.full_name ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={
                          visit.status === 'completed'
                            ? 'green'
                            : visit.status === 'in_progress'
                            ? 'teal'
                            : visit.status === 'skipped' || visit.status === 'canceled'
                            ? 'red'
                            : 'gray'
                        }
                      >
                        {capitalizeFirst(visit.status.replace(/_/g, ' '))}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-sand-600">{duration}</td>
                    <td className="px-4 py-3 text-sm text-sand-400 max-w-[200px] truncate">
                      {visit.notes ?? '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab: Documents
// ---------------------------------------------------------------------------

interface DocumentRecord {
  id: string
  org_id: string
  entity_type: string
  entity_id: string
  doc_type: string
  name: string
  storage_url: string
  file_size_bytes: number | null
  mime_type: string | null
  uploaded_by: string | null
  created_at: string
  uploader?: { full_name: string } | null
}

const DOC_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'plan', label: 'Plan' },
  { value: 'permit', label: 'Permit' },
  { value: 'contract', label: 'Contract' },
  { value: 'photo_report', label: 'Photo Report' },
  { value: 'inspection', label: 'Inspection' },
  { value: 'invoice', label: 'Invoice' },
  { value: 'other', label: 'Other' },
]

const DOC_TYPE_LABELS: Record<string, string> = {
  plan: 'Plan',
  permit: 'Permit',
  contract: 'Contract',
  photo_report: 'Photo Report',
  inspection: 'Inspection',
  invoice: 'Invoice',
  other: 'Other',
}

const DOC_TYPE_BADGE_VARIANT: Record<string, 'teal' | 'amber' | 'green' | 'red' | 'gray' | 'default'> = {
  plan: 'teal',
  permit: 'amber',
  contract: 'green',
  photo_report: 'default',
  inspection: 'red',
  invoice: 'gray',
  other: 'gray',
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getFileIcon(mimeType: string | null) {
  if (!mimeType) return <File className="h-8 w-8 text-sand-400" />
  if (mimeType.startsWith('image/')) return <FileImage className="h-8 w-8 text-teal-500" />
  if (mimeType === 'application/pdf') return <FileText className="h-8 w-8 text-red-500" />
  if (
    mimeType.includes('spreadsheet') ||
    mimeType.includes('excel') ||
    mimeType === 'text/csv'
  )
    return <FileSpreadsheet className="h-8 w-8 text-emerald-500" />
  return <File className="h-8 w-8 text-sand-400" />
}

function DocumentsTab({ orgId, siteId }: { orgId: string | null; siteId: string }) {
  const [documents, setDocuments] = useState<DocumentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  const fetchDocuments = useCallback(async () => {
    if (!siteId) return
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('documents')
      .select('*, uploader:users!documents_uploaded_by_fkey(full_name)')
      .eq('entity_type', 'jobsite')
      .eq('entity_id', siteId)
      .order('created_at', { ascending: false })
    setDocuments((data ?? []) as DocumentRecord[])
    setLoading(false)
  }, [siteId])

  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  async function handleDownload(doc: DocumentRecord) {
    const supabase = createClient()
    const { data, error } = await supabase.storage
      .from('fieldbase')
      .createSignedUrl(doc.storage_url, 3600)
    if (error || !data?.signedUrl) {
      alert('Failed to generate download link.')
      return
    }
    window.open(data.signedUrl, '_blank')
  }

  async function handleDelete(doc: DocumentRecord) {
    if (!confirm(`Delete "${doc.name}"? This cannot be undone.`)) return
    setDeleting(doc.id)
    const supabase = createClient()
    await supabase.storage.from('fieldbase').remove([doc.storage_url])
    await supabase.from('documents').delete().eq('id', doc.id)
    setDeleting(null)
    fetchDocuments()
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-9 w-36" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-44 w-full rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-sand-500">
          {documents.length} document{documents.length !== 1 ? 's' : ''}
        </p>
        <Button onClick={() => setShowUploadModal(true)}>
          <Upload className="h-4 w-4" />
          Upload Document
        </Button>
      </div>

      {documents.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center py-12 text-center">
            <FileText className="mb-3 h-10 w-10 text-sand-300" />
            <p className="font-medium text-sand-600">No documents yet</p>
            <p className="mt-1 text-sm text-sand-400">
              Upload site documents, permits, and contracts.
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {documents.map((doc) => (
            <Card key={doc.id} className="flex flex-col justify-between p-4">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    {getFileIcon(doc.mime_type)}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-sand-900">{doc.name}</p>
                      <Badge variant={DOC_TYPE_BADGE_VARIANT[doc.doc_type] ?? 'gray'} className="mt-1">
                        {DOC_TYPE_LABELS[doc.doc_type] ?? capitalizeFirst(doc.doc_type)}
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="mt-3 space-y-1 text-xs text-sand-500">
                  <p>{formatFileSize(doc.file_size_bytes)}</p>
                  <p>{formatDate(doc.created_at)}</p>
                  {doc.uploader?.full_name && (
                    <p className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {doc.uploader.full_name}
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2 border-t border-sand-100 pt-3">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleDownload(doc)}
                  className="flex-1"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => handleDelete(doc)}
                  disabled={deleting === doc.id}
                >
                  {deleting === doc.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Upload Document Modal */}
      <Modal
        open={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        title="Upload Document"
        className="max-w-lg"
      >
        <UploadDocumentForm
          orgId={orgId}
          siteId={siteId}
          onSuccess={() => {
            setShowUploadModal(false)
            fetchDocuments()
          }}
          onCancel={() => setShowUploadModal(false)}
        />
      </Modal>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Upload Document Form
// ---------------------------------------------------------------------------

function UploadDocumentForm({
  orgId,
  siteId,
  onSuccess,
  onCancel,
}: {
  orgId: string | null
  siteId: string
  onSuccess: () => void
  onCancel: () => void
}) {
  const [file, setFile] = useState<globalThis.File | null>(null)
  const [docName, setDocName] = useState('')
  const [docType, setDocType] = useState('other')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  function handleFileSelect(selectedFile: globalThis.File | null) {
    if (!selectedFile) return
    setFile(selectedFile)
    // Auto-fill name from filename (without extension)
    const nameWithoutExt = selectedFile.name.replace(/\.[^/.]+$/, '')
    setDocName(nameWithoutExt)
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!orgId) {
      setError('No organization found. Please refresh and try again.')
      return
    }
    if (!file) {
      setError('Please select a file to upload.')
      return
    }
    if (!docName.trim()) {
      setError('Please enter a document name.')
      return
    }

    setUploading(true)
    setError(null)

    const supabase = createClient()

    // Get current user for uploaded_by
    const {
      data: { user },
    } = await supabase.auth.getUser()

    // 1. Upload file to storage
    const filePath = `${orgId}/documents/jobsite/${siteId}/${Date.now()}_${file.name}`
    const { error: uploadError } = await supabase.storage
      .from('fieldbase')
      .upload(filePath, file)

    if (uploadError) {
      setUploading(false)
      setError(uploadError.message)
      return
    }

    // 2. Insert record into documents table
    const { error: insertError } = await supabase.from('documents').insert({
      org_id: orgId,
      entity_type: 'jobsite',
      entity_id: siteId,
      doc_type: docType,
      name: docName.trim(),
      storage_url: filePath,
      file_size_bytes: file.size,
      mime_type: file.type || null,
      uploaded_by: user?.id ?? null,
    })

    setUploading(false)

    if (insertError) {
      // Clean up orphaned storage file
      await supabase.storage.from('fieldbase').remove([filePath])
      setError(insertError.message)
    } else {
      onSuccess()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {/* Drag & Drop / File Input Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          const droppedFile = e.dataTransfer.files?.[0]
          if (droppedFile) handleFileSelect(droppedFile)
        }}
        className={cn(
          'relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors',
          dragOver
            ? 'border-teal-400 bg-teal-50'
            : file
            ? 'border-teal-300 bg-teal-50/50'
            : 'border-sand-300 bg-sand-50 hover:border-sand-400'
        )}
      >
        {file ? (
          <>
            {getFileIcon(file.type)}
            <p className="mt-2 text-sm font-medium text-sand-800">{file.name}</p>
            <p className="text-xs text-sand-500">{formatFileSize(file.size)}</p>
            <button
              type="button"
              onClick={() => {
                setFile(null)
                setDocName('')
              }}
              className="mt-2 text-xs font-medium text-teal-600 hover:text-teal-700"
            >
              Change file
            </button>
          </>
        ) : (
          <>
            <Upload className="h-8 w-8 text-sand-400" />
            <p className="mt-2 text-sm font-medium text-sand-700">
              Drag &amp; drop a file here, or click to browse
            </p>
            <p className="mt-1 text-xs text-sand-400">Max 10 MB</p>
          </>
        )}
        <input
          type="file"
          className="absolute inset-0 cursor-pointer opacity-0"
          onChange={(e) => handleFileSelect(e.target.files?.[0] ?? null)}
        />
      </div>

      {/* Document Name */}
      <div>
        <label className="mb-1 block text-sm font-medium text-sand-700">Document Name *</label>
        <Input
          value={docName}
          onChange={(e) => setDocName(e.target.value)}
          required
          placeholder="e.g., Site Permit 2025"
        />
      </div>

      {/* Category */}
      <Select
        name="doc_type"
        label="Category"
        value={docType}
        onChange={(e) => setDocType(e.target.value)}
        options={DOC_TYPE_OPTIONS}
      />

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={uploading || !file}>
          {uploading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" />
              Upload
            </>
          )}
        </Button>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Tab: Equipment
// ---------------------------------------------------------------------------

function EquipmentTab({ equipment }: { equipment: Equipment[] }) {
  if (equipment.length === 0) {
    return (
      <Card>
        <div className="flex flex-col items-center py-12 text-center">
          <Package className="mb-3 h-10 w-10 text-sand-300" />
          <p className="font-medium text-sand-600">No equipment</p>
          <p className="mt-1 text-sm text-sand-400">
            Equipment linked to this site will appear here.
          </p>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-sand-500">{equipment.length} piece{equipment.length !== 1 ? 's' : ''} of equipment</p>
      <div className="overflow-hidden rounded-xl border border-sand-200 bg-white">
        <table className="w-full">
          <thead>
            <tr className="border-b border-sand-100 bg-sand-50/50">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-sand-500">Name</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-sand-500">Type</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-sand-500">Brand / Model</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-sand-500">Condition</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-sand-500">Last Serviced</th>
            </tr>
          </thead>
          <tbody>
            {equipment.map((eq) => (
              <tr
                key={eq.id}
                className="border-b border-sand-50 transition-colors hover:bg-sand-50/50"
              >
                <td className="px-4 py-3">
                  <p className="font-medium text-sand-900">{eq.name}</p>
                  {eq.serial_number && (
                    <p className="text-xs text-sand-400">S/N: {eq.serial_number}</p>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-sand-600">{eq.equipment_type ?? '—'}</td>
                <td className="px-4 py-3 text-sm text-sand-600">
                  {eq.brand || eq.model
                    ? `${eq.brand ?? ''}${eq.brand && eq.model ? ' ' : ''}${eq.model ?? ''}`
                    : '—'}
                </td>
                <td className="px-4 py-3">
                  {eq.condition ? (
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        eq.condition === 'good'
                          ? 'bg-emerald-50 text-emerald-700'
                          : eq.condition === 'fair'
                          ? 'bg-amber-50 text-amber-700'
                          : eq.condition === 'poor'
                          ? 'bg-red-50 text-red-700'
                          : 'bg-sand-100 text-sand-600'
                      }`}
                    >
                      {capitalizeFirst(eq.condition)}
                    </span>
                  ) : (
                    <span className="text-sm text-sand-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-sand-600">
                  {eq.last_serviced ? formatDate(eq.last_serviced) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Add Service Order Form
// ---------------------------------------------------------------------------

function AddServiceOrderForm({
  orgId,
  jobsiteId,
  onSuccess,
  onCancel,
}: {
  orgId: string | null
  jobsiteId: string
  onSuccess: () => void
  onCancel: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!orgId) {
      setError('No organization found. Please refresh and try again.')
      return
    }
    setSaving(true)
    setError(null)

    const form = new FormData(e.currentTarget)
    const supabase = createClient()

    const { error: insertError } = await supabase.from('service_orders').insert({
      org_id: orgId,
      jobsite_id: jobsiteId,
      title: form.get('title') as string,
      description: (form.get('description') as string) || null,
      urgency: form.get('urgency') as string,
      status: form.get('status') as string,
      scheduled_date: (form.get('scheduled_date') as string) || null,
    })

    setSaving(false)
    if (insertError) {
      setError(insertError.message)
    } else {
      onSuccess()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}
      <div>
        <label className="mb-1 block text-sm font-medium text-sand-700">Title *</label>
        <Input name="title" required placeholder="e.g., Replace filter system" />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-sand-700">Description</label>
        <textarea
          name="description"
          className="w-full rounded-lg border border-sand-300 px-3 py-2 text-sm text-sand-900 placeholder:text-sand-400 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
          rows={3}
          placeholder="Describe the work needed..."
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Select
          name="urgency"
          label="Priority"
          options={[
            { value: 'low', label: 'Low' },
            { value: 'medium', label: 'Medium' },
            { value: 'high', label: 'High' },
            { value: 'emergency', label: 'Emergency' },
          ]}
        />
        <Select
          name="status"
          label="Status"
          options={[
            { value: 'pending', label: 'Pending' },
            { value: 'approved', label: 'Approved' },
            { value: 'scheduled', label: 'Scheduled' },
            { value: 'in_progress', label: 'In Progress' },
            { value: 'completed', label: 'Completed' },
            { value: 'canceled', label: 'Canceled' },
          ]}
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-sand-700">Scheduled Date</label>
        <Input name="scheduled_date" type="date" />
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? 'Creating...' : 'Create Service Order'}
        </Button>
      </div>
    </form>
  )
}
