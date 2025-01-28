import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { APIError, handleAPIError } from '@/lib/api-error'

// Mark route as dynamic to prevent static generation
export const dynamic = 'force-dynamic'
export const runtime = 'edge'

export async function GET(request: Request) {
  try {
    const cookieStore = cookies()
    const sessionToken = cookieStore.get('next-auth.session-token')
    const isAuthenticated = !!sessionToken

    return NextResponse.json({ 
      authenticated: isAuthenticated 
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('cookies')) {
      throw new APIError(
        'Failed to access session cookies',
        500,
        'SESSION_ACCESS_ERROR'
      )
    }
    
    throw new APIError(
      `Failed to check authentication status: ${error instanceof Error ? error.message : 'Unknown error'}`,
      500,
      'AUTH_STATUS_ERROR'
    )
  }
} 