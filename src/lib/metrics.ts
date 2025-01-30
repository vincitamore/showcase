import { prisma } from '@/lib/prisma'

interface DatabaseMetricRecord {
  id: string
  timestamp: Date
  duration: number
  query: string | null
  error: boolean
  route: string | null
  method: string | null
  status: number | null
  metadata: any
}

export async function getMetrics(timeWindow: number) {
  const startTime = new Date(Date.now() - timeWindow)

  try {
    // Get regular logs for request metrics
    const [logs, dbMetrics] = await Promise.all([
      prisma.log.findMany({
        where: {
          timestamp: {
            gte: startTime
          }
        },
        orderBy: {
          timestamp: 'desc'
        }
      }),
      // Get database metrics from the new table
      prisma.$queryRaw<DatabaseMetricRecord[]>`
        SELECT * FROM database_metrics 
        WHERE timestamp >= ${startTime}
        ORDER BY timestamp DESC
      `
    ])

    // Process logs to calculate metrics
    let totalRequests = 0
    let successRequests = 0
    let errorRequests = 0
    let totalDuration = 0
    let externalCalls = 0
    let externalDuration = 0
    let externalErrors = 0

    const routes = new Map<string, {
      total: number
      success: number
      totalDuration: number
    }>()

    // Process regular logs
    for (const log of logs) {
      const metadata = typeof log.metadata === 'string' ? JSON.parse(log.metadata) : log.metadata
      if (!metadata?.metrics) continue

      if (metadata.metrics.labels?.route) {
        totalRequests++
        const route = metadata.metrics.labels.route
        const duration = metadata.metrics.duration || 0
        const isError = metadata.metrics.labels.error === 1

        if (!isError) successRequests++
        else errorRequests++

        totalDuration += duration

        const routeStats = routes.get(route) || {
          total: 0,
          success: 0,
          totalDuration: 0
        }
        routeStats.total++
        if (!isError) routeStats.success++
        routeStats.totalDuration += duration
        routes.set(route, routeStats)
      }

      if (metadata.metrics.labels?.type === 'external') {
        externalCalls++
        if (metadata.metrics.duration) {
          externalDuration += metadata.metrics.duration
        }
        if (metadata.metrics.labels.error === 1) externalErrors++
      }
    }

    // Calculate database metrics from the new table
    const dbQueries = dbMetrics.length
    const dbQueryDuration = dbMetrics.reduce((sum: number, metric: DatabaseMetricRecord) => sum + metric.duration, 0)
    const dbErrors = dbMetrics.filter((metric: DatabaseMetricRecord) => metric.error).length

    return {
      timestamp: Date.now(),
      requests: {
        total: totalRequests,
        success: successRequests,
        error: errorRequests,
        avgDuration: totalRequests > 0 ? totalDuration / totalRequests : 0
      },
      routes: Array.from(routes.entries()).map(([route, stats]) => ({
        route,
        requests: stats.total,
        success: stats.success,
        error: stats.total - stats.success,
        avgDuration: stats.total > 0 ? stats.totalDuration / stats.total : 0
      })),
      database: {
        totalQueries: dbQueries,
        avgQueryDuration: dbQueries > 0 ? dbQueryDuration / dbQueries : 0,
        errorRate: dbQueries > 0 ? dbErrors / dbQueries : 0
      },
      external: {
        totalCalls: externalCalls,
        avgLatency: externalCalls > 0 ? externalDuration / externalCalls : 0,
        errorRate: externalCalls > 0 ? externalErrors / externalCalls : 0
      },
      memory: process.env.NODE_ENV === 'development' ? process.memoryUsage() : null
    }
  } catch (error) {
    console.error('Error calculating metrics:', error)
    throw error
  }
} 