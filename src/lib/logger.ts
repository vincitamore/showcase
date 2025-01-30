import { env } from '@/env';
import { NextResponse } from 'next/server';
import { performance } from './performance';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { createId } from '@paralleldrive/cuid2';

export interface LogMetadata {
  timestamp?: string;
  duration?: number;
  route?: string;
  step?: string;
  error?: string;
  metrics?: {
    duration?: number;
    labels?: {
      type?: string;
      route?: string;
      method?: string;
      status?: number;
      error?: number;
      query?: string;
    };
  };
  [key: string]: unknown;
}

export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

interface LogEntry {
  level: LogLevel;
  message: string;
  metadata: LogMetadata;
}

function formatLogEntry({ level, message, metadata }: LogEntry): string {
  const timestamp = metadata.timestamp || new Date().toISOString();
  const duration = metadata.duration ? `${metadata.duration}ms` : undefined;
  const route = metadata.route ? `[${metadata.route}]` : '';
  const step = metadata.step ? `(${metadata.step})` : '';
  
  // Format the metadata object, excluding special fields
  const { timestamp: _, duration: __, route: ___, step: ____, ...rest } = metadata;
  const metadataStr = Object.keys(rest).length ? JSON.stringify(rest) : '';

  return `[${timestamp}]${route}${step} ${level}: ${message} ${duration ? `(${duration})` : ''} ${metadataStr}`.trim();
}

// Track if we're currently processing a database metric to prevent recursion
let isProcessingDbMetric = false;

async function createLogEntry(level: LogLevel, message: string, metadata: LogMetadata = {}) {
  const { metrics, ...restMetadata } = metadata;
  
  // Skip ALL database-related operations to prevent recursion
  if (metrics?.labels?.type === 'db_query' || message.includes('Database query executed')) {
    // Write database metrics to the dedicated table
    if (!isProcessingDbMetric) {
      try {
        isProcessingDbMetric = true;
        const labels = metrics?.labels || {};
        
        // Use a direct query to insert database metrics
        await prisma.$executeRawUnsafe(
          `INSERT INTO database_metrics (id, timestamp, duration, query, error, route, method, status, metadata) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)`,
          createId(),
          new Date(),
          metrics?.duration || 0,
          labels.query?.substring(0, 500) || null,
          labels.error === 1,
          labels.route || null,
          labels.method || null,
          labels.status || null,
          JSON.stringify(restMetadata)
        );
      } catch (error) {
        if (env.NODE_ENV === 'development') {
          console.error('Failed to write database metric:', error);
        }
      } finally {
        isProcessingDbMetric = false;
      }
    }
    return;
  }

  // For non-database operations, proceed with normal logging
  try {
    // Ensure metrics are properly tagged for route and external calls
    if (metrics?.labels?.type === 'route' || metrics?.labels?.type === 'external') {
      await prisma.log.create({
        data: {
          level,
          message,
          timestamp: new Date(),
          duration: metrics.duration || null,
          error: metrics.labels.error === 1,
          route: metrics.labels.route || null,
          method: metrics.labels.method as string | null,
          status: metrics.labels.status as number | null,
          metadata: {
            ...restMetadata,
            metrics: {
              duration: metrics.duration,
              labels: metrics.labels
            }
          } as Prisma.JsonObject
        }
      });
    } else {
      // For other types of logs
      await prisma.log.create({
        data: {
          level,
          message,
          timestamp: new Date(),
          duration: metadata.duration || null,
          error: !!metadata.error,
          route: metadata.route || null,
          method: metadata.method as string | null,
          status: metadata.status as number | null,
          metadata: restMetadata as Prisma.JsonObject
        }
      });
    }
  } catch (error) {
    console.error('Error creating log entry:', error);
    throw error;
  }
}

// 7 days in milliseconds
const LOG_RETENTION_PERIOD = 7 * 24 * 60 * 60 * 1000;

interface LogOptions {
  level?: LogLevel;
  metadata?: Record<string, unknown>;
  route?: string;
  duration?: number;
}

export const logger = {
  async _writeLog(message: string, options: LogOptions = {}) {
    const { level = 'INFO', metadata = {}, route, duration } = options;

    // Skip any log-related operations to prevent recursion
    const metricsLabels = (metadata as LogMetadata)?.metrics?.labels;
    if (message.includes('"Log"') || 
        (metricsLabels?.query && metricsLabels.query.includes('"Log"'))) {
      if (env.NODE_ENV === 'development') {
        console.debug('Skipping log write for Log table operation');
      }
      return;
    }

    if (env.NODE_ENV === 'development') {
      console.debug('_writeLog called:', {
        message,
        level,
        hasMetadata: !!metadata,
        route,
        duration
      });
    }

    try {
      if (env.NODE_ENV === 'development') {
        console.debug('Attempting to create log entry:', {
          level,
          message: message.substring(0, 100),
          metadata: JSON.stringify(metadata, null, 2)
        });
      }

      await createLogEntry(level, message, {
        ...metadata,
        route,
        duration
      });

      if (env.NODE_ENV === 'development') {
        console.debug('Successfully created log entry');
      }
    } catch (error) {
      console.error('Failed to write log:', error);
      if (env.NODE_ENV === 'development') {
        console.error('Failed log details:', {
          level,
          message,
          metadata
        });
      }
    }
  },

  debug(message: string, metadata?: Record<string, unknown>) {
    return this._writeLog(message, { level: 'DEBUG', metadata });
  },

  info(message: string, metadata?: Record<string, unknown>) {
    return this._writeLog(message, { level: 'INFO', metadata });
  },

  warn(message: string, metadata?: Record<string, unknown>) {
    return this._writeLog(message, { level: 'WARN', metadata });
  },

  error(message: string, metadata?: Record<string, unknown>) {
    return this._writeLog(message, { level: 'ERROR', metadata });
  },

  performance(message: string, route: string, duration: number, metadata?: Record<string, unknown>) {
    return this._writeLog(message, {
      level: 'INFO',
      route,
      duration,
      metadata: {
        type: 'performance',
        ...metadata
      }
    });
  }
};

type RouteHandler = (req: Request, ...args: any[]) => Promise<Response>;

export function withLogging(handler: RouteHandler, route: string) {
  return async function wrappedHandler(req: Request, ...args: any[]): Promise<Response> {
    // Only skip monitoring routes that are not metrics-related
    if (route.startsWith('api/monitoring') && !route.includes('metrics')) {
      return handler(req, ...args);
    }

    const requestId = crypto.randomUUID();
    const operationId = `request_${requestId}`;
    const startTime = Date.now();

    try {
      await logger.info('API request received', {
        requestId,
        route,
        method: req.method,
        url: req.url,
        metrics: {
          labels: {
            route,
            method: req.method,
            requestId
          }
        }
      });

      const response = await handler(req, ...args);
      const duration = Date.now() - startTime;

      await logger.info('API request completed', {
        requestId,
        route,
        method: req.method,
        status: response.status,
        duration,
        metrics: {
          duration,
          labels: {
            route,
            method: req.method,
            status: response.status,
            error: !response.ok ? 1 : 0
          }
        }
      });

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      await logger.error('API request failed', {
        requestId,
        route,
        method: req.method,
        error: errorMessage,
        duration,
        metrics: {
          duration,
          labels: {
            route,
            method: req.method,
            error: 1
          }
        }
      });

      throw error;
    }
  };
} 