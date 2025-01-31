import { env } from '@/env'
import { NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { cookies } from 'next/headers'

const COOKIE_NAME = 'monitoring_session'
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 // 7 days

function hashPassword(password: string, salt: string): string {
  if (!salt) throw new Error('Missing auth salt')
  return createHash('sha256')
    .update(password + salt)
    .digest('hex')
}

export async function POST(req: Request) {
  try {
    console.log('Received auth request')

    // Check if monitoring is enabled
    if (!env.MONITORING_ENABLED) {
      console.debug('Monitoring is disabled')
      return NextResponse.json(
        { error: 'Monitoring is disabled' },
        { status: 404 }
      )
    }

    // Verify required environment variables
    if (!env.MONITORING_USERNAME || !env.MONITORING_PASSWORD_HASH || !env.MONITORING_AUTH_SALT) {
      console.error('Missing required monitoring auth environment variables:', {
        username: !!env.MONITORING_USERNAME,
        passwordHash: !!env.MONITORING_PASSWORD_HASH,
        salt: !!env.MONITORING_AUTH_SALT
      })
      return NextResponse.json(
        { error: 'Monitoring auth not configured' },
        { status: 500 }
      )
    }

    // Get credentials from request
    const body = await req.json()
    const { username, password } = body
    console.log('Received credentials:', { username, hasPassword: !!password })

    // Validate required fields
    if (!username || !password) {
      console.debug('Missing required fields:', { username: !!username, password: !!password })
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      )
    }

    // Validate username
    if (username !== env.MONITORING_USERNAME) {
      console.debug('Invalid username')
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }

    // Hash and validate password
    const hashedPassword = hashPassword(password, env.MONITORING_AUTH_SALT)
    console.log('Password validation:', {
      matches: hashedPassword === env.MONITORING_PASSWORD_HASH
    })

    if (hashedPassword !== env.MONITORING_PASSWORD_HASH) {
      console.debug('Invalid password')
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }

    // Create session data
    const expiresAt = new Date(Date.now() + COOKIE_MAX_AGE * 1000).toISOString()
    const sessionData = {
      username,
      expiresAt,
      hash: hashedPassword
    }

    // Set session cookie
    const cookieStore = cookies()
    cookieStore.set(COOKIE_NAME, JSON.stringify(sessionData), {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: COOKIE_MAX_AGE,
      path: '/'
    })

    console.log('Authentication successful, session cookie set')
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Auth error:', error)
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    )
  }
} 