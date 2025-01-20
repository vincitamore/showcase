import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // Only run on /api/tweets and /api/auth/x routes
  if (!request.nextUrl.pathname.match(/^\/api\/(tweets|auth\/x)/)) {
    return NextResponse.next()
  }

  try {
    const response = NextResponse.next()

    // Add headers to help with CORS and caching
    response.headers.set('Access-Control-Allow-Origin', '*')
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')

    return response
  } catch (error) {
    console.error('Middleware error:', error)
    return new NextResponse(
      JSON.stringify({ success: false, message: 'Internal Server Error' }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    )
  }
}

export const config = {
  matcher: [
    '/api/tweets/:path*',
    '/api/auth/x/:path*'
  ]
} 