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
    const targetUrl = `${process.env.NEXT_PUBLIC_URL}${cronPath}`;
    logger.info('Forwarding request to cron endpoint', { targetUrl });
    
    const cronReq = new Request(targetUrl, {
      headers: {
        'Authorization': `Bearer ${env.CRON_SECRET}`
      }
    });
    
    const response = await fetch(cronReq);
    
    // Detailed response logging
    logger.info('Cron endpoint response', { 
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries())
    });
    
    // Handle different response types
    let data;
    const contentType = response.headers.get('content-type');
    
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      // Handle non-JSON responses
      data = {
        text: await response.text(),
        contentType: contentType || 'unknown'
      };
    }
    
    // Include additional response info
    return NextResponse.json({
      status: 'success',
      cronResponse: data,
      responseStatus: response.status,
      responseInfo: {
        url: response.url,
        ok: response.ok,
        redirected: response.redirected,
        statusText: response.statusText
      }
    });
  } catch (error) {
    // Enhanced error logging
    logger.error('Error testing cron endpoint', { 
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : error,
      path: cronPath
    });
    return NextResponse.json(
      { error: { message: 'Error executing cron job', code: 'EXECUTION_ERROR' } },
      { status: 500 }
    );
  }
} 