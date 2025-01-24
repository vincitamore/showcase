import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

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
    console.error('Error checking auth status:', error)
    return NextResponse.json({ 
      authenticated: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 