import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { isMonitoringPath, handleMonitoringAuth } from './middleware/monitoring-auth'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Handle monitoring auth
  if (isMonitoringPath(pathname)) {
    return handleMonitoringAuth(request)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    // Monitoring routes
    '/monitoring/:path*',
    '/api/monitoring/:path*',
    
    // Exclude SSE and metrics routes
    '/((?!api/monitoring/metrics|api/monitoring/logs).*)',
  ]
} 