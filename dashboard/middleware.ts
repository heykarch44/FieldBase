import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // If not logged in and trying to access dashboard, redirect to login
  if (!user && pathname.startsWith('/dashboard')) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // If logged in and on login page, redirect to dashboard
  if (user && pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  // ADMIN ROUTE GUARD
  if (pathname.startsWith('/admin')) {
    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }

    const { data: adminProfile } = await supabase
      .from('users')
      .select('is_super_admin')
      .eq('id', user.id)
      .single()

    if (!adminProfile?.is_super_admin) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
    // Super-admin verified — allow access
    return supabaseResponse
  }

  // If not logged in and on waitlist page, redirect to login
  if (!user && pathname === '/waitlist') {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // If logged in and on waitlist page, check if org is now active
  if (user && pathname === '/waitlist') {
    const { data: profile } = await supabase
      .from('users')
      .select('active_org_id')
      .eq('id', user.id)
      .single()

    if (profile?.active_org_id) {
      const { data: org } = await supabase
        .from('organizations')
        .select('status')
        .eq('id', profile.active_org_id)
        .single()

      if (org?.status === 'active') {
        const url = request.nextUrl.clone()
        url.pathname = '/dashboard'
        return NextResponse.redirect(url)
      }
    }
    // Still waitlisted — let them see the page
    return supabaseResponse
  }

  // If logged in and accessing dashboard, verify they belong to an org
  if (user && pathname.startsWith('/dashboard')) {
    const { data: profile } = await supabase
      .from('users')
      .select('active_org_id')
      .eq('id', user.id)
      .single()

    // If user has no active org, check if they belong to any org
    if (!profile?.active_org_id) {
      const { data: membership } = await supabase
        .from('org_members')
        .select('org_id')
        .eq('user_id', user.id)
        .limit(1)
        .single()

      if (!membership) {
        // No org membership at all — send to access denied
        const url = request.nextUrl.clone()
        url.pathname = '/access-denied'
        return NextResponse.redirect(url)
      }

      // Auto-set active_org_id to first org they belong to
      await supabase
        .from('users')
        .update({ active_org_id: membership.org_id })
        .eq('id', user.id)
    }

    // Check their role in the active org — viewer and above can access dashboard
    const activeOrgId = profile?.active_org_id
    if (activeOrgId) {
      const { data: member } = await supabase
        .from('org_members')
        .select('role')
        .eq('user_id', user.id)
        .eq('org_id', activeOrgId)
        .single()

      if (!member) {
        const url = request.nextUrl.clone()
        url.pathname = '/access-denied'
        return NextResponse.redirect(url)
      }

      // Check if org is on waitlist
      const { data: org } = await supabase
        .from('organizations')
        .select('status')
        .eq('id', activeOrgId)
        .single()

      if (org?.status === 'waitlist') {
        const url = request.nextUrl.clone()
        url.pathname = '/waitlist'
        return NextResponse.redirect(url)
      }

      // Technicians can only access limited pages (not settings/admin)
      const adminOnlyPaths = ['/dashboard/settings/fields', '/dashboard/settings/team', '/dashboard/settings/org']
      if (member.role === 'technician' && adminOnlyPaths.some(p => pathname.startsWith(p))) {
        const url = request.nextUrl.clone()
        url.pathname = '/dashboard'
        return NextResponse.redirect(url)
      }
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/dashboard/:path*', '/login', '/waitlist', '/admin/:path*'],
}
