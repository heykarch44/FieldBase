'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Card, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency, formatDate, formatDateTime, formatDayOfWeek, formatPoolType, formatRepairStatus } from '@/lib/utils'
import type { Customer, ServiceVisit, ChemicalLog, EquipmentInventory, RepairRequest, User } from '@/lib/types'
import { ArrowLeft, Mail, Phone, MapPin, Key, Droplets, Calendar, Wrench } from 'lucide-react'

type VisitWithTechnician = ServiceVisit & { technician: Pick<User, 'full_name'> }

export default function CustomerDetailPage() {
  const params = useParams()
  const id = params.id as string
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [visits, setVisits] = useState<VisitWithTechnician[]>([])
  const [chemicals, setChemicals] = useState<ChemicalLog[]>([])
  const [equipment, setEquipment] = useState<EquipmentInventory[]>([])
  const [repairs, setRepairs] = useState<RepairRequest[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient()

      const [custRes, visitsRes, equipRes, repairsRes] = await Promise.all([
        supabase.from('customers').select('*').eq('id', id).single(),
        supabase
          .from('service_visits')
          .select('*, technician:users!service_visits_technician_id_fkey(full_name)')
          .eq('customer_id', id)
          .order('scheduled_date', { ascending: false })
          .limit(20),
        supabase
          .from('equipment_inventory')
          .select('*')
          .eq('customer_id', id)
          .order('equipment_type'),
        supabase
          .from('repair_requests')
          .select('*')
          .eq('customer_id', id)
          .order('created_at', { ascending: false }),
      ])

      setCustomer(custRes.data as Customer | null)
      const visitData = (visitsRes.data ?? []) as unknown as VisitWithTechnician[]
      setVisits(visitData)
      setEquipment((equipRes.data ?? []) as EquipmentInventory[])
      setRepairs((repairsRes.data ?? []) as RepairRequest[])

      // Fetch chemical logs for these visits
      const visitIds = visitData.map((v) => v.id)
      if (visitIds.length > 0) {
        const { data: chemData } = await supabase
          .from('chemical_logs')
          .select('*')
          .in('visit_id', visitIds)
          .order('logged_at', { ascending: false })

        setChemicals((chemData ?? []) as ChemicalLog[])
      }

      setLoading(false)
    }

    fetchData()
  }, [id])

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Skeleton className="h-64" />
          <Skeleton className="col-span-2 h-64" />
        </div>
      </div>
    )
  }

  if (!customer) {
    return (
      <div className="text-center py-12">
        <p className="text-sand-500">Customer not found</p>
        <Link href="/dashboard/customers">
          <Button variant="secondary" className="mt-4">Back to Customers</Button>
        </Link>
      </div>
    )
  }

  const statusVariant = customer.status === 'active' ? 'green' : customer.status === 'lead' ? 'amber' : 'gray'

  const conditionVariant: Record<string, 'green' | 'amber' | 'red' | 'gray'> = {
    good: 'green',
    fair: 'amber',
    poor: 'red',
    needs_replacement: 'red',
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/customers">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="font-display text-2xl font-bold text-sand-900">
            {customer.first_name} {customer.last_name}
          </h1>
          <Badge variant={statusVariant}>
            {customer.status.charAt(0).toUpperCase() + customer.status.slice(1)}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Contact Info */}
        <Card>
          <CardTitle>Contact Info</CardTitle>
          <CardContent>
            <div className="space-y-3 text-sm">
              {customer.email && (
                <div className="flex items-center gap-2 text-sand-600">
                  <Mail className="h-4 w-4 text-sand-400" />
                  {customer.email}
                </div>
              )}
              {customer.phone && (
                <div className="flex items-center gap-2 text-sand-600">
                  <Phone className="h-4 w-4 text-sand-400" />
                  {customer.phone}
                </div>
              )}
              <div className="flex items-start gap-2 text-sand-600">
                <MapPin className="mt-0.5 h-4 w-4 text-sand-400" />
                <div>
                  <p>{customer.address_line1}</p>
                  {customer.address_line2 && <p>{customer.address_line2}</p>}
                  <p>{customer.city}, {customer.state} {customer.zip}</p>
                </div>
              </div>
              {customer.gate_code && (
                <div className="flex items-center gap-2 text-sand-600">
                  <Key className="h-4 w-4 text-sand-400" />
                  Gate: {customer.gate_code}
                </div>
              )}
              {customer.access_notes && (
                <p className="rounded-lg bg-sand-50 p-2 text-xs text-sand-500">
                  {customer.access_notes}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Pool Info */}
        <Card>
          <CardTitle>Pool Info</CardTitle>
          <CardContent>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2 text-sand-600">
                <Droplets className="h-4 w-4 text-sand-400" />
                {formatPoolType(customer.pool_type)}
                {customer.pool_volume_gallons && ` — ${customer.pool_volume_gallons.toLocaleString()} gal`}
              </div>
              {customer.service_day && (
                <div className="flex items-center gap-2 text-sand-600">
                  <Calendar className="h-4 w-4 text-sand-400" />
                  Service Day: {formatDayOfWeek(customer.service_day)}
                </div>
              )}
              {customer.monthly_rate && (
                <div className="flex items-center gap-2 text-sand-600">
                  Monthly Rate: <span className="font-semibold text-sand-900">{formatCurrency(Number(customer.monthly_rate))}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Equipment */}
        <Card>
          <CardTitle>Equipment</CardTitle>
          <CardContent>
            {equipment.length === 0 ? (
              <p className="text-sm text-sand-400">No equipment recorded</p>
            ) : (
              <div className="space-y-3">
                {equipment.map((eq) => (
                  <div key={eq.id} className="rounded-lg border border-sand-100 p-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-sand-800 capitalize">
                        {eq.equipment_type.replace(/_/g, ' ')}
                      </p>
                      <Badge variant={conditionVariant[eq.condition] ?? 'gray'}>
                        {eq.condition.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                    <p className="text-xs text-sand-500">
                      {[eq.brand, eq.model].filter(Boolean).join(' ')}
                    </p>
                    {eq.warranty_expiry && (
                      <p className="text-xs text-sand-400">
                        Warranty: {formatDate(eq.warranty_expiry)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Service History */}
      <Card>
        <CardTitle>Service History</CardTitle>
        <CardContent>
          {visits.length === 0 ? (
            <p className="text-sm text-sand-400">No service visits yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-sand-200 text-left">
                    <th className="pb-2 font-medium text-sand-600">Date</th>
                    <th className="pb-2 font-medium text-sand-600">Technician</th>
                    <th className="pb-2 font-medium text-sand-600">Status</th>
                    <th className="pb-2 font-medium text-sand-600">Time</th>
                    <th className="pb-2 font-medium text-sand-600">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {visits.map((visit) => {
                    const visitStatusVariant = visit.status === 'completed'
                      ? 'green'
                      : visit.status === 'in_progress'
                      ? 'aqua'
                      : visit.status === 'skipped'
                      ? 'red'
                      : 'gray'
                    return (
                      <tr key={visit.id} className="border-b border-sand-50">
                        <td className="py-2">{formatDate(visit.scheduled_date)}</td>
                        <td className="py-2">{visit.technician?.full_name ?? '—'}</td>
                        <td className="py-2">
                          <Badge variant={visitStatusVariant}>
                            {visit.status.replace(/_/g, ' ')}
                          </Badge>
                        </td>
                        <td className="py-2 text-sand-500">
                          {visit.arrived_at && visit.departed_at
                            ? `${Math.round(
                                (new Date(visit.departed_at).getTime() - new Date(visit.arrived_at).getTime()) / 60000
                              )} min`
                            : '—'}
                        </td>
                        <td className="max-w-xs truncate py-2 text-sand-500">
                          {visit.notes ?? '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Chemical Logs */}
      <Card>
        <CardTitle>Chemical Log History</CardTitle>
        <CardContent>
          {chemicals.length === 0 ? (
            <p className="text-sm text-sand-400">No chemical logs recorded</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-sand-200 text-left">
                    <th className="pb-2 font-medium text-sand-600">Date</th>
                    <th className="pb-2 font-medium text-sand-600">Chemical</th>
                    <th className="pb-2 font-medium text-sand-600">Amount</th>
                    <th className="pb-2 font-medium text-sand-600">pH</th>
                    <th className="pb-2 font-medium text-sand-600">Chlorine</th>
                    <th className="pb-2 font-medium text-sand-600">Temp</th>
                  </tr>
                </thead>
                <tbody>
                  {chemicals.map((log) => (
                    <tr key={log.id} className="border-b border-sand-50">
                      <td className="py-2">{formatDateTime(log.logged_at)}</td>
                      <td className="py-2">{log.chemical_name ?? '—'}</td>
                      <td className="py-2">
                        {log.amount && log.unit ? `${log.amount} ${log.unit}` : '—'}
                      </td>
                      <td className="py-2">
                        {log.ph_before != null ? `${log.ph_before} → ${log.ph_after}` : '—'}
                      </td>
                      <td className="py-2">
                        {log.chlorine_before != null
                          ? `${log.chlorine_before} → ${log.chlorine_after}`
                          : '—'}
                      </td>
                      <td className="py-2">{log.water_temp ? `${log.water_temp}°F` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Repair Requests */}
      {repairs.length > 0 && (
        <Card>
          <CardTitle>Repair Requests</CardTitle>
          <CardContent>
            <div className="space-y-3">
              {repairs.map((repair) => {
                const urgencyVariant = repair.urgency === 'emergency'
                  ? 'red'
                  : repair.urgency === 'high'
                  ? 'amber'
                  : repair.urgency === 'medium'
                  ? 'amber'
                  : 'green'
                return (
                  <div key={repair.id} className="rounded-lg border border-sand-100 p-3">
                    <div className="flex items-center gap-2">
                      <Wrench className="h-4 w-4 text-sand-400" />
                      <span className="text-sm font-medium capitalize text-sand-800">
                        {repair.category.replace(/_/g, ' ')}
                      </span>
                      <Badge variant={urgencyVariant}>{repair.urgency}</Badge>
                      <Badge variant="gray">{formatRepairStatus(repair.status)}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-sand-600">{repair.description}</p>
                    <p className="mt-1 text-xs text-sand-400">{formatDate(repair.created_at)}</p>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
