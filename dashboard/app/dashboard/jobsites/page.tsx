'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { geocodeAddress } from '@/lib/geocode'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { TableSkeleton } from '@/components/ui/skeleton'
import { MapPin, Plus, Search, Building2, X, Check, ChevronDown, Pencil, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { Jobsite } from '@/lib/types'

interface OrgMember {
  user_id: string
  full_name: string
}

interface AssigneeInfo {
  user_id: string
  full_name: string
}

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

export default function JobsitesPage() {
  const [jobsites, setJobsites] = useState<Jobsite[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null)
  const [assigneesMap, setAssigneesMap] = useState<Record<string, AssigneeInfo[]>>({})
  const [orgMembers, setOrgMembers] = useState<OrgMember[]>([])
  const [editSite, setEditSite] = useState<Jobsite | null>(null)
  const [editAssignedIds, setEditAssignedIds] = useState<string[]>([])
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const router = useRouter()

  async function fetchJobsites() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: userData } = await supabase
      .from('users')
      .select('active_org_id')
      .eq('id', user.id)
      .single()

    if (userData?.active_org_id) setActiveOrgId(userData.active_org_id)

    const { data } = await supabase
      .from('jobsites')
      .select('*')
      .order('name')

    const sites = (data as Jobsite[]) ?? []
    setJobsites(sites)

    // Fetch assignees for all sites
    if (sites.length > 0) {
      const siteIds = sites.map((s) => s.id)
      const { data: assigneesData } = await supabase
        .from('jobsite_assignees')
        .select('jobsite_id, user_id, user:users!jobsite_assignees_user_id_fkey(full_name)')
        .in('jobsite_id', siteIds)

      const map: Record<string, AssigneeInfo[]> = {}
      if (assigneesData) {
        for (const row of assigneesData as { jobsite_id: string; user_id: string; user: { full_name: string } | null }[]) {
          if (!map[row.jobsite_id]) map[row.jobsite_id] = []
          map[row.jobsite_id].push({
            user_id: row.user_id,
            full_name: (row.user as { full_name: string } | null)?.full_name ?? 'Unknown',
          })
        }
      }
      setAssigneesMap(map)
    } else {
      setAssigneesMap({})
    }

    setLoading(false)
  }

  useEffect(() => {
    fetchJobsites()
  }, [])

  async function fetchOrgMembers() {
    if (!activeOrgId) return
    const supabase = createClient()
    const { data: members } = await supabase
      .from('org_members')
      .select('user_id, user:users!org_members_user_id_fkey(full_name)')
      .eq('org_id', activeOrgId)
    if (members) {
      setOrgMembers(
        members.map((m: { user_id: string; user: { full_name: string } | null }) => ({
          user_id: m.user_id,
          full_name: (m.user as { full_name: string } | null)?.full_name ?? 'Unknown',
        }))
      )
    }
  }

  function openEditModal(e: React.MouseEvent, site: Jobsite) {
    e.stopPropagation()
    setEditSite(site)
    setEditError(null)
    const current = assigneesMap[site.id] ?? []
    setEditAssignedIds(current.map((a) => a.user_id))
    fetchOrgMembers()
  }

  async function handleSaveAssignees() {
    if (!editSite) return
    setEditSaving(true)
    setEditError(null)
    const supabase = createClient()

    // Delete existing assignees for this jobsite
    const { error: deleteError } = await supabase
      .from('jobsite_assignees')
      .delete()
      .eq('jobsite_id', editSite.id)

    if (deleteError) {
      setEditSaving(false)
      setEditError(deleteError.message)
      return
    }

    // Insert new
    if (editAssignedIds.length > 0) {
      const rows = editAssignedIds.map((uid) => ({
        jobsite_id: editSite.id,
        user_id: uid,
        org_id: editSite.org_id,
      }))
      const { error: insertError } = await supabase
        .from('jobsite_assignees')
        .insert(rows)

      if (insertError) {
        setEditSaving(false)
        setEditError(insertError.message)
        return
      }
    }

    setEditSaving(false)
    setEditSite(null)
    fetchJobsites()
  }

  const filtered = jobsites.filter(
    (j) =>
      j.name.toLowerCase().includes(search.toLowerCase()) ||
      j.address_line1.toLowerCase().includes(search.toLowerCase()) ||
      j.city.toLowerCase().includes(search.toLowerCase())
  )

  const statusCounts = {
    active: jobsites.filter((j) => j.status === 'active').length,
    inactive: jobsites.filter((j) => j.status === 'inactive').length,
    lead: jobsites.filter((j) => j.status === 'lead').length,
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-sand-900">Sites</h1>
          <p className="text-sm text-sand-500">
            {statusCounts.active} active &middot; {statusCounts.inactive} inactive &middot; {statusCounts.lead} leads
          </p>
        </div>
        <Button onClick={() => setShowAddModal(true)}>
          <Plus className="h-4 w-4" />
          Add Site
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sand-400" />
        <Input
          placeholder="Search sites..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {loading ? (
        <TableSkeleton rows={8} />
      ) : filtered.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center py-12 text-center">
            <Building2 className="mb-3 h-10 w-10 text-sand-300" />
            <p className="text-sand-600 font-medium">No sites found</p>
            <p className="text-sm text-sand-400">Add your first site to get started</p>
          </div>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-xl border border-sand-200 bg-white">
          <table className="w-full">
            <thead>
              <tr className="border-b border-sand-100 bg-sand-50/50">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-sand-500">Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-sand-500">Address</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-sand-500">Contact</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-sand-500">Assigned Techs</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-sand-500">Status</th>
                <th className="w-10 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((jobsite) => {
                const assignees = assigneesMap[jobsite.id] ?? []
                return (
                  <tr
                    key={jobsite.id}
                    onClick={() => router.push(`/dashboard/jobsites/${jobsite.id}`)}
                    className="cursor-pointer border-b border-sand-50 transition-colors hover:bg-teal-50/50"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-50">
                          <MapPin className="h-4 w-4 text-teal-600" />
                        </div>
                        <span className="font-medium text-sand-900">{jobsite.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-sand-600">
                      {jobsite.address_line1}, {jobsite.city} {jobsite.state}
                    </td>
                    <td className="px-4 py-3 text-sm text-sand-600">
                      {jobsite.contact_name ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      {assignees.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {assignees.map((a) => (
                            <span
                              key={a.user_id}
                              className="inline-flex rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700"
                            >
                              {a.full_name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-sm text-sand-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          jobsite.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700'
                            : jobsite.status === 'lead'
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-sand-100 text-sand-600'
                        }`}
                      >
                        {jobsite.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={(e) => openEditModal(e, jobsite)}
                        className="rounded p-1 text-sand-400 hover:bg-sand-100 hover:text-teal-600"
                        title="Edit assigned techs"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add New Site"
        className="max-w-xl"
      >
        <AddJobsiteForm
          orgId={activeOrgId}
          onSuccess={() => {
            setShowAddModal(false)
            fetchJobsites()
          }}
          onCancel={() => setShowAddModal(false)}
        />
      </Modal>

      {editSite && (
        <Modal
          open={!!editSite}
          onClose={() => setEditSite(null)}
          title={`Assign Techs — ${editSite.name}`}
          className="max-w-lg"
        >
          <div className="space-y-4">
            {editError && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{editError}</div>
            )}
            <div>
              <label className="mb-1 block text-sm font-medium text-sand-700">Assigned Techs</label>
              <TechMultiSelect
                members={orgMembers}
                selected={editAssignedIds}
                onChange={setEditAssignedIds}
              />
              <p className="mt-2 text-xs text-sand-500">
                Techs assigned here will see this site on their mobile Sites tab.
              </p>
            </div>
            <div className="flex justify-end gap-3 border-t border-sand-100 pt-4">
              <Button variant="secondary" onClick={() => setEditSite(null)}>
                Cancel
              </Button>
              <Button onClick={handleSaveAssignees} disabled={editSaving}>
                {editSaving ? (
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

function AddJobsiteForm({
  orgId,
  onSuccess,
  onCancel,
}: {
  orgId: string | null
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

    const address_line1 = form.get('address_line1') as string
    const city = form.get('city') as string
    const state = form.get('state') as string
    const zip = form.get('zip') as string

    // Best-effort geocode before insert. Failure is non-fatal.
    let lat: number | null = null
    let lng: number | null = null
    let geocoded_at: string | null = null
    try {
      const coords = await geocodeAddress({ address_line1, city, state, zip })
      if (coords) {
        lat = coords.lat
        lng = coords.lng
        geocoded_at = new Date().toISOString()
      }
    } catch {
      // ignore — user can geocode manually from the site page
    }

    const { error: insertError } = await supabase.from('jobsites').insert({
      org_id: orgId,
      name: form.get('name') as string,
      contact_name: (form.get('contact_name') as string) || null,
      contact_email: (form.get('contact_email') as string) || null,
      contact_phone: (form.get('contact_phone') as string) || null,
      address_line1,
      city,
      state,
      zip,
      lat,
      lng,
      geocoded_at,
      status: 'active',
      access_notes: (form.get('access_notes') as string) || null,
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
        <label className="mb-1 block text-sm font-medium text-sand-700">Site Name *</label>
        <Input name="name" required placeholder="e.g., Smith Residence" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-sand-700">Contact Name</label>
          <Input name="contact_name" placeholder="John Smith" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-sand-700">Contact Phone</label>
          <Input name="contact_phone" placeholder="(555) 123-4567" />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-sand-700">Contact Email</label>
        <Input name="contact_email" type="email" placeholder="john@example.com" />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-sand-700">Address *</label>
        <Input name="address_line1" required placeholder="123 Main St" />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-sand-700">City *</label>
          <Input name="city" required />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-sand-700">State *</label>
          <Input name="state" required defaultValue="AZ" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-sand-700">Zip *</label>
          <Input name="zip" required />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-sand-700">Access Notes</label>
        <textarea
          name="access_notes"
          className="w-full rounded-lg border border-sand-300 px-3 py-2 text-sm"
          rows={2}
          placeholder="Gate code, parking info..."
        />
      </div>
      <div className="flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving...' : 'Add Site'}
        </Button>
      </div>
    </form>
  )
}
