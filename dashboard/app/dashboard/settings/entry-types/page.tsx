'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Plus,
  GripVertical,
  Pencil,
  Trash2,
  Loader2,
  Flag,
  AlertTriangle,
  AlertOctagon,
  AlertCircle,
  MessageCircle,
  Wrench,
  StickyNote,
  CheckCircle,
  XCircle,
  Camera,
  Phone,
  Clock,
  Calendar,
  MapPin,
  Hammer,
  Clipboard,
  ClipboardCheck,
  Truck,
  DollarSign,
  FileText,
  Activity,
} from 'lucide-react'
import type { ActivityEntryType } from '@/lib/types'

const ICON_OPTIONS = [
  'flag', 'alert-triangle', 'alert-octagon', 'alert-circle', 'message-circle',
  'wrench', 'sticky-note', 'check-circle', 'x-circle', 'camera', 'phone',
  'clock', 'calendar', 'map-pin', 'tool', 'clipboard', 'clipboard-check',
  'truck', 'dollar-sign', 'file-text',
] as const

const COLOR_OPTIONS = [
  'teal', 'red', 'orange', 'amber', 'yellow', 'green', 'blue', 'purple', 'pink', 'slate',
] as const

type ColorKey = typeof COLOR_OPTIONS[number]

export const COLOR_CLASSES: Record<ColorKey, { bg: string; text: string; ring: string; swatch: string }> = {
  teal:   { bg: 'bg-teal-50',   text: 'text-teal-700',   ring: 'ring-teal-600',   swatch: 'bg-teal-500' },
  red:    { bg: 'bg-red-50',    text: 'text-red-700',    ring: 'ring-red-600',    swatch: 'bg-red-500' },
  orange: { bg: 'bg-orange-50', text: 'text-orange-700', ring: 'ring-orange-600', swatch: 'bg-orange-500' },
  amber:  { bg: 'bg-amber-50',  text: 'text-amber-700',  ring: 'ring-amber-600',  swatch: 'bg-amber-500' },
  yellow: { bg: 'bg-yellow-50', text: 'text-yellow-700', ring: 'ring-yellow-600', swatch: 'bg-yellow-500' },
  green:  { bg: 'bg-green-50',  text: 'text-green-700',  ring: 'ring-green-600',  swatch: 'bg-green-500' },
  blue:   { bg: 'bg-blue-50',   text: 'text-blue-700',   ring: 'ring-blue-600',   swatch: 'bg-blue-500' },
  purple: { bg: 'bg-purple-50', text: 'text-purple-700', ring: 'ring-purple-600', swatch: 'bg-purple-500' },
  pink:   { bg: 'bg-pink-50',   text: 'text-pink-700',   ring: 'ring-pink-600',   swatch: 'bg-pink-500' },
  slate:  { bg: 'bg-slate-50',  text: 'text-slate-700',  ring: 'ring-slate-600',  swatch: 'bg-slate-500' },
}

function colorForKey(color: string | null): typeof COLOR_CLASSES[ColorKey] {
  if (color && (COLOR_OPTIONS as readonly string[]).includes(color)) {
    return COLOR_CLASSES[color as ColorKey]
  }
  return COLOR_CLASSES.slate
}

type IconComponent = React.ComponentType<{ className?: string }>
const ICON_MAP: Record<string, IconComponent> = {
  'flag': Flag,
  'alert-triangle': AlertTriangle,
  'alert-octagon': AlertOctagon,
  'alert-circle': AlertCircle,
  'message-circle': MessageCircle,
  'wrench': Wrench,
  'sticky-note': StickyNote,
  'check-circle': CheckCircle,
  'x-circle': XCircle,
  'camera': Camera,
  'phone': Phone,
  'clock': Clock,
  'calendar': Calendar,
  'map-pin': MapPin,
  'tool': Hammer,
  'clipboard': Clipboard,
  'clipboard-check': ClipboardCheck,
  'truck': Truck,
  'dollar-sign': DollarSign,
  'file-text': FileText,
}

export function iconForKey(icon: string | null): IconComponent {
  if (icon && ICON_MAP[icon]) return ICON_MAP[icon]
  return Activity
}

export default function EntryTypesPage() {
  const [types, setTypes] = useState<ActivityEntryType[]>([])
  const [loading, setLoading] = useState(true)
  const [canManage, setCanManage] = useState(false)
  const [checkedRole, setCheckedRole] = useState(false)
  const [orgId, setOrgId] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<ActivityEntryType | null>(null)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)

  const fetchTypes = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('activity_entry_types')
      .select('*')
      .order('sort_order', { ascending: true })
    setTypes((data ?? []) as ActivityEntryType[])
    setLoading(false)
  }, [])

  useEffect(() => {
    async function init() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setCheckedRole(true)
        setLoading(false)
        return
      }
      const { data: userData } = await supabase
        .from('users')
        .select('active_org_id')
        .eq('id', user.id)
        .single()
      const activeOrgId = userData?.active_org_id ?? null
      setOrgId(activeOrgId)
      if (!activeOrgId) {
        setCheckedRole(true)
        setLoading(false)
        return
      }
      const { data: memberData } = await supabase
        .from('org_members')
        .select('role')
        .eq('user_id', user.id)
        .eq('org_id', activeOrgId)
        .single()
      const role = memberData?.role
      setCanManage(role === 'owner' || role === 'admin' || role === 'manager')
      setCheckedRole(true)
      await fetchTypes()
    }
    init()
  }, [fetchTypes])

  async function handleDelete(id: string) {
    if (!confirm('Delete this entry type? Existing entries keep their label but lose the link.')) return
    const supabase = createClient()
    await supabase.from('activity_entry_types').delete().eq('id', id)
    fetchTypes()
  }

  async function handleReorder(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) return
    const next = [...types]
    const [moved] = next.splice(fromIndex, 1)
    next.splice(toIndex, 0, moved)
    const withOrder = next.map((t, i) => ({ ...t, sort_order: i * 10 }))
    setTypes(withOrder)
    const supabase = createClient()
    await Promise.all(
      withOrder.map((t) =>
        supabase
          .from('activity_entry_types')
          .update({ sort_order: t.sort_order })
          .eq('id', t.id)
      )
    )
  }

  if (!checkedRole) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    )
  }

  if (!canManage) {
    return (
      <Card>
        <CardTitle>Activity Entry Types</CardTitle>
        <p className="py-6 text-center text-sm text-sand-500">
          Only managers can configure entry types.
        </p>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-sand-900">Activity Entry Types</h1>
          <p className="text-sm text-sand-500">
            Configure the entry types techs can log (Milestones, Damage Reports, etc.)
          </p>
        </div>
        <Button onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4" />
          Add Entry Type
        </Button>
      </div>

      <Card>
        <CardTitle>Entry Types ({types.length})</CardTitle>
        {loading ? (
          <div className="mt-3 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : types.length === 0 ? (
          <p className="py-8 text-center text-sm text-sand-400">
            No entry types yet. Add one to get started.
          </p>
        ) : (
          <div className="mt-3 space-y-1">
            {types.map((t, index) => {
              const Icon = iconForKey(t.icon)
              const color = colorForKey(t.color)
              const isDragging = dragIndex === index
              const isOver = overIndex === index && dragIndex !== null && dragIndex !== index
              return (
                <div
                  key={t.id}
                  draggable
                  onDragStart={() => setDragIndex(index)}
                  onDragOver={(e) => {
                    e.preventDefault()
                    setOverIndex(index)
                  }}
                  onDragLeave={() => setOverIndex(null)}
                  onDrop={(e) => {
                    e.preventDefault()
                    if (dragIndex !== null) handleReorder(dragIndex, index)
                    setDragIndex(null)
                    setOverIndex(null)
                  }}
                  onDragEnd={() => {
                    setDragIndex(null)
                    setOverIndex(null)
                  }}
                  className={`flex items-center gap-3 rounded-lg border border-sand-100 bg-white p-3 transition-all hover:bg-sand-50 ${
                    isDragging ? 'opacity-40' : ''
                  } ${isOver ? 'ring-2 ring-teal-400' : ''}`}
                >
                  <GripVertical className="h-4 w-4 cursor-grab text-sand-300" />
                  <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${color.bg}`}>
                    <Icon className={`h-5 w-5 ${color.text}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sand-900">{t.label}</span>
                      {t.is_default && (
                        <span className="rounded bg-teal-50 px-1.5 py-0.5 text-[10px] font-semibold text-teal-700">
                          Default
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-sand-400">
                      <span className="inline-flex items-center gap-1">
                        <span className={`h-2 w-2 rounded-full ${color.swatch}`} />
                        {t.color ?? 'slate'}
                      </span>
                      <span>&middot;</span>
                      <span>{t.icon ?? 'default'}</span>
                      <span>&middot;</span>
                      <span>sort {t.sort_order}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setEditing(t)}
                    className="rounded-md p-1.5 text-sand-400 hover:bg-sand-100 hover:text-sand-600"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(t.id)}
                    className="rounded-md p-1.5 text-sand-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      <Modal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        title="Add Entry Type"
        className="max-w-md"
      >
        <EntryTypeForm
          orgId={orgId}
          onCancel={() => setShowAdd(false)}
          onSaved={() => {
            setShowAdd(false)
            fetchTypes()
          }}
        />
      </Modal>

      {editing && (
        <Modal
          open={!!editing}
          onClose={() => setEditing(null)}
          title="Edit Entry Type"
          className="max-w-md"
        >
          <EntryTypeForm
            orgId={orgId}
            existing={editing}
            onCancel={() => setEditing(null)}
            onSaved={() => {
              setEditing(null)
              fetchTypes()
            }}
          />
        </Modal>
      )}
    </div>
  )
}

function EntryTypeForm({
  orgId,
  existing,
  onCancel,
  onSaved,
}: {
  orgId: string | null
  existing?: ActivityEntryType
  onCancel: () => void
  onSaved: () => void
}) {
  const [label, setLabel] = useState(existing?.label ?? '')
  const [icon, setIcon] = useState<string>(existing?.icon ?? 'flag')
  const [color, setColor] = useState<ColorKey>(
    (existing?.color && (COLOR_OPTIONS as readonly string[]).includes(existing.color)
      ? (existing.color as ColorKey)
      : 'teal')
  )
  const [sortOrder, setSortOrder] = useState<string>(String(existing?.sort_order ?? 0))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!orgId) {
      setError('No active organization')
      return
    }
    if (!label.trim()) {
      setError('Label is required')
      return
    }
    setSaving(true)
    setError(null)
    const supabase = createClient()
    const payload = {
      label: label.trim(),
      icon,
      color,
      sort_order: parseInt(sortOrder, 10) || 0,
    }
    if (existing) {
      const { error: updErr } = await supabase
        .from('activity_entry_types')
        .update(payload)
        .eq('id', existing.id)
      setSaving(false)
      if (updErr) {
        setError(updErr.message)
        return
      }
    } else {
      const { error: insErr } = await supabase
        .from('activity_entry_types')
        .insert({ ...payload, org_id: orgId, is_default: false })
      setSaving(false)
      if (insErr) {
        setError(insErr.message)
        return
      }
    }
    onSaved()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-sand-700">Label *</label>
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g., Milestone"
          required
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-sand-700">Icon</label>
        <div className="grid grid-cols-6 gap-2">
          {ICON_OPTIONS.map((key) => {
            const Icon = iconForKey(key)
            const selected = icon === key
            return (
              <button
                type="button"
                key={key}
                onClick={() => setIcon(key)}
                className={`flex h-10 w-10 items-center justify-center rounded-lg border text-sand-700 transition-colors ${
                  selected
                    ? 'border-teal-500 bg-teal-50 text-teal-700'
                    : 'border-sand-200 hover:border-sand-300'
                }`}
                title={key}
              >
                <Icon className="h-4 w-4" />
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-sand-700">Color</label>
        <div className="flex flex-wrap gap-2">
          {COLOR_OPTIONS.map((c) => {
            const classes = COLOR_CLASSES[c]
            const selected = color === c
            return (
              <button
                type="button"
                key={c}
                onClick={() => setColor(c)}
                className={`h-8 w-8 rounded-full ${classes.swatch} transition-all ${
                  selected ? 'ring-2 ring-offset-2 ring-sand-400' : 'opacity-70 hover:opacity-100'
                }`}
                title={c}
              />
            )
          })}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-sand-700">Sort Order</label>
        <Input
          type="number"
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
        />
      </div>

      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <div className="flex justify-end gap-3 border-t border-sand-100 pt-4">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : existing ? 'Save Changes' : 'Add Entry Type'}
        </Button>
      </div>
    </form>
  )
}
