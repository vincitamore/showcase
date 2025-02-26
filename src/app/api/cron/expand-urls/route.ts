import { NextRequest, NextResponse } from 'next/server';
import { expandShortUrls } from '@/lib/tweet-utils';
import { env } from '@/env';

/**
 * API route for expanding shortened URLs in tweet entities
 * This will scan URL entities with t.co URLs and expand them to their destination URLs
 * 
 * Query parameters:
 * - dev_key: Authentication key (required)
 * - test: Set to "true" for dry run mode (no database changes)
 * - limit: Max number of entities to process (default: 100)
 * - logLevel: Logging detail level (none/summary/verbose)
 */
export async function GET(request: NextRequest) {
  // Parse query parameters
  const searchParams = request.nextUrl.searchParams;
  const devKey = searchParams.get('dev_key');
  const isDryRun = searchParams.get('test') === 'true';
  const limitParam = searchParams.get('limit');
  const logLevel = searchParams.get('logLevel') as 'none' | 'summary' | 'verbose' || 'summary';
  
  // Verify authentication (similar to fetch-tweets endpoint)
  const authHeader = request.headers.get('authorization');
  const isProduction = process.env.NODE_ENV === 'production';
  const allowDevEndpoints = env.ALLOW_DEV_ENDPOINTS || false;
  
  // Check authorization:
  // 1. Always accept proper CRON_SECRET Bearer token
  // 2. Allow dev_key bypass if in development OR ALLOW_DEV_ENDPOINTS is true
  const devBypass = devKey === env.DEV_SECRET;
  const isAuthorized = 
    authHeader === `Bearer ${env.CRON_SECRET}` || 
    ((!isProduction || allowDevEndpoints) && devBypass);
    
  if (!isAuthorized) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }
  
  try {
    // Process limit parameter
    const limit = limitParam ? parseInt(limitParam, 10) : 100;
    if (isNaN(limit) || limit < 1) {
      return NextResponse.json(
        { error: 'Invalid limit parameter' },
        { status: 400 }
      );
    }
    
    // Set processing options
    const options = {
      dryRun: isDryRun,
      limit,
      logLevel
    };
    
    // Start timestamp for performance measurement
    const startTime = Date.now();
    
    // Process the URL entities
    const results = await expandShortUrls(options);
    
    // Calculate processing time
    const processingTime = Date.now() - startTime;
    
    // Return results
    return NextResponse.json({
      status: 'success',
      dryRun: isDryRun,
      processingTime: `${processingTime}ms`,
      results
    });
    
  } catch (error) {
    console.error('Error in expand-urls API:', error);
    return NextResponse.json(
      { 
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        errorType: error instanceof Error ? error.name : 'Unknown'
      },
      { status: 500 }
    );
  }
}

// Optional POST method for more complex configurations
export async function POST(request: NextRequest) {
  try {
    // Verify authentication via headers
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const token = authHeader.split(' ')[1];
    const expectedToken = env.CRON_SECRET;
    
    if (!expectedToken || token !== expectedToken) {
      // Also allow DEV_SECRET in non-production or if dev endpoints allowed
      const isProduction = process.env.NODE_ENV === 'production';
      const allowDevEndpoints = env.ALLOW_DEV_ENDPOINTS || false;
      const isDevTokenValid = env.DEV_SECRET && token === env.DEV_SECRET;
      
      if (isProduction && !allowDevEndpoints || !isDevTokenValid) {
        return NextResponse.json(
          { error: 'Invalid token' },
          { status: 401 }
        );
      }
    }
    
    // Parse request body
    const body = await request.json();
    
    // Extract configuration from body
    const {
      dryRun = false,
      limit = 100,
      logLevel = 'summary'
    } = body;
    
    // Start timestamp for performance measurement
    const startTime = Date.now();
    
    // Process the URL entities
    const results = await expandShortUrls({
      dryRun,
      limit,
      logLevel
    });
    
    // Calculate processing time
    const processingTime = Date.now() - startTime;
    
    // Return results
    return NextResponse.json({
      status: 'success',
      dryRun,
      processingTime: `${processingTime}ms`,
      results
    });
    
  } catch (error) {
    console.error('Error in expand-urls API (POST):', error);
    return NextResponse.json(
      { 
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        errorType: error instanceof Error ? error.name : 'Unknown'
      },
      { status: 500 }
    );
  }
} 