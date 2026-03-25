'use client'

export const dynamic = 'force-dynamic'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()

    // Check if we landed here with auth tokens in the hash (email confirmation redirect)
    const hash = window.location.hash
    if (hash && hash.includes('access_token')) {
      // Supabase client auto-detects hash tokens and sets the session
      supabase.auth.onAuthStateChange((event, session) => {
        if (session) {
          router.replace('/dashboard')
        }
      })
      return
    }

    // No hash tokens — check if already logged in, otherwise go to login
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        router.replace('/dashboard')
      } else {
        router.replace('/login')
      }
    })
  }, [router])

  // Brief loading state while we check auth
  return (
    <div className="flex min-h-screen items-center justify-center bg-sand-50">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-sand-200 border-t-indigo-600" />
    </div>
  )
}
