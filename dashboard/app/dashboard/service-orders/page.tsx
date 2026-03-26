'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import {
  DndContext,
  closestCorners,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import { ClipboardList, Loader2, X, Check, ChevronDown } from 'lucide-react'
import type { ServiceOrder, ServiceOrderStatus, UrgencyLevel } from '@/lib/types'

interface OrgMember {
  user_id: string
  full_name: string
}

interface AssigneeInfo {
  user_id: string
  full_name: string
}

const URGENCY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'emergency', label: 'Emergency' },
]

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'invoiced', label: 'Invoiced' },
  { value: 'canceled', label: 'Canceled' },
]

const STATUS_COLUMNS: { key: ServiceOrderStatus; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'completed', label: 'Completed' },
]

const urgencyColor: Record<UrgencyLevel, string> = {
  low: 'bg-emerald-50 text-emerald-700',
  medium: 'bg-amber-50 text-amber-700',
  high: 'bg-orange-50 text-orange-700',
  emergency: 'bg-red-50 text-red-700',
}

// ---------------------------------------------------------------------------
// Multi-select tech picker
// ---------------------------------------------------------------------------

function TechMultiSelect({
  members,
  selected,
  onChange,
}: {
  members: OrgMember[]
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function toggle(userId: string) {
    if (selected.includes(userId)) {
      onChange(selected.filter((id) => id !== userId))
    } else {
      onChange([...selected, userId])
    }
  }

  function remove(userId: string) {
    onChange(selected.filter((id) => id !== userId))
  }

  const selectedMembers = members.filter((m) => selected.includes(m.user_id))

  return (
    <div ref={ref} className="relative">
      <div
        onClick={() => setOpen(!open)}
        className="flex min-h-[38px] w-full cursor-pointer flex-wrap items-center gap-1.5 rounded-lg border border-sand-300 bg-white px-3 py-1.5 text-sm text-sand-900 focus-within:border-teal-500 focus-within:ring-1 focus-within:ring-teal-500"
      >
        {selectedMembers.length === 0 && (
          <span className="text-sand-400">Select techs...</span>
        )}
        {selectedMembers.map((m) => (
          <span
            key={m.user_id}
            className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700"
          >
            {m.full_name}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                remove(m.user_id)
              }}
              className="ml-0.5 rounded-full p-0.5 hover:bg-teal-100"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <ChevronDown className="ml-auto h-4 w-4 shrink-0 text-sand-400" />
      </div>

      {open && (
        <div className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-sand-200 bg-white py-1 shadow-lg">
          {members.length === 0 && (
            <p className="px-3 py-2 text-sm text-sand-400">No team members found</p>
          )}
          {members.map((m) => {
            const isSelected = selected.includes(m.user_id)
            return (
              <button
                key={m.user_id}
                type="button"
                onClick={() => toggle(m.user_id)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-sand-50"
              >
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                    isSelected
                      ? 'border-teal-600 bg-teal-600 text-white'
                      : 'border-sand-300'
                  }`}
                >
                  {isSelected && <Check className="h-3 w-3" />}
                </span>
                <span className={isSelected ? 'font-medium text-sand-900' : 'text-sand-700'}>
                  {m.full_name}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Droppable Column wrapper
// ---------------------------------------------------------------------------

function DroppableColumn({
  id,
  label,
  count,
  children,
}: {
  id: string
  label: string
  count: number
  children: React.ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id })

  return (
    <div
      ref={setNodeRef}
      className={`min-h-[400px] rounded-xl border p-3 transition-colors ${
        isOver
          ? 'border-teal-400 bg-teal-50/60'
          : 'border-sand-200 bg-sand-50/50'
      }`}
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-sand-700">{label}</h3>
        <span className="rounded-full bg-sand-200 px-2 py-0.5 text-xs font-medium text-sand-600">
          {count}
        </span>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Draggable Card wrapper
// ---------------------------------------------------------------------------

function DraggableCard({
  order,
  assigneeNames,
  onSelect,
}: {
  order: ServiceOrder
  assigneeNames: string[]
  onSelect: (o: ServiceOrder) => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: order.id })

  const style: React.CSSProperties = {
    transform: transform
      ? `translate(${transform.x}px, ${transform.y}px)`
      : undefined,
    opacity: isDragging ? 0.4 : 1,
    touchAction: 'none',
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={() => {
        if (!isDragging) onSelect(order)
      }}
      className="cursor-grab rounded-lg border border-sand-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing"
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-sand-900 line-clamp-1">
          {order.title}
        </span>
      </div>
      <span
        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
          urgencyColor[order.urgency]
        }`}
      >
        {order.urgency}
      </span>
      {(order as unknown as { jobsite?: { name: string } }).jobsite?.name ? (
        <p className="mt-1 text-xs text-sand-500">
          {(order as unknown as { jobsite: { name: string } }).jobsite.name}
        </p>
      ) : null}
      {order.description && (
        <p className="mt-1 text-xs text-sand-400 line-clamp-2">
          {order.description}
        </p>
      )}
      {assigneeNames.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {assigneeNames.map((name) => (
            <span
              key={name}
              className="inline-flex items-center gap-1 text-xs text-teal-600"
            >
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-teal-500" />
              {name}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function ServiceOrdersPage() {
  const [orders, setOrders] = useState<ServiceOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [activeOrder, setActiveOrder] = useState<ServiceOrder | null>(null)
  const [selectedOrder, setSelectedOrder] = useState<ServiceOrder | null>(null)

  // Assignees map: service_order_id -> AssigneeInfo[]
  const [assigneesMap, setAssigneesMap] = useState<Record<string, AssigneeInfo[]>>({})

  // Edit form state
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editAssignedIds, setEditAssignedIds] = useState<string[]>([])
  const [editScheduledDate, setEditScheduledDate] = useState('')
  const [editUrgency, setEditUrgency] = useState('medium')
  const [editStatus, setEditStatus] = useState('pending')
  const [editEstimatedCost, setEditEstimatedCost] = useState('')
  const [editActualCost, setEditActualCost] = useState('')
  const [orgMembers, setOrgMembers] = useState<OrgMember[]>([])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // PointerSensor with a small distance constraint so clicks don't trigger drag
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  )

  const fetchOrders = useCallback(async () => {
    const supabase = createClient()

    // Fetch orders
    const { data: ordersData } = await supabase
      .from('service_orders')
      .select(`
        *,
        jobsite:jobsites(name),
        requester:users!service_orders_requested_by_fkey(full_name)
      `)
      .not('status', 'eq', 'canceled')
      .order('created_at', { ascending: false })

    const fetchedOrders = (ordersData ?? []) as ServiceOrder[]
    setOrders(fetchedOrders)

    // Fetch all assignees for these orders
    if (fetchedOrders.length > 0) {
      const orderIds = fetchedOrders.map((o) => o.id)
      const { data: assigneesData } = await supabase
        .from('service_order_assignees')
        .select('service_order_id, user_id, user:users!service_order_assignees_user_id_fkey(full_name)')
        .in('service_order_id', orderIds)

      const map: Record<string, AssigneeInfo[]> = {}
      if (assigneesData) {
        for (const row of assigneesData as { service_order_id: string; user_id: string; user: { full_name: string } | null }[]) {
          if (!map[row.service_order_id]) map[row.service_order_id] = []
          map[row.service_order_id].push({
            user_id: row.user_id,
            full_name: (row.user as { full_name: string } | null)?.full_name ?? 'Unknown',
          })
        }
      }
      setAssigneesMap(map)
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  async function fetchOrgMembers() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: userData } = await supabase
      .from('users')
      .select('active_org_id')
      .eq('id', user.id)
      .single()
    if (!userData?.active_org_id) return

    const { data: members } = await supabase
      .from('org_members')
      .select('user_id, user:users!org_members_user_id_fkey(full_name)')
      .eq('org_id', userData.active_org_id)

    if (members) {
      setOrgMembers(
        members.map((m: { user_id: string; user: { full_name: string } | null }) => ({
          user_id: m.user_id,
          full_name: (m.user as { full_name: string } | null)?.full_name ?? 'Unknown',
        }))
      )
    }
  }

  function openEditModal(order: ServiceOrder) {
    setSelectedOrder(order)
    setEditTitle(order.title)
    setEditDescription(order.description ?? '')
    setEditScheduledDate(order.scheduled_date ?? '')
    setEditUrgency(order.urgency)
    setEditStatus(order.status)
    setEditEstimatedCost(order.estimated_cost != null ? String(order.estimated_cost) : '')
    setEditActualCost(order.actual_cost != null ? String(order.actual_cost) : '')
    setSaveError(null)

    // Load currently assigned tech IDs
    const currentAssignees = assigneesMap[order.id] ?? []
    setEditAssignedIds(currentAssignees.map((a) => a.user_id))

    fetchOrgMembers()
  }

  async function handleSave() {
    if (!selectedOrder) return
    setSaving(true)
    setSaveError(null)

    const supabase = createClient()

    // 1. Update the service order fields
    const { error } = await supabase
      .from('service_orders')
      .update({
        title: editTitle,
        description: editDescription || null,
        assigned_to: editAssignedIds.length > 0 ? editAssignedIds[0] : null,
        scheduled_date: editScheduledDate || null,
        urgency: editUrgency,
        status: editStatus,
        estimated_cost: editEstimatedCost ? parseFloat(editEstimatedCost) : null,
        actual_cost: editActualCost ? parseFloat(editActualCost) : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', selectedOrder.id)

    if (error) {
      setSaving(false)
      setSaveError(error.message)
      return
    }

    // 2. Sync assignees in junction table
    // Delete existing assignees for this order
    await supabase
      .from('service_order_assignees')
      .delete()
      .eq('service_order_id', selectedOrder.id)

    // Insert new assignees
    if (editAssignedIds.length > 0) {
      const rows = editAssignedIds.map((uid) => ({
        service_order_id: selectedOrder.id,
        user_id: uid,
        org_id: selectedOrder.org_id,
      }))
      const { error: insertError } = await supabase
        .from('service_order_assignees')
        .insert(rows)

      if (insertError) {
        setSaving(false)
        setSaveError(insertError.message)
        return
      }
    }

    setSaving(false)
    setSelectedOrder(null)
    fetchOrders()
  }

  function handleDragStart(event: DragStartEvent) {
    const order = orders.find((o) => o.id === event.active.id)
    if (order) setActiveOrder(order)
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveOrder(null)
    const { active, over } = event
    if (!over) return

    const orderId = active.id as string

    // Determine the target column.
    const columnKeys = STATUS_COLUMNS.map((c) => c.key as string)
    let newStatus: ServiceOrderStatus

    if (columnKeys.includes(over.id as string)) {
      newStatus = over.id as ServiceOrderStatus
    } else {
      const targetCard = orders.find((o) => o.id === over.id)
      if (!targetCard) return
      newStatus = targetCard.status
    }

    const order = orders.find((o) => o.id === orderId)
    if (!order || order.status === newStatus) return

    // Optimistic update
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
    )

    const supabase = createClient()
    await supabase
      .from('service_orders')
      .update({ status: newStatus })
      .eq('id', orderId)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="font-display text-2xl font-bold text-sand-900">Service Orders</h1>
        <div className="grid grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-96 w-full" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-sand-900">Service Orders</h1>
        <p className="text-sm text-sand-500">
          {orders.length} orders &middot; Drag to update status
        </p>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-5 gap-4">
          {STATUS_COLUMNS.map((col) => {
            const colOrders = orders.filter((o) => o.status === col.key)
            return (
              <DroppableColumn
                key={col.key}
                id={col.key}
                label={col.label}
                count={colOrders.length}
              >
                {colOrders.map((order) => (
                  <DraggableCard
                    key={order.id}
                    order={order}
                    assigneeNames={(assigneesMap[order.id] ?? []).map((a) => a.full_name)}
                    onSelect={openEditModal}
                  />
                ))}
              </DroppableColumn>
            )
          })}
        </div>

        <DragOverlay dropAnimation={null}>
          {activeOrder && (
            <div className="rounded-lg border border-teal-300 bg-white p-3 shadow-lg ring-2 ring-teal-200">
              <span className="text-sm font-semibold text-sand-900">{activeOrder.title}</span>
              <span
                className={`ml-2 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                  urgencyColor[activeOrder.urgency]
                }`}
              >
                {activeOrder.urgency}
              </span>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {selectedOrder && (
        <Modal
          open={!!selectedOrder}
          onClose={() => setSelectedOrder(null)}
          title="Edit Service Order"
          className="max-w-xl"
        >
          <div className="space-y-4">
            {/* Read-only info */}
            <div className="rounded-lg bg-sand-50 p-3 text-sm">
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-sand-600">
                <span>
                  Site:{' '}
                  <span className="font-medium text-sand-800">
                    {(selectedOrder as unknown as { jobsite?: { name: string } }).jobsite?.name ?? '—'}
                  </span>
                </span>
                <span>
                  Requested by:{' '}
                  <span className="font-medium text-sand-800">
                    {(selectedOrder as unknown as { requester?: { full_name: string } }).requester?.full_name ?? '—'}
                  </span>
                </span>
                <span>
                  Created:{' '}
                  <span className="font-medium text-sand-800">
                    {new Date(selectedOrder.created_at).toLocaleDateString()}
                  </span>
                </span>
              </div>
            </div>

            {saveError && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{saveError}</div>
            )}

            {/* Title */}
            <div>
              <label className="mb-1 block text-sm font-medium text-sand-700">Title</label>
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} required />
            </div>

            {/* Description */}
            <div>
              <label className="mb-1 block text-sm font-medium text-sand-700">Description</label>
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="w-full rounded-lg border border-sand-300 px-3 py-2 text-sm text-sand-900 placeholder:text-sand-400 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                rows={3}
              />
            </div>

            {/* Assigned Techs (multi-select) */}
            <div>
              <label className="mb-1 block text-sm font-medium text-sand-700">Assigned Techs</label>
              <TechMultiSelect
                members={orgMembers}
                selected={editAssignedIds}
                onChange={setEditAssignedIds}
              />
            </div>

            {/* Scheduled Date */}
            <div>
              <label className="mb-1 block text-sm font-medium text-sand-700">Scheduled Date</label>
              <Input
                type="date"
                value={editScheduledDate}
                onChange={(e) => setEditScheduledDate(e.target.value)}
              />
            </div>

            {/* Urgency + Status */}
            <div className="grid grid-cols-2 gap-4">
              <Select
                name="urgency"
                label="Priority"
                value={editUrgency}
                onChange={(e) => setEditUrgency(e.target.value)}
                options={URGENCY_OPTIONS}
              />
              <Select
                name="status"
                label="Status"
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
                options={STATUS_OPTIONS}
              />
            </div>

            {/* Costs */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-sand-700">Estimated Cost</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editEstimatedCost}
                  onChange={(e) => setEditEstimatedCost(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-sand-700">Actual Cost</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editActualCost}
                  onChange={(e) => setEditActualCost(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 border-t border-sand-100 pt-4">
              <Button variant="secondary" onClick={() => setSelectedOrder(null)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving || !editTitle.trim()}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
