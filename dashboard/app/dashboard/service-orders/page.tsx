'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Modal } from '@/components/ui/modal'
import {
  DndContext,
  closestCenter,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import { ClipboardList } from 'lucide-react'
import type { ServiceOrder, ServiceOrderStatus, UrgencyLevel } from '@/lib/types'

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

export default function ServiceOrdersPage() {
  const [orders, setOrders] = useState<ServiceOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [activeOrder, setActiveOrder] = useState<ServiceOrder | null>(null)
  const [selectedOrder, setSelectedOrder] = useState<ServiceOrder | null>(null)

  useEffect(() => {
    fetchOrders()
  }, [])

  async function fetchOrders() {
    const supabase = createClient()
    const { data } = await supabase
      .from('service_orders')
      .select(`
        *,
        jobsite:jobsites(name),
        requester:users!service_orders_requested_by_fkey(full_name)
      `)
      .not('status', 'eq', 'canceled')
      .order('created_at', { ascending: false })

    setOrders((data as ServiceOrder[]) ?? [])
    setLoading(false)
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
    const newStatus = over.id as ServiceOrderStatus

    const order = orders.find((o) => o.id === orderId)
    if (!order || order.status === newStatus) return

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
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-5 gap-4">
          {STATUS_COLUMNS.map((col) => {
            const colOrders = orders.filter((o) => o.status === col.key)
            return (
              <div
                key={col.key}
                id={col.key}
                className="min-h-[400px] rounded-xl border border-sand-200 bg-sand-50/50 p-3"
              >
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-sand-700">{col.label}</h3>
                  <span className="rounded-full bg-sand-200 px-2 py-0.5 text-xs font-medium text-sand-600">
                    {colOrders.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {colOrders.map((order) => (
                    <div
                      key={order.id}
                      id={order.id}
                      onClick={() => setSelectedOrder(order)}
                      className="cursor-pointer rounded-lg border border-sand-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md"
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
                      {(order as Record<string, unknown>).jobsite && (
                        <p className="mt-1 text-xs text-sand-500">
                          {((order as Record<string, unknown>).jobsite as { name: string })?.name}
                        </p>
                      )}
                      {order.description && (
                        <p className="mt-1 text-xs text-sand-400 line-clamp-2">
                          {order.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        <DragOverlay>
          {activeOrder && (
            <div className="rounded-lg border border-indigo-200 bg-white p-3 shadow-lg">
              <span className="text-sm font-semibold text-sand-900">{activeOrder.title}</span>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {selectedOrder && (
        <Modal
          open={!!selectedOrder}
          onClose={() => setSelectedOrder(null)}
          title="Service Order Details"
          className="max-w-lg"
        >
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-sand-900">{selectedOrder.title}</h3>
              <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${urgencyColor[selectedOrder.urgency]}`}>
                {selectedOrder.urgency}
              </span>
            </div>
            {selectedOrder.description && (
              <p className="text-sm text-sand-600">{selectedOrder.description}</p>
            )}
            {selectedOrder.estimated_cost && (
              <p className="text-sm text-sand-600">
                Est. cost: ${selectedOrder.estimated_cost.toFixed(2)}
              </p>
            )}
            <p className="text-xs text-sand-400">
              Created: {new Date(selectedOrder.created_at).toLocaleDateString()}
            </p>
          </div>
        </Modal>
      )}
    </div>
  )
}
