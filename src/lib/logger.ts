import { env } from '@/env';
import { NextResponse } from 'next/server';

export interface LogMetadata {
  timestamp?: string;
  duration?: number;
  route?: string;
  step?: string;
  error?: unknown;
  [key: string]: unknown;
}

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

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

  return `[${timestamp}]${route}${step} ${level.toUpperCase()}: ${message} ${duration ? `(${duration})` : ''} ${metadataStr}`.trim();
}

export const logger = {
  info(message: string, metadata: LogMetadata = {}) {
    const entry = formatLogEntry({ level: 'info', message, metadata });
    console.log(entry);
    return entry;
  },

  warn(message: string, metadata: LogMetadata = {}) {
    const entry = formatLogEntry({ level: 'warn', message, metadata });
    console.warn(entry);
    return entry;
  },

  error(message: string, metadata: LogMetadata = {}) {
    const entry = formatLogEntry({ level: 'error', message, metadata });
    console.error(entry);
    return entry;
  },

  debug(message: string, metadata: LogMetadata = {}): string | undefined {
    if (env.NODE_ENV === 'development') {
      const entry = formatLogEntry({ level: 'debug', message, metadata });
      console.debug(entry);
      return entry;
    }
    return undefined;
  }
};

type RouteHandler = (req: Request, ...args: any[]) => Promise<Response>;

export function withLogging(handler: RouteHandler, route: string): RouteHandler {
  return async (req: Request, ...args: any[]): Promise<Response> => {
    const startTime = Date.now();
    
    try {
      logger.info('Request started', { route, step: 'start' });
      
      const result = await handler(req, ...args);
      
      logger.info('Request completed', {
        route,
        step: 'complete',
        duration: Date.now() - startTime
      });
      
      return result;
    } catch (error) {
      logger.error('Request failed', {
        route,
        step: 'error',
        error,
        duration: Date.now() - startTime
      });
      throw error;
    }
  };
} 