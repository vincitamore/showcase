import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// List of allowed domains
const allowedDomains = [
  'amore.build',
  'localhost:3000', // For local development
]

export async function middleware(request: NextRequest) {
  try {
    // Check if this is a cron request
    const isCronRequest = request.nextUrl.pathname === '/api/cron/fetch-tweets'
    if (isCronRequest) {
      const authHeader = request.headers.get('authorization')
      const isValidCron = authHeader === `Bearer ${process.env.CRON_SECRET}`
      
      if (isValidCron) {
        console.log('[Middleware] Allowing authorized cron request')
        return NextResponse.next()
      }
      
      console.log('[Middleware] Blocked unauthorized cron request')
      return NextResponse.json({ error: 'Unauthorized cron request' }, { status: 401 })
    }

    // For non-cron requests, check domain
    const hostname = request.headers.get('host') || ''
    const domain = hostname.split(':')[0] // Remove port if present
    
    if (!allowedDomains.includes(domain)) {
      console.log(`[Middleware] Blocked request from unauthorized domain: ${domain}`)
      return NextResponse.json({ error: 'Unauthorized domain' }, { status: 403 })
    }

    const response = NextResponse.next()

    // Add headers to help with CORS and caching
    response.headers.set(
      'Access-Control-Allow-Origin', 
      process.env.NODE_ENV === 'production' 
        ? 'https://amore.build' 
        : 'http://localhost:3000'
    )
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')

    return response
  } catch (error) {
    console.error('[Middleware] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Configure which paths the middleware runs on
export const config = {
  matcher: [
    '/api/:path*',
  ],
} 
