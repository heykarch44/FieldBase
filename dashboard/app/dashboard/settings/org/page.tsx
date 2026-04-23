'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Building, Save, Route, Calendar } from 'lucide-react'
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
  const [routesEnabled, setRoutesEnabled] = useState(true)
  const [clockInLabel, setClockInLabel] = useState('Clocked In')
  const [clockOutLabel, setClockOutLabel] = useState('Clocked Out')

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
      const settings = (orgData.settings ?? {}) as Record<string, unknown>
      setRoutesEnabled(settings.routes_enabled !== false)
      setClockInLabel(
        typeof settings.clock_in_label === 'string' && settings.clock_in_label
          ? (settings.clock_in_label as string)
          : 'Clocked In'
      )
      setClockOutLabel(
        typeof settings.clock_out_label === 'string' && settings.clock_out_label
          ? (settings.clock_out_label as string)
          : 'Clocked Out'
      )
    }
    setLoading(false)
  }

  async function handleSave() {
    if (!org) return
    setSaving(true)

    const supabase = createClient()
    const updatedSettings = {
      ...(org.settings ?? {}),
      routes_enabled: routesEnabled,
      clock_in_label: clockInLabel.trim() || 'Clocked In',
      clock_out_label: clockOutLabel.trim() || 'Clocked Out',
    }
    await supabase
      .from('organizations')
      .update({
        name,
        timezone,
        logo_url: logoUrl || null,
        settings: updatedSettings,
      })
      .eq('id', org.id)

    setOrg((prev) => (prev ? { ...prev, name, timezone, logo_url: logoUrl || null, settings: updatedSettings } : prev))
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
        <CardTitle>Workflow</CardTitle>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <label className="text-sm font-medium text-sand-700">
                Technician Scheduling Mode
              </label>
              <p className="text-xs text-sand-500">
                Choose how technicians see their daily work in the mobile app
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setRoutesEnabled(true)}
              className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-colors ${
                routesEnabled
                  ? 'border-teal-600 bg-teal-50 text-teal-700'
                  : 'border-sand-200 bg-white text-sand-500 hover:border-sand-300'
              }`}
            >
              <Route className="h-6 w-6" />
              <span className="text-sm font-semibold">Routes</span>
              <span className="text-xs text-center">
                Daily route list with ordered stops
              </span>
            </button>
            <button
              type="button"
              onClick={() => setRoutesEnabled(false)}
              className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-colors ${
                !routesEnabled
                  ? 'border-teal-600 bg-teal-50 text-teal-700'
                  : 'border-sand-200 bg-white text-sand-500 hover:border-sand-300'
              }`}
            >
              <Calendar className="h-6 w-6" />
              <span className="text-sm font-semibold">Schedule</span>
              <span className="text-xs text-center">
                Appointments &amp; multi-day projects
              </span>
            </button>
          </div>
        </div>
      </Card>

      <Card>
        <CardTitle>Time Clock Notifications</CardTitle>
        <div className="space-y-4">
          <p className="text-sm text-sand-500">
            These labels are used in the mobile push notification that fires
            the moment a technician’s phone registers a clock-in or clock-out
            at a site.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-sand-700">
                Clock-in notification title
              </label>
              <Input
                value={clockInLabel}
                onChange={(e) => setClockInLabel(e.target.value)}
                maxLength={40}
                placeholder="Clocked In"
              />
              <p className="mt-1 text-xs text-sand-400">
                e.g. “On Site”, “Service Site In”, “Started Shift”
              </p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-sand-700">
                Clock-out notification title
              </label>
              <Input
                value={clockOutLabel}
                onChange={(e) => setClockOutLabel(e.target.value)}
                maxLength={40}
                placeholder="Clocked Out"
              />
              <p className="mt-1 text-xs text-sand-400">
                e.g. “Off Site”, “Service Site Out”, “Ended Shift”
              </p>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <CardTitle>Plan</CardTitle>
        <div className="flex items-center gap-3">
          <span className="inline-flex rounded-full bg-teal-50 px-3 py-1 text-sm font-semibold text-teal-700 capitalize">
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
