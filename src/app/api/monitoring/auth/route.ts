import { env } from '@/env'
import { NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { cookies } from 'next/headers'

const COOKIE_NAME = 'monitoring_auth'
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 // 7 days

function hashPassword(password: string, salt: string): string {
  if (!salt) throw new Error('Missing auth salt')
  return createHash('sha256')
    .update(password + salt)
    .digest('hex')
}

export async function POST(req: Request) {
  try {
    // Check if monitoring is enabled
    if (!env.MONITORING_ENABLED) {
      console.debug('Monitoring is disabled')
      return NextResponse.json(
        { error: 'Monitoring is disabled' },
        { status: 404 }
      )
    }

    // Verify required environment variables
    if (!env.MONITORING_PASSWORD_HASH || !env.MONITORING_AUTH_SALT) {
      console.error('Missing required monitoring auth environment variables')
      return NextResponse.json(
        { error: 'Monitoring auth not configured' },
        { status: 500 }
      )
    }

    // Get password from request
    const { password } = await req.json()

    // Validate required fields
    if (!password) {
      return NextResponse.json(
        { error: 'Password is required' },
        { status: 400 }
      )
    }

    // Hash the provided password
    const hashedPassword = hashPassword(password, env.MONITORING_AUTH_SALT)

    // Compare with stored hash
    if (hashedPassword !== env.MONITORING_PASSWORD_HASH) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }

    // Set auth cookie
    cookies().set(COOKIE_NAME, hashedPassword, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: COOKIE_MAX_AGE,
      path: '/'
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Auth error:', error)
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    )
  }
} 