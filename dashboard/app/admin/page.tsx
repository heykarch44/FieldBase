'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback, Fragment } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Building2,
  Users,
  Clock,
  CheckCircle2,
  XCircle,
  Search,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import type { OrgStatus } from '@/lib/types'

interface OrgRow {
  id: string
  name: string
  slug: string
  template_id: string | null
  plan: string
  status: OrgStatus
  created_at: string
  member_count: number
  owner_email: string | null
  owner_name: string | null
}

const STATUS_CONFIG: Record<OrgStatus, { label: string; variant: 'teal' | 'amber' | 'red' | 'green' }> = {
  active: { label: 'Active', variant: 'green' },
  waitlist: { label: 'Waitlist', variant: 'amber' },
  suspended: { label: 'Suspended', variant: 'red' },
}

const TEMPLATE_LABELS: Record<string, string> = {
  pool_cleaning: 'Pool Service',
  hood_cleaning: 'Hood Cleaning',
  cabinet_installation: 'Cabinet / Millwork',
  hvac: 'HVAC',
  pest_control: 'Pest Control',
  duct_cleaning: 'Duct Cleaning',
  blank: 'Custom',
}

export default function AdminPage() {
  const supabase = createClient()
  const [orgs, setOrgs] = useState<OrgRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | OrgStatus>('all')
  const [search, setSearch] = useState('')
  const [updating, setUpdating] = useState<string | null>(null)
  const [expandedOrg, setExpandedOrg] = useState<string | null>(null)
  const [orgMembers, setOrgMembers] = useState<Record<string, { email: string; full_name: string; role: string }[]>>({})

  const fetchOrgs = useCallback(async () => {
    // Fetch all organizations
    const { data: orgData } = await supabase
      .from('organizations')
      .select('id, name, slug, template_id, plan, status, created_at')
      .order('created_at', { ascending: false })

    if (!orgData) return

    // Fetch member counts and owner info for each org
    const { data: members } = await supabase
      .from('org_members')
      .select('org_id, user_id, role, users:user_id(email, full_name)')

    const enriched: OrgRow[] = orgData.map((org) => {
      const orgMembers = (members || []).filter((m) => m.org_id === org.id)
      const owner = orgMembers.find((m) => m.role === 'owner')
      const userData = owner?.users as unknown as { email: string; full_name: string } | null

      return {
        ...org,
        status: org.status as OrgStatus,
        member_count: orgMembers.length,
        owner_email: userData?.email || null,
        owner_name: userData?.full_name || null,
      }
    })

    setOrgs(enriched)
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchOrgs()
  }, [fetchOrgs])

  async function updateOrgStatus(orgId: string, newStatus: OrgStatus) {
    setUpdating(orgId)
    await supabase
      .from('organizations')
      .update({ status: newStatus })
      .eq('id', orgId)
    await fetchOrgs()
    setUpdating(null)
  }

  async function toggleExpand(orgId: string) {
    if (expandedOrg === orgId) {
      setExpandedOrg(null)
      return
    }
    setExpandedOrg(orgId)

    if (!orgMembers[orgId]) {
      const { data } = await supabase
        .from('org_members')
        .select('role, users:user_id(email, full_name)')
        .eq('org_id', orgId)

      if (data) {
        setOrgMembers((prev) => ({
          ...prev,
          [orgId]: data.map((m) => {
            const u = m.users as unknown as { email: string; full_name: string }
            return { email: u?.email || '', full_name: u?.full_name || '', role: m.role }
          }),
        }))
      }
    }
  }

  const filtered = orgs.filter((org) => {
    if (filter !== 'all' && org.status !== filter) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        org.name.toLowerCase().includes(q) ||
        org.slug.toLowerCase().includes(q) ||
        org.owner_email?.toLowerCase().includes(q) ||
        org.owner_name?.toLowerCase().includes(q)
      )
    }
    return true
  })

  const counts = {
    total: orgs.length,
    active: orgs.filter((o) => o.status === 'active').length,
    waitlist: orgs.filter((o) => o.status === 'waitlist').length,
    suspended: orgs.filter((o) => o.status === 'suspended').length,
    totalUsers: orgs.reduce((acc, o) => acc + o.member_count, 0),
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-sand-300 border-t-teal-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-sand-900">Companies</h1>
        <p className="mt-1 text-sm text-sand-500">
          Manage all FieldIQ organizations, approve early access, and monitor usage.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card className="flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-100">
            <Building2 className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-sand-900">{counts.total}</p>
            <p className="text-xs text-sand-500">Total Companies</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-sand-900">{counts.active}</p>
            <p className="text-xs text-sand-500">Active</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100">
            <Clock className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-sand-900">{counts.waitlist}</p>
            <p className="text-xs text-sand-500">Waitlist</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-100">
            <Users className="h-5 w-5 text-teal-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-sand-900">{counts.totalUsers}</p>
            <p className="text-xs text-sand-500">Total Users</p>
          </div>
        </Card>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1.5">
          {(['all', 'waitlist', 'active', 'suspended'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                filter === f
                  ? 'bg-sand-900 text-white'
                  : 'bg-sand-100 text-sand-600 hover:bg-sand-200'
              }`}
            >
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
              {f === 'waitlist' && counts.waitlist > 0 && (
                <span className="ml-1 rounded-full bg-amber-500 px-1.5 text-[10px] text-white">
                  {counts.waitlist}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sand-400" />
          <input
            type="text"
            placeholder="Search companies..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-lg border border-sand-200 bg-white py-2 pl-9 pr-4 text-sm text-sand-900 placeholder:text-sand-400 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
        </div>
      </div>

      {/* Company Table */}
      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-sand-100 bg-sand-50/50 text-left">
                <th className="px-4 py-3 font-medium text-sand-500">Company</th>
                <th className="px-4 py-3 font-medium text-sand-500">Trade</th>
                <th className="px-4 py-3 font-medium text-sand-500">Status</th>
                <th className="px-4 py-3 font-medium text-sand-500">Plan</th>
                <th className="px-4 py-3 font-medium text-sand-500 text-center">Users</th>
                <th className="px-4 py-3 font-medium text-sand-500">Signed Up</th>
                <th className="px-4 py-3 font-medium text-sand-500 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-100">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sand-400">
                    No companies found.
                  </td>
                </tr>
              )}
              {filtered.map((org) => {
                const statusCfg = STATUS_CONFIG[org.status]
                const isExpanded = expandedOrg === org.id
                return (
                  <Fragment key={org.id}>
                    <tr
                      className="cursor-pointer hover:bg-sand-50 transition-colors"
                      onClick={() => toggleExpand(org.id)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-sand-400 shrink-0" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-sand-400 shrink-0" />
                          )}
                          <div>
                            <p className="font-medium text-sand-900">{org.name}</p>
                            <p className="text-xs text-sand-400">
                              {org.owner_name || org.owner_email || org.slug}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sand-600">
                        {TEMPLATE_LABELS[org.template_id || ''] || org.template_id || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <span className="capitalize text-sand-600">{org.plan}</span>
                      </td>
                      <td className="px-4 py-3 text-center text-sand-600">{org.member_count}</td>
                      <td className="px-4 py-3 text-sand-500">
                        {new Date(org.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {org.status === 'waitlist' && (
                            <Button
                              size="sm"
                              onClick={() => updateOrgStatus(org.id, 'active')}
                              disabled={updating === org.id}
                            >
                              {updating === org.id ? '...' : 'Activate'}
                            </Button>
                          )}
                          {org.status === 'active' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => updateOrgStatus(org.id, 'suspended')}
                              disabled={updating === org.id}
                            >
                              Suspend
                            </Button>
                          )}
                          {org.status === 'suspended' && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => updateOrgStatus(org.id, 'active')}
                              disabled={updating === org.id}
                            >
                              Reactivate
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={7} className="bg-sand-50/50 px-4 py-4">
                          <div className="ml-6 space-y-3">
                            <div className="flex gap-8 text-xs text-sand-500">
                              <span>
                                <strong className="text-sand-700">Slug:</strong> {org.slug}
                              </span>
                              <span>
                                <strong className="text-sand-700">ID:</strong>{' '}
                                <code className="rounded bg-sand-100 px-1 py-0.5 font-mono text-[11px]">
                                  {org.id}
                                </code>
                              </span>
                            </div>
                            <div>
                              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-sand-400">
                                Members
                              </p>
                              {orgMembers[org.id] ? (
                                <div className="space-y-1">
                                  {orgMembers[org.id].map((m, i) => (
                                    <div
                                      key={i}
                                      className="flex items-center gap-3 text-sm text-sand-600"
                                    >
                                      <span className="w-40 truncate font-medium text-sand-900">
                                        {m.full_name}
                                      </span>
                                      <span className="w-48 truncate">{m.email}</span>
                                      <Badge
                                        variant={m.role === 'owner' ? 'teal' : 'gray'}
                                      >
                                        {m.role}
                                      </Badge>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-xs text-sand-400">Loading...</p>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
          </table>
        </div>
      </Card>
    </div>
  )
}
