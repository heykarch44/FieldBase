'use client'

export const dynamic = 'force-dynamic'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    const hash = window.location.hash

    async function handleAuth() {
      if (hash && hash.includes('access_token')) {
        // Parse the hash tokens manually and set the session
        const params = new URLSearchParams(hash.substring(1))
        const accessToken = params.get('access_token')
        const refreshToken = params.get('refresh_token')

        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })

          if (!error) {
            // Clear the hash from the URL
            window.history.replaceState(null, '', '/')
            router.replace('/dashboard')
            return
          }
        }
      }

      // No hash tokens or session set failed — check existing session
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        router.replace('/dashboard')
      } else {
        router.replace('/login')
      }
    }

    handleAuth()
  }, [router])

  return (
    <div className="flex min-h-screen items-center justify-center bg-sand-50">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-sand-200 border-t-indigo-600" />
    </div>
  )
}
