import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { APIError, handleAPIError } from '@/lib/api-error'
import { logger, withLogging } from '@/lib/logger'

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
    logger.debug('Checking database health', {
      step: 'check-database',
      startTime: start
    })

    await prisma.$queryRaw`SELECT 1`
    const latency = Date.now() - start

    logger.info('Database health check successful', {
      step: 'database-success',
      latency
    })

    return {
      status: 'ok',
      latency
    }
  } catch (error) {
    const latency = Date.now() - start

    logger.error('Database health check failed', {
      step: 'database-error',
      error,
      latency
    })

    return {
      status: 'error',
      latency,
      error: error instanceof Error ? error.message : 'Unknown database error'
    }
  }
}

async function handleHealthCheck(request: Request): Promise<Response> {
  try {
    logger.info('Processing health check request', {
      step: 'init',
      method: request.method,
      url: request.url
    })
    
    // Check database health
    const dbHealth = await checkDatabaseHealth()
    
    const healthStatus: HealthStatus = {
      status: dbHealth.status === 'ok' ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
      services: {
        database: dbHealth
      }
    }

    logger.debug('Health check status', {
      step: 'check-complete',
      status: healthStatus.status,
      dbStatus: dbHealth.status,
      dbLatency: dbHealth.latency
    })

    if (healthStatus.status === 'error') {
      throw new APIError(
        'One or more services are unhealthy',
        503,
        'SERVICE_UNHEALTHY'
      )
    }

    return NextResponse.json(healthStatus)
  } catch (error) {
    logger.error('Health check failed', {
      step: 'error',
      error
    })

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

async function handleDetailedHealthCheck(request: Request): Promise<Response> {
  try {
    logger.info('Processing detailed health check request', {
      step: 'init',
      method: request.method,
      url: request.url
    })
    
    // For POST requests, we'll do a more comprehensive health check
    const dbHealth = await checkDatabaseHealth()

    logger.debug('Checking service configurations', {
      step: 'check-services',
      hasSmtpHost: !!process.env.SMTP_HOST,
      hasSmtpPort: !!process.env.SMTP_PORT,
      hasTwitterApiKey: !!process.env.TWITTER_API_KEY,
      hasTwitterApiSecret: !!process.env.TWITTER_API_SECRET
    })
    
    const healthStatus: HealthStatus = {
      status: dbHealth.status === 'ok' ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
      services: {
        database: dbHealth,
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

    logger.info('Detailed health check complete', {
      step: 'complete',
      status: healthStatus.status,
      dbStatus: dbHealth.status,
      smtpStatus: healthStatus.services.smtp?.status,
      twitterStatus: healthStatus.services.twitter?.status
    })

    if (healthStatus.status === 'error') {
      throw new APIError(
        'One or more services are unhealthy',
        503,
        'SERVICE_UNHEALTHY'
      )
    }

    return NextResponse.json(healthStatus)
  } catch (error) {
    logger.error('Detailed health check failed', {
      step: 'error',
      error
    })

    return handleAPIError(error)
  }
}

export const GET = withLogging(handleHealthCheck, 'api/health')
export const POST = withLogging(handleDetailedHealthCheck, 'api/health') 