import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

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
    console.error('Logout error:', error)
    return NextResponse.json({ 
      error: 'Failed to logout',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 