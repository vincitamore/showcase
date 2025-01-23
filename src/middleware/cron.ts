import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const isValidCron = authHeader === `Bearer ${process.env.CRON_SECRET}`
  
  if (isValidCron) {
    console.log('[Middleware] Allowing authorized cron request')
    return NextResponse.next()
  }
  
  console.log('[Middleware] Blocked unauthorized cron request')
  return NextResponse.json({ error: 'Unauthorized cron request' }, { status: 401 })
}

export const config = {
  matcher: [
    "/api/cron/:path*",
  ],
} 