'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Building, Save } from 'lucide-react'
import type { Organization } from '@/lib/types'

const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Phoenix',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
]

export default function OrgSettingsPage() {
  const [org, setOrg] = useState<Organization | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [timezone, setTimezone] = useState('')
  const [logoUrl, setLogoUrl] = useState('')

  useEffect(() => {
    fetchOrg()
  }, [])

  async function fetchOrg() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: userData } = await supabase
      .from('users')
      .select('active_org_id')
      .eq('id', user.id)
      .single()

    if (!userData?.active_org_id) return

    const { data } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', userData.active_org_id)
      .single()

    if (data) {
      const orgData = data as Organization
      setOrg(orgData)
      setName(orgData.name)
      setTimezone(orgData.timezone)
      setLogoUrl(orgData.logo_url ?? '')
    }
    setLoading(false)
  }

  async function handleSave() {
    if (!org) return
    setSaving(true)

    const supabase = createClient()
    await supabase
      .from('organizations')
      .update({
        name,
        timezone,
        logo_url: logoUrl || null,
      })
      .eq('id', org.id)

    setOrg((prev) => (prev ? { ...prev, name, timezone, logo_url: logoUrl || null } : prev))
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="font-display text-2xl font-bold text-sand-900">Organization</h1>
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!org) {
    return (
      <div className="space-y-6">
        <h1 className="font-display text-2xl font-bold text-sand-900">Organization</h1>
        <Card>
          <p className="py-8 text-center text-sand-500">
            No organization found. Please contact support.
          </p>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-sand-900">Organization</h1>
        <p className="text-sm text-sand-500">
          Manage your organization settings
        </p>
      </div>

      <Card>
        <CardTitle>General</CardTitle>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-sand-700">
              Organization Name
            </label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-sand-700">
              Slug
            </label>
            <Input value={org.slug} disabled className="bg-sand-50" />
            <p className="mt-1 text-xs text-sand-400">Cannot be changed</p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-sand-700">
              Timezone
            </label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full rounded-lg border border-sand-300 px-3 py-2 text-sm"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-sand-700">
              Logo URL
            </label>
            <Input
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>
        </div>
      </Card>

      <Card>
        <CardTitle>Plan</CardTitle>
        <div className="flex items-center gap-3">
          <span className="inline-flex rounded-full bg-indigo-50 px-3 py-1 text-sm font-semibold text-indigo-700 capitalize">
            {org.plan}
          </span>
          <span className="text-sm text-sand-500">
            Template: {org.template_id ?? 'None'}
          </span>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4" />
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  )
}
