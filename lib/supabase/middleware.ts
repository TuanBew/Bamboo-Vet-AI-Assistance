import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
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

  // Refresh session — do not remove
  const { data: { user } } = await supabase.auth.getUser()

  // --- Admin route guards ---
  const isAdminRoute = request.nextUrl.pathname.startsWith('/admin')
  const isApiAdminRoute = request.nextUrl.pathname.startsWith('/api/admin')

  // Skip API admin routes — those use requireAdmin() in route handlers
  if (!isApiAdminRoute && isAdminRoute) {
    // AUTH-01: Unauthenticated users → /login
    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }

    // AUTH-02: Authenticated non-admin → /login
    try {
      const { createServiceClient } = await import('@/lib/supabase/server')
      const svc = createServiceClient()
      const { data: profile } = await svc
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single()

      if (!profile?.is_admin) {
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        return NextResponse.redirect(url)
      }
    } catch {
      // If profile fetch fails, let request through to avoid infinite redirect
    }
  }

  // Guard /app/* routes
  if (!user && request.nextUrl.pathname.startsWith('/app')) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // AUTH-03: Admin hitting /app → redirect to /admin/dashboard
  if (user && request.nextUrl.pathname.startsWith('/app')) {
    try {
      const { createServiceClient } = await import('@/lib/supabase/server')
      const svc = createServiceClient()
      const { data: profile } = await svc
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single()

      if (profile?.is_admin === true) {
        const url = request.nextUrl.clone()
        url.pathname = '/admin/dashboard'
        return NextResponse.redirect(url)
      }
    } catch {
      // If profile fetch fails, let request through to /app
    }
  }

  // Redirect logged-in users away from auth pages
  if (user && (
    request.nextUrl.pathname === '/login' ||
    request.nextUrl.pathname === '/signup'
  )) {
    try {
      const { createServiceClient } = await import('@/lib/supabase/server')
      const svc = createServiceClient()
      const { data: profile } = await svc
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single()

      const url = request.nextUrl.clone()
      url.pathname = profile?.is_admin === true ? '/admin/dashboard' : '/app'
      return NextResponse.redirect(url)
    } catch {
      // Fallback: redirect to /app if profile fetch fails
      const url = request.nextUrl.clone()
      url.pathname = '/app'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}
