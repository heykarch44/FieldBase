'use client'

export const dynamic = 'force-dynamic'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { ShieldX } from 'lucide-react'

export default function AccessDeniedPage() {
  const router = useRouter()
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-sand-50 px-4">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
          <ShieldX className="h-8 w-8 text-red-600" />
        </div>
        <h1 className="font-display text-2xl font-bold text-sand-900">
          Access Denied
        </h1>
        <p className="mt-2 max-w-sm text-sm text-sand-500">
          Your account does not have permission to access the office dashboard.
          Only admin and office staff can access this area.
        </p>
        <Button onClick={handleSignOut} variant="secondary" className="mt-6">
          Sign out and try a different account
        </Button>
      </div>
    </div>
  )
}
