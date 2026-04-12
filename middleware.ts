import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match admin page routes and admin API routes.
     * Explicitly exclude:
     *   - /api/chat and /api/chat/*
     *   - /api/conversations/*
     *   - Next.js internals (_next/static, _next/image, favicon.ico)
     */
    '/admin/:path*',
    '/api/admin/:path*',
    '/app/:path*',
    '/login',
    '/signup',
  ],
}
