'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, GripVertical, Pencil, Trash2, Loader2 } from 'lucide-react'
import type { ServiceOrderType } from '@/lib/types'

const COLOR_OPTIONS = [
  'teal', 'red', 'orange', 'amber', 'yellow', 'green', 'blue', 'purple', 'pink', 'slate',
] as const

type ColorKey = typeof COLOR_OPTIONS[number]

const COLOR_CLASSES: Record<ColorKey, { bg: string; text: string; swatch: string }> = {
  teal:   { bg: 'bg-teal-50',   text: 'text-teal-700',   swatch: 'bg-teal-500' },
  red:    { bg: 'bg-red-50',    text: 'text-red-700',    swatch: 'bg-red-500' },
  orange: { bg: 'bg-orange-50', text: 'text-orange-700', swatch: 'bg-orange-500' },
  amber:  { bg: 'bg-amber-50',  text: 'text-amber-700',  swatch: 'bg-amber-500' },
  yellow: { bg: 'bg-yellow-50', text: 'text-yellow-700', swatch: 'bg-yellow-500' },
  green:  { bg: 'bg-green-50',  text: 'text-green-700',  swatch: 'bg-green-500' },
  blue:   { bg: 'bg-blue-50',   text: 'text-blue-700',   swatch: 'bg-blue-500' },
  purple: { bg: 'bg-purple-50', text: 'text-purple-700', swatch: 'bg-purple-500' },
  pink:   { bg: 'bg-pink-50',   text: 'text-pink-700',   swatch: 'bg-pink-500' },
  slate:  { bg: 'bg-slate-50',  text: 'text-slate-700',  swatch: 'bg-slate-500' },
}

function colorForKey(color: string | null): typeof COLOR_CLASSES[ColorKey] {
  if (color && (COLOR_OPTIONS as readonly string[]).includes(color)) {
    return COLOR_CLASSES[color as ColorKey]
  }
  return COLOR_CLASSES.slate
}

export default function ServiceTypesPage() {
  const [types, setTypes] = useState<ServiceOrderType[]>([])
  const [loading, setLoading] = useState(true)
  const [canManage, setCanManage] = useState(false)
  const [checkedRole, setCheckedRole] = useState(false)
  const [orgId, setOrgId] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<ServiceOrderType | null>(null)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)

  const fetchTypes = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('service_order_types')
      .select('*')
      .order('sort_order', { ascending: true })
    setTypes((data ?? []) as ServiceOrderType[])
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
    if (!confirm('Delete this service type? Existing orders will lose the link but keep their signature settings.')) return
    const supabase = createClient()
    await supabase.from('service_order_types').delete().eq('id', id)
    fetchTypes()
  }

  async function toggleActive(t: ServiceOrderType) {
    const supabase = createClient()
    await supabase
      .from('service_order_types')
      .update({ is_active: !t.is_active })
      .eq('id', t.id)
    fetchTypes()
  }

  async function toggleRequiresSig(t: ServiceOrderType) {
    const supabase = createClient()
    await supabase
      .from('service_order_types')
      .update({ requires_signature_default: !t.requires_signature_default })
      .eq('id', t.id)
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
          .from('service_order_types')
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
        <CardTitle>Service Order Types</CardTitle>
        <p className="py-6 text-center text-sm text-sand-500">
          Only managers can configure service types.
        </p>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-sand-900">Service Order Types</h1>
          <p className="text-sm text-sand-500">
            Configure the types of service orders your team handles (Install, Repair, etc.) and which require customer signatures.
          </p>
        </div>
        <Button onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4" />
          Add Service Type
        </Button>
      </div>

      <Card>
        <CardTitle>Service Types ({types.length})</CardTitle>
        {loading ? (
          <div className="mt-3 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : types.length === 0 ? (
          <p className="py-8 text-center text-sm text-sand-400">
            No service types yet. Add one to get started.
          </p>
        ) : (
          <div className="mt-3 space-y-1">
            {types.map((t, index) => {
              const color = colorForKey(t.color_key)
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
                  } ${isOver ? 'ring-2 ring-teal-400' : ''} ${!t.is_active ? 'opacity-60' : ''}`}
                >
                  <GripVertical className="h-4 w-4 cursor-grab text-sand-300" />
                  <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${color.bg}`}>
                    <span className={`h-3 w-3 rounded-full ${color.swatch}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sand-900">{t.label}</span>
                      {!t.is_active && (
                        <span className="rounded bg-sand-100 px-1.5 py-0.5 text-[10px] font-semibold text-sand-600">
                          Inactive
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-sand-400">
                      <span className="inline-flex items-center gap-1">
                        <span className={`h-2 w-2 rounded-full ${color.swatch}`} />
                        {t.color_key}
                      </span>
                      <span>&middot;</span>
                      <span>sort {t.sort_order}</span>
                    </div>
                  </div>
                  <label className="flex items-center gap-1.5 text-xs text-sand-600">
                    <input
                      type="checkbox"
                      checked={t.requires_signature_default}
                      onChange={() => toggleRequiresSig(t)}
                      className="h-4 w-4 rounded border-sand-300 text-teal-600 focus:ring-teal-500"
                    />
                    Sig default
                  </label>
                  <button
                    onClick={() => toggleActive(t)}
                    className={`rounded-md px-2 py-1 text-xs font-medium ${
                      t.is_active
                        ? 'bg-teal-50 text-teal-700 hover:bg-teal-100'
                        : 'bg-sand-100 text-sand-600 hover:bg-sand-200'
                    }`}
                  >
                    {t.is_active ? 'Active' : 'Inactive'}
                  </button>
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
        title="Add Service Type"
        className="max-w-md"
      >
        <ServiceTypeForm
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
          title="Edit Service Type"
          className="max-w-md"
        >
          <ServiceTypeForm
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

function ServiceTypeForm({
  orgId,
  existing,
  onCancel,
  onSaved,
}: {
  orgId: string | null
  existing?: ServiceOrderType
  onCancel: () => void
  onSaved: () => void
}) {
  const [label, setLabel] = useState(existing?.label ?? '')
  const [colorKey, setColorKey] = useState<ColorKey>(
    (existing?.color_key && (COLOR_OPTIONS as readonly string[]).includes(existing.color_key)
      ? (existing.color_key as ColorKey)
      : 'teal')
  )
  const [requiresSignature, setRequiresSignature] = useState<boolean>(
    existing?.requires_signature_default ?? true
  )
  const [isActive, setIsActive] = useState<boolean>(existing?.is_active ?? true)
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
      color_key: colorKey,
      requires_signature_default: requiresSignature,
      is_active: isActive,
      sort_order: parseInt(sortOrder, 10) || 0,
    }
    if (existing) {
      const { error: updErr } = await supabase
        .from('service_order_types')
        .update(payload)
        .eq('id', existing.id)
      setSaving(false)
      if (updErr) {
        setError(updErr.message)
        return
      }
    } else {
      const { error: insErr } = await supabase
        .from('service_order_types')
        .insert({ ...payload, org_id: orgId })
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
          placeholder="e.g., Install"
          required
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-sand-700">Color</label>
        <div className="flex flex-wrap gap-2">
          {COLOR_OPTIONS.map((c) => {
            const classes = COLOR_CLASSES[c]
            const selected = colorKey === c
            return (
              <button
                type="button"
                key={c}
                onClick={() => setColorKey(c)}
                className={`h-8 w-8 rounded-full ${classes.swatch} transition-all ${
                  selected ? 'ring-2 ring-offset-2 ring-sand-400' : 'opacity-70 hover:opacity-100'
                }`}
                title={c}
              />
            )
          })}
        </div>
      </div>

      <label className="flex items-start gap-2 rounded-lg border border-sand-200 p-3">
        <input
          type="checkbox"
          checked={requiresSignature}
          onChange={(e) => setRequiresSignature(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-sand-300 text-teal-600 focus:ring-teal-500"
        />
        <span className="text-sm">
          <span className="font-medium text-sand-800">Requires customer signature by default</span>
          <span className="block text-xs text-sand-500">
            New orders of this type will have the signature flag pre-checked. Managers can override per order.
          </span>
        </span>
      </label>

      <label className="flex items-center gap-2 text-sm text-sand-700">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
          className="h-4 w-4 rounded border-sand-300 text-teal-600 focus:ring-teal-500"
        />
        Active (shown in type picker)
      </label>

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
          ) : existing ? 'Save Changes' : 'Add Service Type'}
        </Button>
      </div>
    </form>
  )
}
