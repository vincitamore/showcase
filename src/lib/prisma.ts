import { PrismaClient, Prisma } from '@prisma/client'
import { env } from '@/env'
import { logger } from '@/lib/logger'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Track if we're currently executing a query to prevent recursion
let isExecutingQuery = false;

// Helper to determine if a query should be logged
function shouldLogQuery(query: string): boolean {
  // Skip logging for:
  // 1. Database metrics table operations
  // 2. Transaction operations (BEGIN, COMMIT, ROLLBACK)
  // 3. Log table operations
  // 4. System queries (like SELECT 1)
  return !(
    query.includes('database_metrics') ||
    query.includes('"Log"') ||
    query === 'BEGIN' ||
    query === 'COMMIT' ||
    query === 'ROLLBACK' ||
    query === 'SELECT 1'
  );
}

// Helper to safely format a query for logging
function formatQueryForLogging(query: string): string {
  try {
    // Remove newlines and extra spaces
    const cleanQuery = query.replace(/\s+/g, ' ').trim();
    
    // Truncate and ensure the string is properly terminated
    return cleanQuery.length > 500 
      ? cleanQuery.substring(0, 497) + '...'
      : cleanQuery;
  } catch (error) {
    return 'Error formatting query';
  }
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: env.NODE_ENV === 'development' ? [
    {
      emit: 'event',
      level: 'query',
    },
  ] : []
})

if (env.NODE_ENV === 'development') {
  prisma.$on('query' as never, async (e: Prisma.QueryEvent) => {
    // Skip logging if:
    // 1. We're already executing a query, or
    // 2. This is a query we don't want to log
    if (isExecutingQuery || !shouldLogQuery(e.query)) {
      return;
    }

    try {
      isExecutingQuery = true;
      await logger.info('Database query executed', {
        metrics: {
          duration: e.duration,
          labels: {
            type: 'db_query',
            query: formatQueryForLogging(e.query),
            error: 0
          }
        }
      })
    } catch (error) {
      // Log error to console but don't throw to prevent breaking the application
      console.error('Error logging query:', error);
    } finally {
      isExecutingQuery = false;
    }
  })
}

if (env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma 