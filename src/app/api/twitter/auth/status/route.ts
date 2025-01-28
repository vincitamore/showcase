import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { APIError, handleAPIError } from '@/lib/api-error'
import { logger, withLogging } from '@/lib/logger'

// Mark route as dynamic to prevent static generation
export const dynamic = 'force-dynamic'
export const runtime = 'edge'

async function handleAuthStatus(request: Request): Promise<Response> {
  try {
    logger.info('Checking authentication status', {
      step: 'init',
      url: request.url
    })

    const cookieStore = cookies()
    const sessionToken = cookieStore.get('next-auth.session-token')
    const isAuthenticated = !!sessionToken

    logger.debug('Retrieved session state', {
      step: 'check-session',
      hasSessionToken: !!sessionToken,
      isAuthenticated
    })

    return NextResponse.json({ 
      authenticated: isAuthenticated 
    })
  } catch (error) {
    logger.error('Auth status check failed', {
      step: 'error',
      error
    })

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

export const GET = withLogging(handleAuthStatus, 'api/twitter/auth/status') 