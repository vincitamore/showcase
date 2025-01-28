import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { APIError, handleAPIError } from '@/lib/api-error'

export async function POST() {
  const cookieStore = cookies()
  
  try {
    // Clear all Twitter-related cookies
    cookieStore.delete('x_access_token')
    cookieStore.delete('x_refresh_token')
    cookieStore.delete('x_oauth_state')
    cookieStore.delete('x_oauth_code_verifier')
    
    return NextResponse.json({ 
      success: true,
      message: 'Logged out successfully'
    })
  } catch (error) {
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