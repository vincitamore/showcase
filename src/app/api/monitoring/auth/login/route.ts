import { NextResponse } from 'next/server'
import { env } from '@/env'
import { logger } from '@/lib/logger'
import { cookies } from 'next/headers'
import { createHash } from 'crypto'

// Session duration: 12 hours
const SESSION_DURATION = 12 * 60 * 60 * 1000

function hashPassword(password: string): string {
  return createHash('sha256')
    .update(password + env.MONITORING_AUTH_SALT)
    .digest('hex')
}

export async function POST(req: Request) {
  try {
    // Parse request body
    const body = await req.json()
    const { username, password } = body

    if (!username || !password) {
      logger.warn('Missing login credentials', {
        hasUsername: !!username,
        hasPassword: !!password
      })
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      )
    }

    // Verify credentials
    const expectedUsername = env.MONITORING_USERNAME
    const expectedPasswordHash = env.MONITORING_PASSWORD_HASH

    if (!expectedUsername || !expectedPasswordHash) {
      logger.error('Monitoring credentials not configured')
      return NextResponse.json(
        { error: 'Authentication not configured' },
        { status: 500 }
      )
    }

    const passwordHash = hashPassword(password)
    const isValid = username === expectedUsername && passwordHash === expectedPasswordHash

    if (!isValid) {
      logger.warn('Invalid login attempt', {
        username,
        timestamp: new Date().toISOString()
      })
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }

    // Create session
    const expiresAt = new Date(Date.now() + SESSION_DURATION)
    const sessionData = {
      username,
      expiresAt: expiresAt.toISOString()
    }

    // Set session cookie
    cookies().set('monitoring_session', JSON.stringify(sessionData), {
      expires: expiresAt,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/'
    })

    logger.info('Successful monitoring login', {
      username,
      expiresAt: expiresAt.toISOString()
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Login error', {
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    )
  }
} 