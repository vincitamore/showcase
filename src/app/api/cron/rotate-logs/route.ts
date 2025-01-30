import { NextResponse } from 'next/server'
import { rotateLogs } from '../../../../../scripts/rotate-logs'
import { env } from '@/env'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes

export async function GET(req: Request) {
  try {
    // Verify cron secret
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
      return new Response('Unauthorized', { status: 401 })
    }

    await rotateLogs()
    
    return NextResponse.json({
      success: true,
      message: 'Log rotation completed successfully'
    })
  } catch (error) {
    console.error('Cron log rotation failed:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 