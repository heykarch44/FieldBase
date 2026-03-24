'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Settings, User, Shield, Bell, Layers } from 'lucide-react'

interface UserProfile {
  id: string
  full_name: string
  email: string
  phone: string | null
  role: string
}

export default function SettingsPage() {
  const router = useRouter()
  const [user, setUser] = useState<UserProfile | null>(null)

  useEffect(() => {
    async function fetchUser() {
      const supabase = createClient()
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser()
      if (authUser) {
        // Get user profile
        const { data: userData } = await supabase
          .from('users')
          .select('id, full_name, email, phone')
          .eq('id', authUser.id)
          .single()

        // Get org role from org_members
        const { data: memberData } = await supabase
          .from('org_members')
          .select('role')
          .eq('user_id', authUser.id)
          .limit(1)
          .maybeSingle()

        if (userData) {
          setUser({
            ...userData,
            role: memberData?.role ?? 'viewer',
          })
        }
      }
    }
    fetchUser()
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-sand-900">Settings</h1>
        <p className="text-sm text-sand-500">Manage your account and preferences</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Profile */}
        <Card>
          <CardTitle>
            <User className="inline h-4 w-4 mr-2" />
            Profile
          </CardTitle>
          <CardContent>
            {user ? (
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-sand-500">Name</p>
                  <p className="font-medium text-sand-900">{user.full_name}</p>
                </div>
                <div>
                  <p className="text-sand-500">Email</p>
                  <p className="font-medium text-sand-900">{user.email}</p>
                </div>
                <div>
                  <p className="text-sand-500">Role</p>
                  <Badge variant="aqua">{user.role}</Badge>
                </div>
                {user.phone && (
                  <div>
                    <p className="text-sand-500">Phone</p>
                    <p className="font-medium text-sand-900">{user.phone}</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-sand-400">Loading profile...</p>
            )}
          </CardContent>
        </Card>

        {/* Field Definitions */}
        <Card>
          <CardTitle>
            <Layers className="inline h-4 w-4 mr-2" />
            Field Definitions
          </CardTitle>
          <CardContent>
            <div className="space-y-4 text-sm">
              <p className="text-sand-600">
                Configure custom fields for visits, jobsites, and other entities.
                Define industry-specific data capture templates.
              </p>
              <Button onClick={() => router.push('/dashboard/settings/fields')}>
                Manage Fields
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Security */}
        <Card>
          <CardTitle>
            <Shield className="inline h-4 w-4 mr-2" />
            Security
          </CardTitle>
          <CardContent>
            <div className="space-y-4 text-sm">
              <p className="text-sand-600">
                Password management and two-factor authentication are handled through
                Supabase Auth. Contact your administrator for account changes.
              </p>
              <Button variant="secondary" disabled>
                Change Password
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardTitle>
            <Bell className="inline h-4 w-4 mr-2" />
            Notifications
          </CardTitle>
          <CardContent>
            <div className="space-y-3 text-sm text-sand-600">
              <p>Notification preferences coming soon.</p>
              <div className="rounded-lg bg-sand-50 p-3">
                <p className="text-xs text-sand-500">
                  Email notifications for service orders, schedule changes, and
                  jobsite updates will be configurable here in a future release.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* System Info */}
        <Card>
          <CardTitle>
            <Settings className="inline h-4 w-4 mr-2" />
            System
          </CardTitle>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-sand-500">Version</span>
                <span className="font-medium text-sand-900">1.0.0</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sand-500">Framework</span>
                <span className="font-medium text-sand-900">Next.js 16</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sand-500">Database</span>
                <span className="font-medium text-sand-900">Supabase (PostgreSQL)</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
