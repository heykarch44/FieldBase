'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { Skeleton } from '@/components/ui/skeleton'
import { UserPlus, Mail, Shield, Trash2, Loader2, CheckCircle, Copy, Eye, EyeOff } from 'lucide-react'
import type { OrgMember, OrgInvite, User, UserRole } from '@/lib/types'

const ROLE_LABELS: Record<UserRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  manager: 'Manager',
  technician: 'Technician',
  viewer: 'Viewer',
}

const ROLE_COLORS: Record<UserRole, string> = {
  owner: 'bg-purple-50 text-purple-700',
  admin: 'bg-red-50 text-red-700',
  manager: 'bg-blue-50 text-blue-700',
  technician: 'bg-emerald-50 text-emerald-700',
  viewer: 'bg-sand-100 text-sand-600',
}

export default function TeamPage() {
  const [members, setMembers] = useState<(OrgMember & { user: User })[]>([])
  const [invites, setInvites] = useState<OrgInvite[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)

  useEffect(() => {
    fetchTeam()
  }, [])

  async function fetchTeam() {
    const supabase = createClient()

    const [membersRes, invitesRes] = await Promise.all([
      supabase
        .from('org_members')
        .select('*, user:users(*)')
        .order('joined_at'),
      supabase
        .from('org_invites')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false }),
    ])

    setMembers((membersRes.data as (OrgMember & { user: User })[]) ?? [])
    setInvites((invitesRes.data as OrgInvite[]) ?? [])
    setLoading(false)
  }

  async function handleRevokeInvite(inviteId: string) {
    const supabase = createClient()
    await supabase
      .from('org_invites')
      .update({ status: 'revoked' })
      .eq('id', inviteId)
    setInvites((prev) => prev.filter((i) => i.id !== inviteId))
  }

  async function handleRemoveMember(memberId: string) {
    const supabase = createClient()
    await supabase.from('org_members').delete().eq('id', memberId)
    setMembers((prev) => prev.filter((m) => m.id !== memberId))
  }

  async function handleRoleChange(memberId: string, newRole: UserRole) {
    const supabase = createClient()
    await supabase
      .from('org_members')
      .update({ role: newRole })
      .eq('id', memberId)
    setMembers((prev) =>
      prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m))
    )
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="font-display text-2xl font-bold text-sand-900">Team</h1>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-sand-900">Team</h1>
          <p className="text-sm text-sand-500">
            {members.length} members &middot; {invites.length} pending invites
          </p>
        </div>
        <Button onClick={() => setShowAddModal(true)}>
          <UserPlus className="h-4 w-4" />
          Add Member
        </Button>
      </div>

      <Card>
        <CardTitle>Members</CardTitle>
        <div className="space-y-2">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between rounded-lg border border-sand-100 p-3"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-50 text-sm font-bold text-teal-600">
                  {member.user?.full_name?.charAt(0) ?? '?'}
                </div>
                <div>
                  <p className="font-medium text-sand-900">
                    {member.user?.full_name ?? 'Unknown'}
                  </p>
                  <p className="text-xs text-sand-400">{member.user?.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <select
                  value={member.role}
                  onChange={(e) =>
                    handleRoleChange(member.id, e.target.value as UserRole)
                  }
                  className="rounded-md border border-sand-200 px-2 py-1 text-sm text-sand-700"
                  disabled={member.role === 'owner'}
                >
                  {Object.entries(ROLE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
                {member.role !== 'owner' && (
                  <button
                    onClick={() => handleRemoveMember(member.id)}
                    className="rounded-md p-1.5 text-sand-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {invites.length > 0 && (
        <Card>
          <CardTitle>Pending Invites</CardTitle>
          <div className="space-y-2">
            {invites.map((invite) => (
              <div
                key={invite.id}
                className="flex items-center justify-between rounded-lg border border-sand-100 p-3"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-50">
                    <Mail className="h-4 w-4 text-amber-600" />
                  </div>
                  <div>
                    <p className="font-medium text-sand-900">{invite.email}</p>
                    <div className="flex items-center gap-2 text-xs text-sand-400">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${ROLE_COLORS[invite.role]}`}>
                        {ROLE_LABELS[invite.role]}
                      </span>
                      <span>Expires {new Date(invite.expires_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleRevokeInvite(invite.id)}
                >
                  Revoke
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Modal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add Team Member"
        className="max-w-md"
      >
        <AddMemberForm
          onSuccess={() => {
            setShowAddModal(false)
            fetchTeam()
          }}
          onCancel={() => setShowAddModal(false)}
        />
      </Modal>
    </div>
  )
}

function AddMemberForm({
  onSuccess,
  onCancel,
}: {
  onSuccess: () => void
  onCancel: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ message: string; tempPassword: string } | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [copied, setCopied] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const form = new FormData(e.currentTarget)
    const tempPassword = form.get('temp_password') as string || generatePassword()

    const res = await fetch('/api/team/create-member', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: form.get('email') as string,
        full_name: form.get('full_name') as string,
        role: form.get('role') as string,
        temp_password: tempPassword,
      }),
    })

    const data = await res.json()
    setSaving(false)

    if (!res.ok) {
      setError(data.error || 'Something went wrong')
    } else {
      setResult({ message: data.message, tempPassword: tempPassword })
    }
  }

  function handleCopy() {
    if (!result) return
    navigator.clipboard.writeText(result.tempPassword)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (result) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg bg-emerald-50 p-4">
          <div className="flex items-center gap-2 text-emerald-700">
            <CheckCircle className="h-5 w-5" />
            <p className="font-medium">{result.message}</p>
          </div>
        </div>
        <div className="rounded-lg border border-sand-200 p-4">
          <p className="mb-2 text-sm font-medium text-sand-700">Temporary Password</p>
          <p className="mb-1 text-xs text-sand-500">Share this with the team member so they can log in.</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded bg-sand-50 px-3 py-2 font-mono text-sm text-sand-900">
              {showPassword ? result.tempPassword : '••••••••••••'}
            </code>
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="rounded-md p-2 text-sand-400 hover:bg-sand-50 hover:text-sand-600"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={handleCopy}
              className="rounded-md p-2 text-sand-400 hover:bg-sand-50 hover:text-sand-600"
            >
              {copied ? <CheckCircle className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={onSuccess}>Done</Button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}
      <div>
        <label className="mb-1 block text-sm font-medium text-sand-700">Full Name *</label>
        <Input name="full_name" required placeholder="John Smith" />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-sand-700">Email *</label>
        <Input name="email" type="email" required placeholder="john@company.com" />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-sand-700">Role *</label>
        <select
          name="role"
          className="w-full rounded-lg border border-sand-300 bg-white px-3 py-2 text-sm text-sand-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
          defaultValue="technician"
        >
          <option value="admin">Admin</option>
          <option value="manager">Manager</option>
          <option value="technician">Technician</option>
          <option value="viewer">Viewer</option>
        </select>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-sand-700">Temporary Password</label>
        <Input name="temp_password" placeholder="Leave blank to auto-generate" />
        <p className="mt-1 text-xs text-sand-400">They can change it after first login.</p>
      </div>
      <div className="flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={saving}>
          {saving ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Creating...</>
          ) : (
            'Add Member'
          )}
        </Button>
      </div>
    </form>
  )
}

function generatePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$'
  let pw = ''
  for (let i = 0; i < 12; i++) {
    pw += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return pw
}
