'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import {
  Plus,
  Loader2,
  Trash2,
  Pencil,
  MoreVertical,
  Image as ImageIcon,
  Upload,
  X,
  Clock as ClockIcon,
  StickyNote,
  Camera,
  ClipboardList,
  Activity,
} from 'lucide-react'
import type { ActivityEntry, ActivityEntryType, SitePhoto, SiteNote, TimeClockEvent } from '@/lib/types'
import { COLOR_CLASSES, iconForKey } from '@/app/dashboard/settings/entry-types/page'

type ColorKey = keyof typeof COLOR_CLASSES

function colorForKey(color: string | null): typeof COLOR_CLASSES[ColorKey] {
  if (color && color in COLOR_CLASSES) {
    return COLOR_CLASSES[color as ColorKey]
  }
  return COLOR_CLASSES.slate
}

function formatRelative(dateStr: string): string {
  const d = new Date(dateStr)
  const diffMs = Date.now() - d.getTime()
  const sec = Math.floor(diffMs / 1000)
  if (sec < 60) return 'just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}d ago`
  return d.toLocaleDateString()
}

function toLocalDateTimeInputValue(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

interface ActivityFeedProps {
  jobsiteId: string
  serviceOrderId?: string
  scope: 'site' | 'service_order'
  orgId: string | null
  currentUserId: string | null
  canManage: boolean
}

type FeedItemKind = 'entry' | 'note' | 'photo' | 'clock' | 'order'

interface FeedItem {
  kind: FeedItemKind
  id: string
  occurredAt: string
  data: ActivityEntry | SiteNote | SitePhoto | TimeClockEvent | { id: string; title: string; status: string; created_at: string; author_name: string | null }
}

export function ActivityFeed({
  jobsiteId,
  serviceOrderId,
  scope,
  orgId,
  currentUserId,
  canManage,
}: ActivityFeedProps) {
  const [entryTypes, setEntryTypes] = useState<ActivityEntryType[]>([])
  const [entries, setEntries] = useState<ActivityEntry[]>([])
  const [notes, setNotes] = useState<SiteNote[]>([])
  const [photos, setPhotos] = useState<SitePhoto[]>([])
  const [clockEvents, setClockEvents] = useState<TimeClockEvent[]>([])
  const [orders, setOrders] = useState<{ id: string; title: string; status: string; created_at: string; author_name: string | null }[]>([])
  const [photoUrls, setPhotoUrls] = useState<Record<string, string | null>>({})
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<ActivityEntry | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [filters, setFilters] = useState<{
    entryTypeIds: Set<string>
    showNotes: boolean
    showPhotos: boolean
    showClock: boolean
    showOrders: boolean
  }>({
    entryTypeIds: new Set(),
    showNotes: scope === 'site',
    showPhotos: scope === 'site',
    showClock: scope === 'site',
    showOrders: scope === 'site',
  })

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()

    // Entry types
    const { data: typesData } = await supabase
      .from('activity_entry_types')
      .select('*')
      .order('sort_order', { ascending: true })
    const types = (typesData ?? []) as ActivityEntryType[]
    setEntryTypes(types)

    // Activity entries
    let entriesQuery = supabase
      .from('activity_entries')
      .select(
        `*,
        entry_type:activity_entry_types(*),
        author:users!activity_entries_author_id_fkey(id, full_name, email)`
      )
      .eq('jobsite_id', jobsiteId)
      .order('occurred_at', { ascending: false })
    if (scope === 'service_order' && serviceOrderId) {
      entriesQuery = entriesQuery.eq('service_order_id', serviceOrderId)
    }
    const { data: entriesData } = await entriesQuery
    const rawEntries = (entriesData ?? []) as ActivityEntry[]

    // Fetch photo links for each entry
    const entryIds = rawEntries.map((e) => e.id)
    let photosByEntry: Record<string, SitePhoto[]> = {}
    if (entryIds.length > 0) {
      const { data: linksData } = await supabase
        .from('activity_entry_photos')
        .select('entry_id, photo:site_photos(*)')
        .in('entry_id', entryIds)
      const rows = (linksData ?? []) as unknown as { entry_id: string; photo: SitePhoto }[]
      photosByEntry = rows.reduce<Record<string, SitePhoto[]>>((acc, r) => {
        if (!r.photo) return acc
        if (!acc[r.entry_id]) acc[r.entry_id] = []
        acc[r.entry_id].push(r.photo)
        return acc
      }, {})
    }
    const entriesWithPhotos = rawEntries.map((e) => ({
      ...e,
      photos: photosByEntry[e.id] ?? [],
    }))
    setEntries(entriesWithPhotos)

    // Unified data (site scope only)
    if (scope === 'site') {
      const [notesRes, photosRes, clockRes, ordersRes] = await Promise.all([
        supabase
          .from('site_notes')
          .select('*, author:users!site_notes_author_id_fkey(id, full_name, email)')
          .eq('jobsite_id', jobsiteId)
          .order('created_at', { ascending: false }),
        supabase
          .from('site_photos')
          .select('*, uploader:users!site_photos_uploaded_by_fkey(id, full_name, email)')
          .eq('jobsite_id', jobsiteId)
          .order('created_at', { ascending: false }),
        supabase
          .from('time_clock_events')
          .select('*, user:users!time_clock_events_user_id_fkey(id, full_name, email)')
          .eq('jobsite_id', jobsiteId)
          .order('occurred_at', { ascending: false })
          .limit(50),
        supabase
          .from('service_orders')
          .select('id, title, status, created_at, requester:users!service_orders_requested_by_fkey(full_name)')
          .eq('jobsite_id', jobsiteId)
          .order('created_at', { ascending: false }),
      ])
      setNotes((notesRes.data ?? []) as SiteNote[])
      // Exclude photos already linked to entries (treat as inline posts)
      const linkedPhotoIds = new Set(
        Object.values(photosByEntry).flat().map((p) => p.id)
      )
      const allPhotos = (photosRes.data ?? []) as SitePhoto[]
      setPhotos(allPhotos.filter((p) => !linkedPhotoIds.has(p.id)))
      setClockEvents((clockRes.data ?? []) as TimeClockEvent[])
      type OrderRow = { id: string; title: string; status: string; created_at: string; requester: { full_name: string } | null }
      setOrders(
        ((ordersRes.data ?? []) as unknown as OrderRow[]).map((o) => ({
          id: o.id,
          title: o.title,
          status: o.status,
          created_at: o.created_at,
          author_name: o.requester?.full_name ?? null,
        }))
      )
    } else {
      setNotes([])
      setPhotos([])
      setClockEvents([])
      setOrders([])
    }

    setLoading(false)
  }, [jobsiteId, serviceOrderId, scope])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  // Resolve signed URLs for inline photos (not entry-attached)
  useEffect(() => {
    let cancelled = false
    const all = [
      ...photos,
      ...entries.flatMap((e) => e.photos ?? []),
    ]
    const missing = all.filter((p) => photoUrls[p.id] === undefined)
    if (missing.length === 0) return
    ;(async () => {
      const supabase = createClient()
      const results = await Promise.all(
        missing.map(async (p) => {
          const { data } = await supabase.storage
            .from('site-photos')
            .createSignedUrl(p.storage_path, 3600)
          return [p.id, data?.signedUrl ?? null] as const
        })
      )
      if (cancelled) return
      setPhotoUrls((prev) => {
        const next = { ...prev }
        for (const [id, url] of results) next[id] = url
        return next
      })
    })()
    return () => {
      cancelled = true
    }
  }, [photos, entries, photoUrls])

  const typeById = useMemo(() => {
    const m: Record<string, ActivityEntryType> = {}
    for (const t of entryTypes) m[t.id] = t
    return m
  }, [entryTypes])

  // Build merged feed
  const feedItems: FeedItem[] = useMemo(() => {
    const items: FeedItem[] = []
    for (const e of entries) {
      items.push({ kind: 'entry', id: e.id, occurredAt: e.occurred_at, data: e })
    }
    if (scope === 'site') {
      for (const n of notes) {
        items.push({ kind: 'note', id: n.id, occurredAt: n.created_at, data: n })
      }
      for (const p of photos) {
        items.push({ kind: 'photo', id: p.id, occurredAt: p.created_at, data: p })
      }
      for (const c of clockEvents) {
        items.push({ kind: 'clock', id: c.id, occurredAt: c.occurred_at, data: c })
      }
      for (const o of orders) {
        items.push({ kind: 'order', id: o.id, occurredAt: o.created_at, data: o })
      }
    }
    // Apply filters
    const filtered = items.filter((item) => {
      if (item.kind === 'entry') {
        if (filters.entryTypeIds.size === 0) return true
        const e = item.data as ActivityEntry
        return e.entry_type_id ? filters.entryTypeIds.has(e.entry_type_id) : filters.entryTypeIds.has('__none__')
      }
      if (item.kind === 'note') return filters.showNotes
      if (item.kind === 'photo') return filters.showPhotos
      if (item.kind === 'clock') return filters.showClock
      if (item.kind === 'order') return filters.showOrders
      return true
    })
    filtered.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    return filtered
  }, [entries, notes, photos, clockEvents, orders, scope, filters])

  function toggleEntryType(id: string) {
    setFilters((prev) => {
      const next = new Set(prev.entryTypeIds)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return { ...prev, entryTypeIds: next }
    })
  }

  async function handleDeleteEntry(entry: ActivityEntry) {
    if (!confirm('Delete this activity entry?')) return
    const supabase = createClient()
    // Delete links (cascade would handle; but be explicit)
    await supabase.from('activity_entry_photos').delete().eq('entry_id', entry.id)
    await supabase.from('activity_entries').delete().eq('id', entry.id)
    setOpenMenuId(null)
    fetchAll()
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <CardTitle>
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-teal-500" />
            Activity
          </div>
        </CardTitle>
        <Button size="sm" onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4" />
          Add Entry
        </Button>
      </div>

      {/* Filters */}
      <div className="mt-3 flex flex-wrap gap-2 border-b border-sand-100 pb-3">
        {entryTypes.map((t) => {
          const Icon = iconForKey(t.icon)
          const color = colorForKey(t.color)
          const active = filters.entryTypeIds.size === 0 || filters.entryTypeIds.has(t.id)
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => toggleEntryType(t.id)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                active
                  ? `${color.bg} ${color.text} border-transparent`
                  : 'border-sand-200 bg-white text-sand-400'
              }`}
            >
              <Icon className="h-3 w-3" />
              {t.label}
            </button>
          )
        })}
        {scope === 'site' && (
          <>
            <FilterChip
              icon={<StickyNote className="h-3 w-3" />}
              label="Notes"
              active={filters.showNotes}
              onClick={() => setFilters((p) => ({ ...p, showNotes: !p.showNotes }))}
            />
            <FilterChip
              icon={<Camera className="h-3 w-3" />}
              label="Photos"
              active={filters.showPhotos}
              onClick={() => setFilters((p) => ({ ...p, showPhotos: !p.showPhotos }))}
            />
            <FilterChip
              icon={<ClockIcon className="h-3 w-3" />}
              label="Clock Events"
              active={filters.showClock}
              onClick={() => setFilters((p) => ({ ...p, showClock: !p.showClock }))}
            />
            <FilterChip
              icon={<ClipboardList className="h-3 w-3" />}
              label="Service Orders"
              active={filters.showOrders}
              onClick={() => setFilters((p) => ({ ...p, showOrders: !p.showOrders }))}
            />
          </>
        )}
      </div>

      {/* Feed */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-teal-600" />
        </div>
      ) : feedItems.length === 0 ? (
        <div className="mt-3 rounded-lg border border-dashed border-sand-200 bg-sand-50/30 py-10 text-center">
          <Activity className="mx-auto h-7 w-7 text-sand-300" />
          <p className="mt-2 text-sm text-sand-500">No activity yet</p>
          <p className="text-xs text-sand-400">Log a milestone, damage report, or note to get started</p>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          {feedItems.map((item) => (
            <FeedItemRow
              key={`${item.kind}-${item.id}`}
              item={item}
              typeById={typeById}
              photoUrls={photoUrls}
              canManage={canManage}
              currentUserId={currentUserId}
              openMenuId={openMenuId}
              setOpenMenuId={setOpenMenuId}
              onEdit={(e) => setEditing(e)}
              onDelete={handleDeleteEntry}
            />
          ))}
        </div>
      )}

      <Modal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        title="Add Activity Entry"
        className="max-w-lg"
      >
        <EntryForm
          entryTypes={entryTypes}
          orgId={orgId}
          jobsiteId={jobsiteId}
          serviceOrderId={serviceOrderId ?? null}
          currentUserId={currentUserId}
          onCancel={() => setShowAdd(false)}
          onSaved={() => {
            setShowAdd(false)
            fetchAll()
          }}
        />
      </Modal>

      {editing && (
        <Modal
          open={!!editing}
          onClose={() => setEditing(null)}
          title="Edit Activity Entry"
          className="max-w-lg"
        >
          <EntryForm
            entryTypes={entryTypes}
            orgId={orgId}
            jobsiteId={jobsiteId}
            serviceOrderId={serviceOrderId ?? null}
            currentUserId={currentUserId}
            existing={editing}
            onCancel={() => setEditing(null)}
            onSaved={() => {
              setEditing(null)
              fetchAll()
            }}
          />
        </Modal>
      )}
    </Card>
  )
}

function FilterChip({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
        active
          ? 'bg-teal-50 text-teal-700 border-transparent'
          : 'border-sand-200 bg-white text-sand-400'
      }`}
    >
      {icon}
      {label}
    </button>
  )
}

function initials(name: string | null | undefined, email?: string | null): string {
  const src = name?.trim() || email?.trim() || '?'
  const parts = src.split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return src.slice(0, 2).toUpperCase()
}

function FeedItemRow({
  item,
  typeById,
  photoUrls,
  canManage,
  currentUserId,
  openMenuId,
  setOpenMenuId,
  onEdit,
  onDelete,
}: {
  item: FeedItem
  typeById: Record<string, ActivityEntryType>
  photoUrls: Record<string, string | null>
  canManage: boolean
  currentUserId: string | null
  openMenuId: string | null
  setOpenMenuId: (id: string | null) => void
  onEdit: (e: ActivityEntry) => void
  onDelete: (e: ActivityEntry) => void
}) {
  if (item.kind === 'entry') {
    const e = item.data as ActivityEntry
    const type = e.entry_type_id ? typeById[e.entry_type_id] : undefined
    const Icon = iconForKey(type?.icon ?? null)
    const color = colorForKey(type?.color ?? null)
    const authorName = e.author?.full_name || e.author?.email || 'Unknown'
    const canEditDelete = canManage || e.author_id === currentUserId
    const menuOpen = openMenuId === `entry-${e.id}`

    return (
      <div className="flex gap-3">
        <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${color.bg}`}>
          <Icon className={`h-4 w-4 ${color.text}`} />
        </div>
        <div className="min-w-0 flex-1 rounded-lg border border-sand-100 bg-white p-3">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-sm font-semibold text-sand-900">{e.title}</span>
                {type && (
                  <span className={`rounded-full ${color.bg} ${color.text} px-2 py-0.5 text-[10px] font-medium`}>
                    {type.label}
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-sand-400">
                {authorName} · {formatRelative(e.occurred_at)}
              </p>
            </div>
            {canEditDelete && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setOpenMenuId(menuOpen ? null : `entry-${e.id}`)}
                  className="rounded-md p-1 text-sand-400 hover:bg-sand-100 hover:text-sand-700"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
                {menuOpen && (
                  <div className="absolute right-0 z-10 mt-1 w-32 rounded-md border border-sand-200 bg-white py-1 shadow-lg">
                    <button
                      type="button"
                      onClick={() => {
                        setOpenMenuId(null)
                        onEdit(e)
                      }}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-sand-700 hover:bg-sand-50"
                    >
                      <Pencil className="h-3 w-3" />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(e)}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-3 w-3" />
                      Delete
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          {e.body && (
            <p className="mt-2 whitespace-pre-wrap text-sm text-sand-700">{e.body}</p>
          )}
          {e.photos && e.photos.length > 0 && (
            <div className="mt-2 grid grid-cols-3 gap-1.5 sm:grid-cols-4">
              {e.photos.map((p) => (
                <div key={p.id} className="relative aspect-square overflow-hidden rounded-md bg-sand-100">
                  {photoUrls[p.id] ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={photoUrls[p.id]!} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <ImageIcon className="h-4 w-4 text-sand-300" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  if (item.kind === 'note') {
    const n = item.data as SiteNote
    const authorName = n.author?.full_name || n.author?.email || 'Unknown'
    return (
      <div className="flex gap-3">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-slate-50">
          <StickyNote className="h-4 w-4 text-slate-600" />
        </div>
        <div className="min-w-0 flex-1 rounded-lg border border-sand-100 bg-white p-3">
          <p className="text-xs text-sand-400">{authorName} · {formatRelative(n.created_at)}</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-sand-700">{n.body}</p>
        </div>
      </div>
    )
  }

  if (item.kind === 'photo') {
    const p = item.data as SitePhoto
    const uploaderName = p.uploader?.full_name || p.uploader?.email || 'Unknown'
    return (
      <div className="flex gap-3">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-blue-50">
          <Camera className="h-4 w-4 text-blue-600" />
        </div>
        <div className="min-w-0 flex-1 rounded-lg border border-sand-100 bg-white p-3">
          <p className="text-xs text-sand-400">{uploaderName} · {formatRelative(p.created_at)}</p>
          <div className="mt-2 h-32 max-w-xs overflow-hidden rounded-md bg-sand-100">
            {photoUrls[p.id] ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={photoUrls[p.id]!} alt={p.file_name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center">
                <ImageIcon className="h-4 w-4 text-sand-300" />
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (item.kind === 'clock') {
    const c = item.data as TimeClockEvent
    const userName = c.user?.full_name || c.user?.email || 'Unknown'
    const label = c.event_type === 'clock_in' ? 'Clocked in' : 'Clocked out'
    return (
      <div className="flex gap-3">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-green-50">
          <ClockIcon className="h-4 w-4 text-green-600" />
        </div>
        <div className="min-w-0 flex-1 rounded-lg border border-sand-100 bg-white p-2.5">
          <p className="text-sm text-sand-700">
            <span className="font-medium">{userName}</span> {label}
          </p>
          <p className="text-xs text-sand-400">
            {c.source === 'auto_geofence' ? 'auto · geofence' : 'manual'} · {formatRelative(c.occurred_at)}
          </p>
        </div>
      </div>
    )
  }

  if (item.kind === 'order') {
    const o = item.data as { id: string; title: string; status: string; created_at: string; author_name: string | null }
    return (
      <div className="flex gap-3">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-teal-50">
          <ClipboardList className="h-4 w-4 text-teal-600" />
        </div>
        <div className="min-w-0 flex-1 rounded-lg border border-sand-100 bg-white p-2.5">
          <p className="text-sm text-sand-700">
            Service order created: <span className="font-medium">{o.title}</span>
          </p>
          <p className="text-xs text-sand-400">
            {o.author_name ? `by ${o.author_name} · ` : ''}{o.status} · {formatRelative(o.created_at)}
          </p>
        </div>
      </div>
    )
  }

  return null
}

function EntryForm({
  entryTypes,
  orgId,
  jobsiteId,
  serviceOrderId,
  currentUserId,
  existing,
  onCancel,
  onSaved,
}: {
  entryTypes: ActivityEntryType[]
  orgId: string | null
  jobsiteId: string
  serviceOrderId: string | null
  currentUserId: string | null
  existing?: ActivityEntry
  onCancel: () => void
  onSaved: () => void
}) {
  const [typeId, setTypeId] = useState<string>(existing?.entry_type_id ?? entryTypes[0]?.id ?? '')
  const [title, setTitle] = useState(existing?.title ?? '')
  const [body, setBody] = useState(existing?.body ?? '')
  const [occurredAt, setOccurredAt] = useState(
    existing ? toLocalDateTimeInputValue(existing.occurred_at) : toLocalDateTimeInputValue(new Date().toISOString())
  )
  const [files, setFiles] = useState<File[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? [])
    setFiles((prev) => [...prev, ...picked])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!orgId) {
      setError('No active organization')
      return
    }
    if (!title.trim()) {
      setError('Title is required')
      return
    }
    setSaving(true)
    setError(null)
    const supabase = createClient()
    const occurredIso = new Date(occurredAt).toISOString()

    try {
      let entryId: string
      if (existing) {
        const { error: updErr } = await supabase
          .from('activity_entries')
          .update({
            entry_type_id: typeId || null,
            title: title.trim(),
            body: body.trim() || null,
            occurred_at: occurredIso,
          })
          .eq('id', existing.id)
        if (updErr) throw updErr
        entryId = existing.id
      } else {
        const { data: inserted, error: insErr } = await supabase
          .from('activity_entries')
          .insert({
            org_id: orgId,
            jobsite_id: jobsiteId,
            service_order_id: serviceOrderId,
            entry_type_id: typeId || null,
            title: title.trim(),
            body: body.trim() || null,
            author_id: currentUserId,
            occurred_at: occurredIso,
          })
          .select('id')
          .single()
        if (insErr) throw insErr
        entryId = (inserted as { id: string }).id
      }

      // Upload and link photos
      for (const file of files) {
        const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase()
        const id = crypto.randomUUID()
        const storagePath = `${orgId}/${jobsiteId}/${id}.${ext}`

        const { error: uploadErr } = await supabase.storage
          .from('site-photos')
          .upload(storagePath, file, {
            contentType: file.type || 'image/jpeg',
            upsert: false,
          })
        if (uploadErr) throw uploadErr

        const { data: photoRow, error: photoInsErr } = await supabase
          .from('site_photos')
          .insert({
            org_id: orgId,
            jobsite_id: jobsiteId,
            service_order_id: serviceOrderId,
            uploaded_by: currentUserId,
            storage_path: storagePath,
            file_name: file.name,
            mime_type: file.type || null,
            file_size_bytes: file.size,
          })
          .select('id')
          .single()
        if (photoInsErr) {
          await supabase.storage.from('site-photos').remove([storagePath])
          throw photoInsErr
        }

        const { error: linkErr } = await supabase.from('activity_entry_photos').insert({
          org_id: orgId,
          entry_id: entryId,
          photo_id: (photoRow as { id: string }).id,
        })
        if (linkErr) throw linkErr
      }

      setSaving(false)
      onSaved()
    } catch (err) {
      setSaving(false)
      setError(err instanceof Error ? err.message : 'Failed to save entry')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-sand-700">Type</label>
        <select
          className="w-full rounded-lg border border-sand-300 px-3 py-2 text-sm"
          value={typeId}
          onChange={(e) => setTypeId(e.target.value)}
        >
          <option value="">(no type)</option>
          {entryTypes.map((t) => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-sand-700">Title *</label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Short summary"
          required
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-sand-700">Notes</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          className="w-full resize-y rounded-lg border border-sand-300 px-3 py-2 text-sm text-sand-900 placeholder:text-sand-400 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
          placeholder="Add details... (tap the mic on your keyboard to dictate)"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-sand-700">Occurred at</label>
        <Input
          type="datetime-local"
          value={occurredAt}
          onChange={(e) => setOccurredAt(e.target.value)}
        />
      </div>

      {!existing && (
        <div>
          <label className="mb-1 block text-sm font-medium text-sand-700">Photos</label>
          <label
            htmlFor="entry-photo-upload"
            className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-sand-300 bg-sand-50 py-6 hover:bg-sand-100"
          >
            <Upload className="h-5 w-5 text-sand-400" />
            <span className="text-xs text-sand-500">Drag and drop or click to select</span>
            <input
              ref={fileInputRef}
              id="entry-photo-upload"
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </label>
          {files.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {files.map((f, i) => (
                <div
                  key={i}
                  className="flex items-center gap-1 rounded-full bg-sand-100 px-2 py-1 text-xs text-sand-700"
                >
                  <ImageIcon className="h-3 w-3" />
                  <span className="max-w-[120px] truncate">{f.name}</span>
                  <button type="button" onClick={() => removeFile(i)} className="text-sand-400 hover:text-red-500">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <div className="flex justify-end gap-3 border-t border-sand-100 pt-4">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : existing ? 'Save Changes' : 'Add Entry'}
        </Button>
      </div>
    </form>
  )
}
