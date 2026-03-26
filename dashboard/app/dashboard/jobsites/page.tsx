'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { TableSkeleton } from '@/components/ui/skeleton'
import { MapPin, Plus, Search, Building2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { Jobsite, User } from '@/lib/types'

export default function JobsitesPage() {
  const [jobsites, setJobsites] = useState<Jobsite[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null)
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

    setJobsites((data as Jobsite[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    fetchJobsites()
  }, [])

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
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-sand-500">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((jobsite) => (
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
                </tr>
              ))}
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

    const { error: insertError } = await supabase.from('jobsites').insert({
      org_id: orgId,
      name: form.get('name') as string,
      contact_name: (form.get('contact_name') as string) || null,
      contact_email: (form.get('contact_email') as string) || null,
      contact_phone: (form.get('contact_phone') as string) || null,
      address_line1: form.get('address_line1') as string,
      city: form.get('city') as string,
      state: form.get('state') as string,
      zip: form.get('zip') as string,
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
