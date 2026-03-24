'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardTitle, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { User, EquipmentInventory } from '@/lib/types'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
} from 'recharts'
import { Badge } from '@/components/ui/badge'

interface ChemicalSummary {
  chemical_name: string
  total_amount: number
  unit: string
}

interface TechPerformance {
  name: string
  completedVisits: number
  avgMinutes: number
}

interface RevenueMonth {
  month: string
  revenue: number
}

const CHART_COLORS = ['#0891B2', '#D97706', '#059669', '#7C3AED', '#DC2626', '#2563EB']

export default function ReportsPage() {
  const [loading, setLoading] = useState(true)
  const [chemicalData, setChemicalData] = useState<ChemicalSummary[]>([])
  const [equipment, setEquipment] = useState<EquipmentInventory[]>([])
  const [techPerformance, setTechPerformance] = useState<TechPerformance[]>([])
  const [revenueData, setRevenueData] = useState<RevenueMonth[]>([])
  const [customerCount, setCustomerCount] = useState(0)
  const [mrr, setMrr] = useState(0)

  useEffect(() => {
    async function fetchAll() {
      const supabase = createClient()

      const [chemRes, equipRes, techsRes, custRes] = await Promise.all([
        supabase.from('chemical_logs').select('chemical_name, amount, unit'),
        supabase
          .from('equipment_inventory')
          .select('*, customer:customers(first_name, last_name)')
          .order('condition'),
        supabase.from('users').select('*').eq('role', 'technician'),
        supabase.from('customers').select('id, monthly_rate, status').eq('status', 'active'),
      ])

      // Chemical summary — aggregate by chemical_name
      const chemMap = new Map<string, { total: number; unit: string }>()
      for (const log of (chemRes.data ?? []) as { chemical_name: string | null; amount: number | null; unit: string | null }[]) {
        if (!log.chemical_name || !log.amount) continue
        const existing = chemMap.get(log.chemical_name)
        if (existing) {
          existing.total += Number(log.amount)
        } else {
          chemMap.set(log.chemical_name, { total: Number(log.amount), unit: log.unit ?? 'oz' })
        }
      }
      setChemicalData(
        Array.from(chemMap.entries()).map(([name, data]) => ({
          chemical_name: name,
          total_amount: Math.round(data.total * 100) / 100,
          unit: data.unit,
        }))
      )

      // Equipment
      setEquipment(
        (equipRes.data ?? []) as unknown as (EquipmentInventory & {
          customer: { first_name: string; last_name: string }
        })[]
      )

      // Technician performance
      const techs = (techsRes.data ?? []) as User[]
      const perfData: TechPerformance[] = []
      for (const tech of techs) {
        const { count } = await supabase
          .from('service_visits')
          .select('id', { count: 'exact', head: true })
          .eq('technician_id', tech.id)
          .eq('status', 'completed')

        const { data: visits } = await supabase
          .from('service_visits')
          .select('arrived_at, departed_at')
          .eq('technician_id', tech.id)
          .eq('status', 'completed')
          .not('arrived_at', 'is', null)
          .not('departed_at', 'is', null)
          .limit(50)

        let totalMin = 0
        let counted = 0
        for (const v of visits ?? []) {
          if (v.arrived_at && v.departed_at) {
            totalMin +=
              (new Date(v.departed_at).getTime() - new Date(v.arrived_at).getTime()) / 60000
            counted++
          }
        }

        perfData.push({
          name: tech.full_name,
          completedVisits: count ?? 0,
          avgMinutes: counted > 0 ? Math.round(totalMin / counted) : 0,
        })
      }
      setTechPerformance(perfData)

      // Revenue — simple MRR from active customers
      const customers = custRes.data ?? []
      const totalMrr = customers.reduce(
        (sum: number, c: { monthly_rate: string | number | null }) =>
          sum + (c.monthly_rate ? Number(c.monthly_rate) : 0),
        0
      )
      setCustomerCount(customers.length)
      setMrr(totalMrr)

      // Build 6-month revenue projection
      const now = new Date()
      const months: RevenueMonth[] = []
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        months.push({
          month: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
          revenue: totalMrr,
        })
      }
      setRevenueData(months)

      setLoading(false)
    }

    fetchAll()
  }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-72" />
          ))}
        </div>
      </div>
    )
  }

  const conditionVariant: Record<string, 'green' | 'amber' | 'red' | 'gray'> = {
    good: 'green',
    fair: 'amber',
    poor: 'red',
    needs_replacement: 'red',
  }

  const conditionCounts = equipment.reduce(
    (acc: Record<string, number>, eq) => {
      acc[eq.condition] = (acc[eq.condition] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  const pieData = Object.entries(conditionCounts).map(([name, value]) => ({
    name: name.replace(/_/g, ' '),
    value,
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-sand-900">Reports</h1>
        <p className="text-sm text-sand-500">Analytics and performance metrics</p>
      </div>

      {/* Revenue Summary */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="p-5 text-center">
          <p className="text-sm text-sand-500">Active Customers</p>
          <p className="text-3xl font-bold text-sand-900">{customerCount}</p>
        </Card>
        <Card className="p-5 text-center">
          <p className="text-sm text-sand-500">Monthly Recurring Revenue</p>
          <p className="text-3xl font-bold text-aqua-600">{formatCurrency(mrr)}</p>
        </Card>
        <Card className="p-5 text-center">
          <p className="text-sm text-sand-500">Annual Projection</p>
          <p className="text-3xl font-bold text-sand-900">{formatCurrency(mrr * 12)}</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Revenue Trend */}
        <Card>
          <CardTitle>Revenue Trend (MRR)</CardTitle>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#0891B2"
                  strokeWidth={2}
                  dot={{ fill: '#0891B2' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Chemical Usage */}
        <Card>
          <CardTitle>Chemical Usage Summary</CardTitle>
          <CardContent>
            {chemicalData.length === 0 ? (
              <p className="py-8 text-center text-sm text-sand-400">No chemical data recorded</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chemicalData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e0" />
                  <XAxis dataKey="chemical_name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(value, _name, props) => {
                      const payload = props.payload as unknown as ChemicalSummary
                      return `${value} ${payload.unit}`
                    }}
                  />
                  <Bar dataKey="total_amount" fill="#0891B2" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Equipment Condition */}
        <Card>
          <CardTitle>Equipment Condition Overview</CardTitle>
          <CardContent>
            {pieData.length === 0 ? (
              <p className="py-8 text-center text-sm text-sand-400">No equipment data</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, value }) => `${name ?? ''}: ${value}`}
                  >
                    {pieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Technician Performance */}
        <Card>
          <CardTitle>Technician Performance</CardTitle>
          <CardContent>
            {techPerformance.length === 0 ? (
              <p className="py-8 text-center text-sm text-sand-400">No technician data</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={techPerformance} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e0" />
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 11 }}
                    width={100}
                  />
                  <Tooltip />
                  <Bar dataKey="completedVisits" name="Completed Visits" fill="#0891B2" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="avgMinutes" name="Avg Minutes" fill="#D97706" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Equipment Detail Table */}
      <Card>
        <CardTitle>Equipment Inventory</CardTitle>
        <CardContent>
          {equipment.length === 0 ? (
            <p className="text-sm text-sand-400">No equipment recorded</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-sand-200 text-left">
                    <th className="pb-2 font-medium text-sand-600">Customer</th>
                    <th className="pb-2 font-medium text-sand-600">Type</th>
                    <th className="pb-2 font-medium text-sand-600">Brand / Model</th>
                    <th className="pb-2 font-medium text-sand-600">Condition</th>
                    <th className="pb-2 font-medium text-sand-600">Install Date</th>
                    <th className="pb-2 font-medium text-sand-600">Warranty</th>
                  </tr>
                </thead>
                <tbody>
                  {equipment.map((eq) => {
                    const cust = (eq as unknown as { customer: { first_name: string; last_name: string } }).customer
                    return (
                      <tr key={eq.id} className="border-b border-sand-50">
                        <td className="py-2">
                          {cust ? `${cust.first_name} ${cust.last_name}` : '—'}
                        </td>
                        <td className="py-2 capitalize">{eq.equipment_type.replace(/_/g, ' ')}</td>
                        <td className="py-2">{[eq.brand, eq.model].filter(Boolean).join(' ') || '—'}</td>
                        <td className="py-2">
                          <Badge variant={conditionVariant[eq.condition] ?? 'gray'}>
                            {eq.condition.replace(/_/g, ' ')}
                          </Badge>
                        </td>
                        <td className="py-2">{eq.install_date ? formatDate(eq.install_date) : '—'}</td>
                        <td className="py-2">{eq.warranty_expiry ? formatDate(eq.warranty_expiry) : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
