'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate, formatCurrency, formatRepairStatus } from '@/lib/utils'
import type { RepairRequest, RepairStatus, Customer, User } from '@/lib/types'
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Wrench } from 'lucide-react'

type RepairWithRelations = RepairRequest & {
  customer: Pick<Customer, 'first_name' | 'last_name'>
  requester: Pick<User, 'full_name'>
}

const COLUMNS: { id: RepairStatus; label: string }[] = [
  { id: 'pending_review', label: 'Pending Review' },
  { id: 'quoted', label: 'Quoted' },
  { id: 'approved', label: 'Approved' },
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'completed', label: 'Completed' },
]

const urgencyColors: Record<string, string> = {
  low: 'bg-emerald-100 text-emerald-700',
  medium: 'bg-amber-100 text-amber-700',
  high: 'bg-orange-100 text-orange-700',
  emergency: 'bg-red-100 text-red-700',
}

function RepairCard({
  repair,
  onClick,
}: {
  repair: RepairWithRelations
  onClick: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: repair.id, data: { repair } })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="cursor-grab rounded-lg border border-sand-200 bg-white p-3 shadow-sm hover:shadow-md transition-shadow active:cursor-grabbing"
      onClick={onClick}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs font-medium text-sand-800 capitalize">
          {repair.category.replace(/_/g, ' ')}
        </span>
        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${urgencyColors[repair.urgency]}`}>
          {repair.urgency}
        </span>
      </div>
      <p className="text-sm font-medium text-sand-900">
        {repair.customer.first_name} {repair.customer.last_name}
      </p>
      <p className="mt-1 line-clamp-2 text-xs text-sand-500">
        {repair.description}
      </p>
      <p className="mt-2 text-xs text-sand-400">{formatDate(repair.created_at)}</p>
    </div>
  )
}

function KanbanColumn({
  column,
  repairs,
  onCardClick,
}: {
  column: { id: RepairStatus; label: string }
  repairs: RepairWithRelations[]
  onCardClick: (r: RepairWithRelations) => void
}) {
  return (
    <div className="flex w-72 flex-shrink-0 flex-col rounded-xl bg-sand-100/50 p-3">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-sand-700">{column.label}</h3>
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-sand-200 text-xs font-medium text-sand-600">
          {repairs.length}
        </span>
      </div>
      <SortableContext items={repairs.map((r) => r.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-2 min-h-[60px]">
          {repairs.map((repair) => (
            <RepairCard
              key={repair.id}
              repair={repair}
              onClick={() => onCardClick(repair)}
            />
          ))}
        </div>
      </SortableContext>
    </div>
  )
}

export default function RepairsPage() {
  const [repairs, setRepairs] = useState<RepairWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRepair, setSelectedRepair] = useState<RepairWithRelations | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  )

  const fetchRepairs = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('repair_requests')
      .select(`
        *,
        customer:customers(first_name, last_name),
        requester:users!repair_requests_requested_by_fkey(full_name)
      `)
      .neq('status', 'declined')
      .order('created_at', { ascending: false })

    setRepairs((data ?? []) as unknown as RepairWithRelations[])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchRepairs()
  }, [fetchRepairs])

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string)
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveId(null)
    const { active, over } = event
    if (!over) return

    const repairId = active.id as string
    const repair = repairs.find((r) => r.id === repairId)
    if (!repair) return

    // Determine destination column
    let destColumn: RepairStatus | null = null

    // Check if dropped over a column header area or another card
    const overRepair = repairs.find((r) => r.id === over.id)
    if (overRepair) {
      destColumn = overRepair.status
    } else {
      // Dropped on a column directly
      destColumn = over.id as RepairStatus
    }

    if (!destColumn || destColumn === repair.status) return

    // Optimistic update
    setRepairs((prev) =>
      prev.map((r) => (r.id === repairId ? { ...r, status: destColumn } : r))
    )

    const supabase = createClient()
    const { error } = await supabase
      .from('repair_requests')
      .update({ status: destColumn })
      .eq('id', repairId)

    if (error) {
      fetchRepairs() // Revert on error
    }
  }

  async function updateRepairStatus(repairId: string, newStatus: RepairStatus) {
    const supabase = createClient()
    await supabase.from('repair_requests').update({ status: newStatus }).eq('id', repairId)
    fetchRepairs()
    setSelectedRepair(null)
  }

  const activeRepair = activeId ? repairs.find((r) => r.id === activeId) : null

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="flex gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-96 w-72" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-sand-900">Repair Queue</h1>
        <p className="text-sm text-sand-500">Drag cards between columns to update status</p>
      </div>

      <div className="overflow-x-auto pb-4">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4">
            {COLUMNS.map((col) => (
              <KanbanColumn
                key={col.id}
                column={col}
                repairs={repairs.filter((r) => r.status === col.id)}
                onCardClick={setSelectedRepair}
              />
            ))}
          </div>

          <DragOverlay>
            {activeRepair ? (
              <div className="w-72 rounded-lg border border-aqua-300 bg-white p-3 shadow-lg">
                <p className="text-sm font-medium text-sand-900">
                  {activeRepair.customer.first_name} {activeRepair.customer.last_name}
                </p>
                <p className="text-xs text-sand-500 capitalize">
                  {activeRepair.category.replace(/_/g, ' ')}
                </p>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Detail Modal */}
      <Modal
        open={!!selectedRepair}
        onClose={() => setSelectedRepair(null)}
        title="Repair Request Details"
        className="max-w-lg"
      >
        {selectedRepair && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Wrench className="h-5 w-5 text-sand-400" />
              <span className="text-sm font-medium capitalize text-sand-800">
                {selectedRepair.category.replace(/_/g, ' ')}
              </span>
              <Badge
                variant={
                  selectedRepair.urgency === 'emergency'
                    ? 'red'
                    : selectedRepair.urgency === 'high'
                    ? 'amber'
                    : 'green'
                }
              >
                {selectedRepair.urgency}
              </Badge>
            </div>

            <div>
              <p className="text-sm font-medium text-sand-700">Customer</p>
              <p className="text-sm text-sand-900">
                {selectedRepair.customer.first_name} {selectedRepair.customer.last_name}
              </p>
            </div>

            <div>
              <p className="text-sm font-medium text-sand-700">Description</p>
              <p className="text-sm text-sand-600">{selectedRepair.description}</p>
            </div>

            {selectedRepair.estimated_cost && (
              <div>
                <p className="text-sm font-medium text-sand-700">Estimated Cost</p>
                <p className="text-sm text-sand-900">{formatCurrency(Number(selectedRepair.estimated_cost))}</p>
              </div>
            )}

            <div>
              <p className="text-sm font-medium text-sand-700">Submitted By</p>
              <p className="text-sm text-sand-600">{selectedRepair.requester.full_name}</p>
            </div>

            <div>
              <p className="text-sm font-medium text-sand-700">Submitted</p>
              <p className="text-sm text-sand-600">{formatDate(selectedRepair.created_at)}</p>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-sand-700">Update Status</p>
              <select
                className="block w-full rounded-lg border border-sand-300 bg-white px-3 py-2 text-sm"
                value={selectedRepair.status}
                onChange={(e) =>
                  updateRepairStatus(selectedRepair.id, e.target.value as RepairStatus)
                }
              >
                {COLUMNS.map((col) => (
                  <option key={col.id} value={col.id}>
                    {col.label}
                  </option>
                ))}
                <option value="declined">Declined</option>
              </select>
            </div>

            <div className="flex justify-end">
              <Button variant="secondary" onClick={() => setSelectedRepair(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
