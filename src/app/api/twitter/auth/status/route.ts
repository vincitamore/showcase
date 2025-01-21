import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET() {
  try {
    const cookieStore = cookies()
    const token = cookieStore.get('twitter_token')
    
    return NextResponse.json({ 
      isAuthenticated: !!token,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error checking auth status:', error)
    return NextResponse.json({ 
      isAuthenticated: false,
      error: 'Failed to check authentication status'
    }, { status: 500 })
  }
} 