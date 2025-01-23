import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

export const middleware = withAuth(
  function middleware(req) {
    // Get the pathname
    const path = req.nextUrl.pathname

    // Allow chat and public routes to pass through
    if (path.startsWith('/api/chat') || path.startsWith('/api/public')) {
      return NextResponse.next()
    }

    // Check for auth token
    const token = req.nextauth.token
    
    // If no token and trying to access protected route, return 401
    if (!token) {
      return new NextResponse(
        JSON.stringify({ error: 'Authentication required' }),
        { 
          status: 401,
          headers: { 'content-type': 'application/json' }
        }
      )
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
    pages: {
      signIn: "/",
    },
  }
)

// Protect Twitter and other protected routes
export const config = {
  matcher: [
    "/api/twitter/:path*",
    "/api/protected/:path*"
  ],
} 