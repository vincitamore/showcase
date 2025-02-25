import { NextResponse } from 'next/server';
import { resetExpiredRateLimits, getRateLimit } from '@/lib/tweet-storage';
import { env } from '@/env';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/db';

// Type for rate limit record
interface RateLimitRecord {
  endpoint: string;
  resetAt: Date;
  remaining: number;
}

// This is only enabled in development mode for managing rate limits
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  // Only allow in development or with special override
  if (process.env.NODE_ENV === 'production' && !env.ALLOW_DEV_ENDPOINTS) {
    return NextResponse.json(
      { error: { message: 'Not available in production', code: 'DISABLED' } },
      { status: 403 }
    );
  }

  // Check for dev secret
  const authHeader = req.headers.get('authorization');
  const devSecret = env.DEV_SECRET || env.CRON_SECRET;
  
  if (authHeader !== `Bearer ${devSecret}`) {
    return NextResponse.json(
      { error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } },
      { status: 401 }
    );
  }

  try {
    // Get query parameters
    const { searchParams } = new URL(req.url);
    const endpoint = searchParams.get('endpoint');
    const action = searchParams.get('action') || 'check';
    
    // If endpoint is specified, get info for just that endpoint
    if (endpoint) {
      const rateLimit = await getRateLimit(endpoint);
      const now = new Date();
      const resetAt = new Date(rateLimit.resetAt);
      const isExpired = now > resetAt;
      
      // If action is reset and the rate limit is expired, reset it
      if (action === 'reset' && isExpired) {
        const result = await resetExpiredRateLimits();
        return NextResponse.json({
          status: 'success',
          action: 'reset',
          endpoint,
          result
        });
      }
      
      return NextResponse.json({
        endpoint,
        resetAt: resetAt.toISOString(),
        remaining: rateLimit.remaining,
        isExpired,
        timeUntilReset: isExpired ? 'Expired' : Math.floor((resetAt.getTime() - now.getTime()) / 1000) + 's'
      });
    }
    
    // If no endpoint specified, check all rate limits
    if (action === 'reset') {
      const result = await resetExpiredRateLimits();
      return NextResponse.json({
        status: 'success',
        action: 'reset',
        result
      });
    } else {
      // Just get info about all rate limits
      const allRateLimits = await (prisma as any).twitterRateLimit.findMany();
      const now = new Date();
      
      const limitsWithStatus = allRateLimits.map((limit: RateLimitRecord) => {
        const resetAt = new Date(limit.resetAt);
        const isExpired = now > resetAt;
        return {
          endpoint: limit.endpoint,
          resetAt: resetAt.toISOString(),
          remaining: limit.remaining,
          isExpired,
          timeUntilReset: isExpired ? 'Expired' : Math.floor((resetAt.getTime() - now.getTime()) / 1000) + 's'
        };
      });
      
      return NextResponse.json({
        status: 'success',
        action: 'check',
        rateLimits: limitsWithStatus
      });
    }
  } catch (error) {
    logger.error('Error managing rate limits', { error });
    return NextResponse.json(
      { error: { message: 'Error managing rate limits', code: 'EXECUTION_ERROR' } },
      { status: 500 }
    );
  }
} 