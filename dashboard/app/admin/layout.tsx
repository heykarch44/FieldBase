'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Shield, LogOut, LayoutDashboard } from 'lucide-react'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-sand-50">
      {/* Admin top bar */}
      <header className="sticky top-0 z-40 border-b border-sand-200 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600">
              <Shield className="h-4 w-4 text-white" />
            </div>
            <div>
              <span className="font-display text-sm font-bold text-sand-900">FieldIQ</span>
              <span className="ml-2 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-700">
                Admin
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push('/dashboard')}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-sand-600 hover:bg-sand-100 hover:text-sand-900 transition-colors"
            >
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </button>
            <button
              onClick={handleSignOut}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-sand-600 hover:bg-sand-100 hover:text-sand-900 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  )
}
