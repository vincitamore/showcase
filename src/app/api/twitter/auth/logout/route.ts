import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { APIError, handleAPIError } from '@/lib/api-error'
import { logger, withLogging } from '@/lib/logger'

async function handleLogout(request: Request): Promise<Response> {
  const cookieStore = cookies()
  
  try {
    logger.info('Processing logout request', {
      step: 'init',
      url: request.url
    })

    // Clear all Twitter-related cookies
    const cookiesToClear = [
      'x_access_token',
      'x_refresh_token',
      'x_oauth_state',
      'x_oauth_code_verifier'
    ]

    logger.debug('Clearing auth cookies', {
      step: 'clear-cookies',
      cookiesToClear
    })

    cookiesToClear.forEach(name => {
      cookieStore.delete(name)
    })

    logger.info('Logout successful', {
      step: 'complete'
    })
    
    return NextResponse.json({ 
      success: true,
      message: 'Logged out successfully'
    })
  } catch (error) {
    logger.error('Logout failed', {
      step: 'error',
      error
    })

    if (error instanceof Error && error.message.includes('cookies')) {
      throw new APIError(
        'Failed to clear session cookies',
        500,
        'SESSION_CLEAR_ERROR'
      )
    }
    
    throw new APIError(
      `Failed to logout: ${error instanceof Error ? error.message : 'Unknown error'}`,
      500,
      'LOGOUT_ERROR'
    )
  }
}

export const POST = withLogging(handleLogout, 'api/twitter/auth/logout') 