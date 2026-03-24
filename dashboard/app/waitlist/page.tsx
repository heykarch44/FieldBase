'use client'

export const dynamic = 'force-dynamic'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Clock } from 'lucide-react'

export default function WaitlistPage() {
  const router = useRouter()
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-sand-50 px-4">
      <div className="text-center max-w-md">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-teal-100">
          <Clock className="h-8 w-8 text-teal-600" />
        </div>
        <h1 className="font-display text-2xl font-bold text-sand-900">
          You&apos;re on the list.
        </h1>
        <p className="mt-3 text-sm text-sand-500 leading-relaxed">
          Your FieldIQ account is set up and ready. We&apos;re rolling out
          early access in waves — we&apos;ll email you as soon as your
          account is activated.
        </p>
        <div className="mt-8 rounded-xl border border-sand-200 bg-white p-4 text-left">
          <p className="text-xs font-semibold uppercase tracking-wide text-sand-400 mb-2">
            While you wait
          </p>
          <ul className="space-y-2 text-sm text-sand-600">
            <li className="flex items-start gap-2">
              <span className="text-teal-500 mt-0.5">✓</span>
              Your company and team template are ready
            </li>
            <li className="flex items-start gap-2">
              <span className="text-teal-500 mt-0.5">✓</span>
              Bookmark <strong>wrk.fldiq.com</strong> — that&apos;s your dashboard
            </li>
            <li className="flex items-start gap-2">
              <span className="text-teal-500 mt-0.5">✓</span>
              You can invite team members once activated
            </li>
          </ul>
        </div>
        <Button onClick={handleSignOut} variant="secondary" className="mt-6">
          Sign out
        </Button>
      </div>
    </div>
  )
}
