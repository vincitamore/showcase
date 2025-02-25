import { NextResponse } from 'next/server';
import { env } from '@/env';
import { logger } from '@/lib/logger';

// This is only enabled in development mode for testing cron jobs
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  // Only allow in development or with special override
  if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_DEV_ENDPOINTS) {
    return NextResponse.json(
      { error: { message: 'Not available in production', code: 'DISABLED' } },
      { status: 403 }
    );
  }

  // Check for dev secret
  const authHeader = req.headers.get('authorization');
  const devSecret = process.env.DEV_SECRET || env.CRON_SECRET;
  
  if (authHeader !== `Bearer ${devSecret}`) {
    return NextResponse.json(
      { error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } },
      { status: 401 }
    );
  }

  // Get target cron path from query param
  const { searchParams } = new URL(req.url);
  const cronPath = searchParams.get('path');

  if (!cronPath) {
    return NextResponse.json(
      { error: { message: 'Missing path parameter', code: 'MISSING_PARAM' } },
      { status: 400 }
    );
  }

  try {
    logger.info('Testing cron endpoint', { path: cronPath });
    
    // Forward the request to the actual cron endpoint with the proper auth
    const cronReq = new Request(`${process.env.NEXT_PUBLIC_URL}${cronPath}`, {
      headers: {
        'Authorization': `Bearer ${env.CRON_SECRET}`
      }
    });
    
    const response = await fetch(cronReq);
    const data = await response.json();
    
    return NextResponse.json({
      status: 'success',
      cronResponse: data
    });
  } catch (error) {
    logger.error('Error testing cron endpoint', { error, path: cronPath });
    return NextResponse.json(
      { error: { message: 'Error executing cron job', code: 'EXECUTION_ERROR' } },
      { status: 500 }
    );
  }
} 