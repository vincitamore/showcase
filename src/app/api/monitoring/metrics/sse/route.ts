import { env } from '@/env'
import { prisma } from '@/lib/prisma'
import { headers } from 'next/headers'

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

const HEARTBEAT_INTERVAL = 30000 // 30 seconds
const METRICS_INTERVAL = 5000 // 5 seconds

interface RouteMetrics {
  route: string
  requests: number
  success: number
  error: number
  avgDuration: number
}

interface MetricsData {
  timestamp: number
  requests: {
    total: number
    success: number
    error: number
    avgDuration: number
  }
  routes: RouteMetrics[]
  database: {
    totalQueries: number
    avgQueryDuration: number
    errorRate: number
    timeSeries: {
      timestamp: number
      avgDuration: number
      queryCount: number
      errorCount: number
    }[]
  }
  external: {
    totalCalls: number
    avgLatency: number
    errorRate: number
  }
  memory?: {
    heapUsed: number
    heapTotal: number
    external: number
    arrayBuffers: number
  } | null
}

interface MetricLabels {
  type?: string;
  route?: string;
  error?: number;
  [key: string]: unknown;
}

interface LogMetrics {
  duration?: number;
  labels?: MetricLabels;
}

interface LogMetadata {
  metrics?: LogMetrics;
  [key: string]: unknown;
}

interface RouteMetric {
  route: string;
  duration: number;
  isError: boolean;
}

interface DbMetric {
  duration: number;
  isError: boolean;
}

interface ExternalMetric {
  duration: number;
  isError: boolean;
}

function formatSSEMessage(event: string, data: any) {
  try {
    const formattedData = JSON.stringify(data)
    return `event: ${event}\ndata: ${formattedData}\n\n`
  } catch (error) {
    console.error('Error formatting SSE message:', error)
    return `event: error\ndata: {"message": "Failed to format message"}\n\n`
  }
}

function getLabels(metrics: LogMetrics): MetricLabels | null {
  return metrics.labels || null;
}

function isDbQuery(metrics: LogMetrics): boolean {
  return getLabels(metrics)?.type === 'db_query';
}

function isExternalCall(metrics: LogMetrics): boolean {
  return getLabels(metrics)?.type === 'external';
}

function hasRoute(metrics: LogMetrics): boolean {
  return !!getLabels(metrics)?.route;
}

function getRouteMetrics(metrics: LogMetrics): RouteMetric | null {
  const labels = getLabels(metrics);
  if (!labels?.route) return null;
  
  return {
    route: labels.route,
    duration: metrics.duration || 0,
    isError: labels.error === 1
  };
}

function getExternalMetrics(metrics: LogMetrics): ExternalMetric | null {
  const labels = getLabels(metrics);
  if (!isExternalCall(metrics)) return null;

  return {
    duration: metrics.duration || 0,
    isError: labels?.error === 1 || false
  };
}

async function getMetrics(timeWindow: number) {
  const startTime = new Date(Date.now() - timeWindow)

  // Only log metrics query params in development
  if (env.NODE_ENV === 'development') {
    console.debug('Querying metrics:', {
      timeWindow: `${timeWindow / 1000}s`,
      startTime: startTime.toISOString()
    })
  }

  // Get both logs and database metrics
  const [logs, dbMetrics] = await Promise.all([
    prisma.log.findMany({
      where: {
        timestamp: {
          gte: startTime
        }
      },
      orderBy: {
        timestamp: 'asc'
      },
      select: {
        id: true,
        timestamp: true,
        level: true,
        message: true,
        duration: true,
        error: true,
        route: true,
        method: true,
        status: true,
        metadata: true
      }
    }),
    prisma.$queryRaw<DatabaseMetricRecord[]>`
      SELECT * FROM database_metrics 
      WHERE timestamp >= ${startTime}
      ORDER BY timestamp ASC
    `
  ]);

  // Only log summary of found data
  if (env.NODE_ENV === 'development') {
    console.debug('Found data:', {
      logs: {
        total: logs.length,
        timeRange: {
          from: logs[0]?.timestamp?.toISOString(),
          to: logs[logs.length - 1]?.timestamp?.toISOString()
        }
      },
      dbMetrics: {
        total: dbMetrics.length,
        timeRange: {
          from: dbMetrics[0]?.timestamp?.toISOString(),
          to: dbMetrics[dbMetrics.length - 1]?.timestamp?.toISOString()
        }
      }
    })
  }

  // Process logs to calculate metrics
  let totalRequests = 0
  let successRequests = 0
  let errorRequests = 0
  let totalDuration = 0
  let externalCalls = 0
  let externalDuration = 0
  let externalErrors = 0

  // Track database metrics over time
  const dbTimeSeriesMap = new Map<string, {
    avgDuration: number
    queryCount: number
    errorCount: number
  }>()

  // Track route metrics
  const routesMap = new Map<string, {
    total: number
    success: number
    error: number
    totalDuration: number
  }>()

  // Process regular logs for request and external service metrics
  for (const log of logs) {
    try {
      // Track route metrics from the log entry itself
      if (log.route) {
        totalRequests++;
        const routeStats = routesMap.get(log.route) || {
          total: 0,
          success: 0,
          error: 0,
          totalDuration: 0
        };
        routeStats.total++;
        if (!log.error) {
          routeStats.success++;
          successRequests++;
        } else {
          routeStats.error++;
          errorRequests++;
        }
        if (log.duration) {
          totalDuration += log.duration;
          routeStats.totalDuration += log.duration;
        }
        routesMap.set(log.route, routeStats);
      }

      // Process metrics from metadata
      let parsedMetadata: LogMetadata;
      if (typeof log.metadata === 'string') {
        parsedMetadata = JSON.parse(log.metadata);
      } else if (log.metadata && typeof log.metadata === 'object') {
        parsedMetadata = log.metadata as LogMetadata;
      } else {
        continue;
      }

      const metrics = parsedMetadata.metrics;
      if (!metrics?.labels) continue;

      // Process external service metrics
      const externalMetrics = getExternalMetrics(metrics);
      if (externalMetrics) {
        externalCalls++;
        const { duration, isError } = externalMetrics;
        
        if (duration) externalDuration += duration;
        if (isError) externalErrors++;
      }
    } catch (error) {
      if (env.NODE_ENV === 'development') {
        console.error('Error processing log entry:', error, {
          logId: log.id,
          timestamp: log.timestamp
        });
      }
      continue;
    }
  }

  // Convert route metrics to array format
  const routes = Array.from(routesMap.entries()).map(([route, stats]) => ({
    route,
    requests: stats.total,
    success: stats.success,
    error: stats.error,
    avgDuration: stats.total > 0 ? stats.totalDuration / stats.total : 0
  }));

  // Process database metrics
  for (const metric of dbMetrics) {
    // Round timestamp to nearest minute for time series bucketing
    const timeKey = new Date(metric.timestamp).toISOString().slice(0, 16);
    
    const timePoint = dbTimeSeriesMap.get(timeKey) || {
      avgDuration: 0,
      queryCount: 0,
      errorCount: 0
    };

    timePoint.queryCount++;
    if (metric.error) timePoint.errorCount++;
    timePoint.avgDuration = (
      (timePoint.avgDuration * (timePoint.queryCount - 1) + metric.duration) / 
      timePoint.queryCount
    );

    dbTimeSeriesMap.set(timeKey, timePoint);
  }

  // Convert time series data to array and sort by timestamp
  const dbTimeSeries = Array.from(dbTimeSeriesMap.entries())
    .map(([timestamp, data]) => ({
      timestamp,
      ...data
    }))
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  if (env.NODE_ENV === 'development') {
    console.debug('Metrics summary:', {
      requests: totalRequests,
      dbQueries: dbMetrics.length,
      dbTimeSeries: dbTimeSeries.length,
      routes: routes.length,
      externalCalls
    });
  }

  // Get memory metrics
  const memory = process.memoryUsage();

  return {
    timestamp: Date.now(),
    requests: {
      total: totalRequests,
      success: successRequests,
      error: errorRequests,
      avgDuration: totalRequests > 0 ? totalDuration / totalRequests : 0
    },
    routes,
    database: {
      totalQueries: dbMetrics.length,
      avgQueryDuration: dbMetrics.length > 0 
        ? dbMetrics.reduce((sum: number, m: DatabaseMetricRecord) => sum + m.duration, 0) / dbMetrics.length 
        : 0,
      errorRate: dbMetrics.length > 0 
        ? dbMetrics.filter((m: DatabaseMetricRecord) => m.error).length / dbMetrics.length 
        : 0,
      timeSeries: dbTimeSeries
    },
    external: {
      totalCalls: externalCalls,
      avgLatency: externalCalls > 0 ? externalDuration / externalCalls : 0,
      errorRate: externalCalls > 0 ? externalErrors / externalCalls : 0
    },
    memory: {
      heapUsed: memory.heapUsed,
      heapTotal: memory.heapTotal,
      external: memory.external,
      arrayBuffers: memory.arrayBuffers || 0
    }
  };
}

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const preferredRegion = 'iad1'

export async function GET(req: Request) {
  // Check if monitoring is enabled or in development mode
  if (!env.MONITORING_ENABLED && env.NODE_ENV !== 'development') {
    console.debug('Monitoring disabled');
    return new Response('Monitoring is disabled', { status: 404 });
  }

  // Test database connection
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    console.error('Database connection failed:', error);
    return new Response('Database connection failed', { status: 500 });
  }

  // Test metrics query
  try {
    await getMetrics(3600000);
  } catch (error) {
    console.error('Initial metrics query failed:', error);
    return new Response('Metrics query failed', { status: 500 });
  }

  const encoder = new TextEncoder();
  let isConnected = true;
  let metricsInterval: NodeJS.Timeout | null = null;
  let heartbeatInterval: NodeJS.Timeout | null = null;

  try {
    const stream = new ReadableStream({
      start: async (controller) => {
        // Function to safely enqueue messages
        const safeEnqueue = (event: string, data: any) => {
          if (isConnected) {
            try {
              const message = formatSSEMessage(event, data);
              controller.enqueue(encoder.encode(message));
            } catch (error: unknown) {
              if (error instanceof Error && error.message.includes('Controller is already closed')) {
                isConnected = false;
                cleanup();
              } else {
                console.error(`Error sending ${event}:`, error);
              }
            }
          }
        };

        // Cleanup function
        const cleanup = () => {
          isConnected = false;
          if (metricsInterval) {
            clearInterval(metricsInterval);
            metricsInterval = null;
          }
          if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
            heartbeatInterval = null;
          }
        };

        // Send initial metrics
        try {
          const metrics = await getMetrics(3600000);
          safeEnqueue('metrics', metrics);
        } catch (error) {
          console.error('Error sending initial metrics:', error);
          safeEnqueue('error', { message: 'Failed to fetch initial metrics' });
        }

        // Set up periodic metrics updates
        metricsInterval = setInterval(async () => {
          if (!isConnected) return cleanup();

          try {
            const metrics = await getMetrics(3600000);
            safeEnqueue('metrics', metrics);
          } catch (error) {
            console.error('Error sending metrics update:', error);
            safeEnqueue('error', { message: 'Failed to fetch metrics' });
          }
        }, METRICS_INTERVAL);

        // Set up heartbeat
        heartbeatInterval = setInterval(() => {
          if (!isConnected) return cleanup();
          safeEnqueue('heartbeat', { timestamp: Date.now() });
        }, HEARTBEAT_INTERVAL);

        // Handle client disconnect
        return () => {
          cleanup();
          controller.close();
        };
      },
      cancel() {
        isConnected = false;
        if (metricsInterval) clearInterval(metricsInterval);
        if (heartbeatInterval) clearInterval(heartbeatInterval);
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Error setting up SSE:', error);
    return new Response('Failed to setup metrics stream', { status: 500 });
  }
} 