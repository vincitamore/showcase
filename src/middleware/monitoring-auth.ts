import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { env } from '@/env'

// Paths that require monitoring authentication
const PROTECTED_PATHS = [
  '/monitoring',
  '/api/monitoring'
]

export function isMonitoringPath(pathname: string): boolean {
  return PROTECTED_PATHS.some(path => pathname.startsWith(path))
}

export async function handleMonitoringAuth(req: NextRequest) {
  const session = req.cookies.get('monitoring_session')
  
  // Skip auth for login page and API routes
  if (req.nextUrl.pathname === '/monitoring/login' || 
      req.nextUrl.pathname.startsWith('/api/monitoring')) {
    return NextResponse.next()
  }

  // If no session, redirect to login
  if (!session) {
    const url = new URL('/monitoring/login', req.url)
    url.searchParams.set('from', req.nextUrl.pathname)
    return NextResponse.redirect(url)
  }

  try {
    // Verify session token
    const sessionData = JSON.parse(session.value)
    const isValid = sessionData.expiresAt && new Date(sessionData.expiresAt) > new Date()

    if (!isValid) {
      // Clear invalid session
      const response = NextResponse.redirect(new URL('/monitoring/login', req.url))
      response.cookies.delete('monitoring_session')
      return response
    }

    // Add user info to headers for logging
    const requestHeaders = new Headers(req.headers)
    requestHeaders.set('x-monitoring-user', sessionData.username)

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    })
  } catch (error) {
    // Clear invalid session
    const response = NextResponse.redirect(new URL('/monitoring/login', req.url))
    response.cookies.delete('monitoring_session')
    return response
  }
} 