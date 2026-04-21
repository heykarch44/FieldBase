'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MessageSquare, Loader2, Trash2, Mic } from 'lucide-react'
import type { SiteNote } from '@/lib/types'

function formatRelative(dateStr: string): string {
  const d = new Date(dateStr)
  const diffMs = Date.now() - d.getTime()
  const sec = Math.floor(diffMs / 1000)
  if (sec < 60) return 'just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}d ago`
  return d.toLocaleDateString()
}

function initials(name: string | null | undefined, email?: string): string {
  const src = name?.trim() || email?.trim() || '?'
  const parts = src.split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return src.slice(0, 2).toUpperCase()
}

interface NotesPanelProps {
  orgId: string | null
  jobsiteId: string
  serviceOrderId?: string | null
  currentUserId: string | null
  canManage?: boolean
  title?: string
}

export function NotesPanel({
  orgId,
  jobsiteId,
  serviceOrderId,
  currentUserId,
  canManage = false,
  title = 'Notes',
}: NotesPanelProps) {
  const [notes, setNotes] = useState<SiteNote[]>([])
  const [loading, setLoading] = useState(true)
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fetchNotes = useCallback(async () => {
    if (!jobsiteId) return
    setLoading(true)
    const supabase = createClient()
    let query = supabase
      .from('site_notes')
      .select('*, author:users!site_notes_author_id_fkey(id, full_name, email)')
      .eq('jobsite_id', jobsiteId)
      .order('created_at', { ascending: false })
    if (serviceOrderId) {
      query = query.eq('service_order_id', serviceOrderId)
    }
    const { data, error: fetchErr } = await query
    if (fetchErr) {
      setError(fetchErr.message)
    } else {
      setNotes((data ?? []) as SiteNote[])
      setError(null)
    }
    setLoading(false)
  }, [jobsiteId, serviceOrderId])

  useEffect(() => {
    fetchNotes()
  }, [fetchNotes])

  async function handleAdd() {
    const trimmed = body.trim()
    if (!trimmed || submitting) return
    if (!orgId || !currentUserId) {
      setError('Not authenticated')
      return
    }
    setSubmitting(true)
    setError(null)
    const supabase = createClient()
    const { error: insertErr } = await supabase.from('site_notes').insert({
      org_id: orgId,
      jobsite_id: jobsiteId,
      service_order_id: serviceOrderId ?? null,
      author_id: currentUserId,
      body: trimmed,
    })
    setSubmitting(false)
    if (insertErr) {
      setError(insertErr.message)
      return
    }
    setBody('')
    fetchNotes()
  }

  async function handleDelete(note: SiteNote) {
    if (!confirm('Delete this note? This cannot be undone.')) return
    setDeletingId(note.id)
    const supabase = createClient()
    const { error: delErr } = await supabase
      .from('site_notes')
      .delete()
      .eq('id', note.id)
    setDeletingId(null)
    if (delErr) {
      setError(delErr.message)
      return
    }
    fetchNotes()
  }

  function canDelete(note: SiteNote): boolean {
    return canManage || note.author_id === currentUserId
  }

  return (
    <Card>
      <CardTitle>
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-teal-500" />
          {title}
          <span className="ml-1 rounded-full bg-sand-100 px-2 py-0.5 text-xs font-medium text-sand-600">
            {notes.length}
          </span>
        </div>
      </CardTitle>

      <div className="mt-4 space-y-3">
        {/* Input */}
        <div className="rounded-lg border border-sand-200 bg-white p-3">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Add a note..."
            rows={3}
            disabled={submitting}
            className="w-full resize-y rounded-md border-0 bg-transparent p-0 text-sm text-sand-900 placeholder:text-sand-400 focus:outline-none focus:ring-0"
          />
          <div className="mt-2 flex items-center justify-between gap-2 border-t border-sand-100 pt-2">
            <div className="flex items-center gap-1.5 text-xs text-sand-500">
              <Mic className="h-3.5 w-3.5" />
              Log-style, timestamped entries
            </div>
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={!body.trim() || submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                'Add Note'
              )}
            </Button>
          </div>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* List */}
        {loading && notes.length === 0 ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-teal-600" />
          </div>
        ) : notes.length === 0 ? (
          <div className="rounded-lg border border-dashed border-sand-200 bg-sand-50/30 py-8 text-center">
            <MessageSquare className="mx-auto h-7 w-7 text-sand-300" />
            <p className="mt-2 text-sm text-sand-500">No notes yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notes.map((note) => {
              const displayName =
                note.author?.full_name || note.author?.email || 'Unknown'
              return (
                <div
                  key={note.id}
                  className="rounded-lg border border-sand-100 bg-white p-3"
                >
                  <div className="mb-1.5 flex items-start gap-2">
                    <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-teal-100 text-xs font-semibold text-teal-700">
                      {initials(note.author?.full_name, note.author?.email)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-medium text-sand-800">
                          {displayName}
                        </p>
                        {canDelete(note) && (
                          <button
                            type="button"
                            onClick={() => handleDelete(note)}
                            disabled={deletingId === note.id}
                            className="text-sand-300 transition-colors hover:text-red-500"
                            aria-label="Delete note"
                          >
                            {deletingId === note.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-sand-400">
                        {formatRelative(note.created_at)}
                      </p>
                    </div>
                  </div>
                  <p className="whitespace-pre-wrap pl-9 text-sm text-sand-700">
                    {note.body}
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Card>
  )
}
