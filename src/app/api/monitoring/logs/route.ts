import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { env } from '@/env'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const preferredRegion = 'iad1'

// Add type for metadata
interface LogMetadata {
  metrics?: {
    labels?: {
      type?: string;
      route?: string;
      error?: number;
      method?: string;
      status?: number;
    };
    duration?: number;
  };
  [key: string]: any;
}

interface LogsQuery {
  level?: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'all'
  route?: string
  startTime?: string
  endTime?: string
  limit?: number
  offset?: number
}

async function getLogs(query: LogsQuery) {
  console.debug('[Logs API] Starting getLogs with query:', query)

  const {
    level,
    route,
    startTime,
    endTime,
    limit = 100,
    offset = 0
  } = query

  // Ensure positive values for pagination
  const safeLimit = Math.max(1, limit)
  const safeOffset = Math.max(0, offset)

  // Build where clause
  const where = {} as any

  // Add timestamp filters if provided
  if (startTime && endTime) {
    where.timestamp = {
      gte: new Date(startTime),
      lte: new Date(endTime)
    }
  }

  // Add level filter if provided and not 'all'
  if (level && level !== 'all') {
    where.level = level
  }

  // Add route filter if provided and not 'all'
  if (route && route !== 'all') {
    where.route = {
      equals: route
    }
  }

  console.debug('[Logs API] Constructed where clause:', where)

  try {
    // Execute queries without performance tracking to avoid recursive logging
    const [allLogs, total] = await prisma.$transaction([
      // Get logs
      prisma.log.findMany({
        where,
        orderBy: {
          timestamp: 'desc'
        },
        take: safeLimit,
        skip: safeOffset,
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
      // Get total count
      prisma.log.count({ where })
    ])

    console.debug('[Logs API] Raw database results:', {
      totalRecords: allLogs.length,
      totalCount: total,
      firstRecord: allLogs[0] || null,
      lastRecord: allLogs[allLogs.length - 1] || null
    })

    // Filter out database metric logs in memory
    const logs = allLogs.filter(log => {
      const metadata = typeof log.metadata === 'string'
        ? JSON.parse(log.metadata) as LogMetadata
        : log.metadata as LogMetadata;

      const shouldKeep = metadata?.metrics?.labels?.type !== 'db_query';
      if (!shouldKeep) {
        console.debug('[Logs API] Filtered out log:', {
          id: log.id,
          type: metadata?.metrics?.labels?.type,
          message: log.message
        });
      }
      return shouldKeep;
    });

    console.debug('[Logs API] After filtering:', {
      originalCount: allLogs.length,
      filteredCount: logs.length,
      difference: allLogs.length - logs.length
    });

    return [logs, total] as const;
  } catch (error) {
    console.error('[Logs API] Error in getLogs:', error)
    throw error
  }
}

export async function GET(req: Request) {
  // Check if monitoring is enabled
  if (!env.MONITORING_ENABLED) {
    console.debug('Monitoring disabled')
    return new Response('Monitoring is disabled', { status: 404 })
  }

  try {
    const url = new URL(req.url)
    const levelParam = url.searchParams.get('level')?.toUpperCase() as LogsQuery['level']
    const query: LogsQuery = {
      level: levelParam || 'all',
      route: url.searchParams.get('route') || undefined,
      startTime: url.searchParams.get('startTime') || undefined,
      endTime: url.searchParams.get('endTime') || undefined,
      limit: url.searchParams.get('limit') ? Math.max(1, parseInt(url.searchParams.get('limit')!)) : undefined,
      offset: url.searchParams.get('offset') ? Math.max(0, parseInt(url.searchParams.get('offset')!)) : undefined
    }

    const [logs, total] = await getLogs(query)

    return NextResponse.json({
      logs,
      total,
      query
    })
  } catch (error) {
    console.error('Logs API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
} 
