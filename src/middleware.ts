import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// List of allowed domains
const allowedDomains = [
  'amore.build',
  'localhost:3000', // For local development
]

export async function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || ''
  
  // Log the hostname for debugging
  console.log('Request hostname:', hostname)
  
  // Check if the hostname is in our allowed list
  const isAllowed = allowedDomains.some(domain => hostname.includes(domain))
  
  if (!isAllowed) {
    console.warn(`Blocked request from unauthorized domain: ${hostname}`)
    return new NextResponse(null, {
      status: 403,
      statusText: 'Forbidden',
      headers: {
        'Content-Type': 'application/json',
      },
    })
  }

  try {
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
    console.error('Middleware error:', error)
    return new NextResponse(
      JSON.stringify({ success: false, message: 'Internal Server Error' }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    )
  }
}

// Configure which paths the middleware runs on
export const config = {
  matcher: [
    '/api/:path*',
  ],
} 
