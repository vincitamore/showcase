import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  
  // Log authentication attempt details (without exposing secrets)
  console.log('[Middleware] Cron request details:', {
    path: request.nextUrl.pathname,
    hasAuthHeader: !!authHeader,
    hasCronSecret: !!cronSecret,
    timestamp: new Date().toISOString()
  })
  
  // Validate both the header and secret exist
  if (!authHeader || !cronSecret) {
    console.log('[Middleware] Missing auth header or CRON_SECRET')
    return NextResponse.json({ error: 'Unauthorized - Missing credentials' }, { status: 403 })
  }
  
  // Validate the auth header format and value
  const isValidCron = authHeader === `Bearer ${cronSecret}`
  
  if (isValidCron) {
    console.log('[Middleware] Allowing authorized cron request')
    return NextResponse.next()
  }
  
  console.log('[Middleware] Invalid authorization token')
  return NextResponse.json({ error: 'Unauthorized - Invalid token' }, { status: 403 })
}

export const config = {
  matcher: [
    "/api/cron/:path*",
  ],
} 