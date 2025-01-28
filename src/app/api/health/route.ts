import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { APIError, handleAPIError } from '@/lib/api-error'

export const dynamic = 'force-dynamic'
export const runtime = 'edge'

interface HealthStatus {
  status: 'ok' | 'error'
  timestamp: string
  services: {
    database: {
      status: 'ok' | 'error'
      latency?: number
      error?: string
    }
    twitter?: {
      status: 'ok' | 'error'
      error?: string
    }
    smtp?: {
      status: 'ok' | 'error'
      error?: string
    }
  }
}

async function checkDatabaseHealth(): Promise<HealthStatus['services']['database']> {
  const start = Date.now()
  try {
    await prisma.$queryRaw`SELECT 1`
    return {
      status: 'ok',
      latency: Date.now() - start
    }
  } catch (error) {
    return {
      status: 'error',
      latency: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown database error'
    }
  }
}

export async function GET() {
  try {
    console.log('[Health] API request received')
    
    // Check database health
    const dbHealth = await checkDatabaseHealth()
    
    const healthStatus: HealthStatus = {
      status: dbHealth.status === 'ok' ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
      services: {
        database: dbHealth
      }
    }

    if (healthStatus.status === 'error') {
      throw new APIError(
        'One or more services are unhealthy',
        503,
        'SERVICE_UNHEALTHY'
      )
    }

    return NextResponse.json(healthStatus)
  } catch (error) {
    if (error instanceof APIError) {
      throw error
    }
    
    throw new APIError(
      `Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      500,
      'HEALTH_CHECK_ERROR'
    )
  }
}

export async function POST() {
  try {
    console.log('[Health] POST request received')
    
    // For POST requests, we'll do a more comprehensive health check
    const dbHealth = await checkDatabaseHealth()
    
    const healthStatus: HealthStatus = {
      status: dbHealth.status === 'ok' ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
      services: {
        database: dbHealth,
        // Add more service checks here as needed
        smtp: {
          status: process.env.SMTP_HOST && process.env.SMTP_PORT ? 'ok' : 'error',
          error: !process.env.SMTP_HOST ? 'SMTP not configured' : undefined
        },
        twitter: {
          status: process.env.TWITTER_API_KEY && process.env.TWITTER_API_SECRET ? 'ok' : 'error',
          error: !process.env.TWITTER_API_KEY ? 'Twitter API not configured' : undefined
        }
      }
    }

    if (healthStatus.status === 'error') {
      throw new APIError(
        'One or more services are unhealthy',
        503,
        'SERVICE_UNHEALTHY'
      )
    }

    return NextResponse.json(healthStatus)
  } catch (error) {
    return handleAPIError(error)
  }
} 