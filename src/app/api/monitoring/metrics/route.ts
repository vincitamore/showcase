import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { APIError, handleAPIError } from '@/lib/api-error'
import { logger, withLogging } from '@/lib/logger'
import { serverPerformance } from '@/lib/server/performance'
import { Log, Prisma } from '@prisma/client'
import { NextResponse } from 'next/server'
import { env } from '@/env'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface ClientMetrics {
  timestamp: number
  duration: number
  labels: {
    operationId: string
    [key: string]: string | number
  }
}

interface MetricsResponse {
  requests: {
    total: number
    success: number
    error: number
    avgDuration: number
  }
  routes: {
    [key: string]: {
      total: number
      success: number
      error: number
      avgDuration: number
    }
  }
  memory?: {
    heapUsed: number
    heapTotal: number
    external: number
    arrayBuffers: number
  }
  database: {
    avgQueryDuration: number
    totalQueries: number
    errorRate: number
  }
  external: {
    avgLatency: number
    totalCalls: number
    errorRate: number
  }
}

interface MetricsData {
  operation?: string
  duration?: number
  labels?: {
    route?: string
    error?: number
    [key: string]: unknown
  }
}

async function getMetrics(timeWindow: number = 3600000): Promise<MetricsResponse> {
  const now = Date.now()
  const startTime = now - timeWindow

  // Get all performance logs within the time window
  const logs = await prisma.log.findMany({
    where: {
      timestamp: {
        gte: new Date(startTime)
      },
      metadata: {
        path: ['metrics'],
        not: Prisma.JsonNull
      }
    },
    orderBy: {
      timestamp: 'desc'
    }
  })

  // Process logs to calculate metrics
  const routeStats = new Map<string, { total: number; success: number; durations: number[] }>()
  const dbStats = { durations: [] as number[], total: 0, errors: 0 }
  const externalStats = { durations: [] as number[], total: 0, errors: 0 }
  let totalRequests = 0
  let successRequests = 0

  for (const log of logs) {
    const metrics = (log.metadata as { metrics?: { duration?: number; labels?: Record<string, unknown> } })?.metrics
    if (!metrics) continue

    if (metrics.labels?.route) {
      totalRequests++
      const route = metrics.labels.route as string
      const duration = metrics.duration || 0
      const isError = metrics.labels?.error === 1

      if (!isError) successRequests++

      const stats = routeStats.get(route) || { total: 0, success: 0, durations: [] }
      stats.total++
      if (!isError) stats.success++
      stats.durations.push(duration)
      routeStats.set(route, stats)
    } else if (metrics.labels?.type === 'db_query') {
      dbStats.total++
      if (metrics.duration) dbStats.durations.push(metrics.duration)
      if (metrics.labels?.error === 1) dbStats.errors++
    } else if (metrics.labels?.type === 'external') {
      externalStats.total++
      if (metrics.duration) externalStats.durations.push(metrics.duration)
      if (metrics.labels?.error === 1) externalStats.errors++
    }
  }

  // Calculate route-specific metrics
  const routes: MetricsResponse['routes'] = {}
  for (const [route, stats] of routeStats.entries()) {
    routes[route] = {
      total: stats.total,
      success: stats.success,
      error: stats.total - stats.success,
      avgDuration: stats.durations.length > 0 
        ? stats.durations.reduce((a, b) => a + b, 0) / stats.durations.length
        : 0
    }
  }

  // Get current memory usage in development
  let memory: MetricsResponse['memory'] | undefined
  if (process.env.NODE_ENV === 'development') {
    const memUsage = process.memoryUsage()
    memory = {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      arrayBuffers: memUsage.arrayBuffers
    }
  }

  const avgRequestDuration = totalRequests > 0
    ? logs.reduce((acc: number, log: Log) => {
        const duration = ((log.metadata as any)?.metrics?.duration) || 0
        return acc + duration
      }, 0) / totalRequests
    : 0

  return {
    requests: {
      total: totalRequests,
      success: successRequests,
      error: totalRequests - successRequests,
      avgDuration: avgRequestDuration
    },
    routes,
    memory,
    database: {
      avgQueryDuration: dbStats.total > 0 ? dbStats.durations.reduce((a, b) => a + b, 0) / dbStats.total : 0,
      totalQueries: dbStats.total,
      errorRate: dbStats.total > 0 ? dbStats.errors / dbStats.total : 0
    },
    external: {
      avgLatency: externalStats.total > 0 ? externalStats.durations.reduce((a, b) => a + b, 0) / externalStats.total : 0,
      totalCalls: externalStats.total,
      errorRate: externalStats.total > 0 ? externalStats.errors / externalStats.total : 0
    }
  }
}

async function handleMetricsRequest(req: Request): Promise<Response> {
  try {
    // Check if monitoring is enabled
    if (!process.env.MONITORING_ENABLED) {
      throw new APIError('Monitoring is not enabled', 404, 'MONITORING_DISABLED')
    }

    const timeWindow = 3600000 // 1 hour default
    const metrics = await getMetrics(timeWindow)

    return new Response(JSON.stringify(metrics), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    })
  } catch (error) {
    return handleAPIError(error)
  }
}

export const GET = withLogging(handleMetricsRequest, 'api/monitoring/metrics')

export async function POST(req: Request) {
  if (!env.MONITORING_ENABLED) {
    return new Response('Monitoring is disabled', { status: 404 })
  }

  try {
    const metrics = await req.json() as ClientMetrics
    
    // Create log entry for the metric
    await prisma.log.create({
      data: {
        level: 'INFO',
        message: 'Client performance metric',
        timestamp: new Date(metrics.timestamp),
        duration: metrics.duration,
        route: metrics.labels.operationId,
        metadata: JSON.stringify(metrics.labels)
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    logger.error('Failed to store metrics', { error: errorMessage })
    return NextResponse.json({ error: 'Failed to store metrics' }, { status: 500 })
  }
} 
