import { NextRequest, NextResponse } from 'next/server';
import { recreateMissingEntities } from '@/lib/tweet-utils';

/**
 * API route for recreating tweet entities
 * This will scan tweets for @mentions, #hashtags and URLs and create
 * missing entities in the database
 * 
 * Query parameters:
 * - dev_key: Authentication key (required)
 * - test: Set to "true" for test mode (no database changes)
 * - limit: Max number of tweets to process (default: 100)
 * - logLevel: Logging detail level (none/summary/verbose)
 * - tweetIds: Comma-separated list of specific tweet IDs to process (optional)
 */
export async function GET(request: NextRequest) {
  // Parse query parameters
  const searchParams = request.nextUrl.searchParams;
  const devKey = searchParams.get('dev_key');
  const isDryRun = searchParams.get('test') === 'true';
  const limitParam = searchParams.get('limit');
  const logLevel = searchParams.get('logLevel') as 'none' | 'summary' | 'verbose' || 'summary';
  const tweetIdsParam = searchParams.get('tweetIds');
  
  // Verify authentication
  const expectedKey = process.env.CRON_SECRET || process.env.DEV_SECRET;
  if (!expectedKey || devKey !== expectedKey) {
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
    
    // Process tweet IDs if provided
    const tweetIds = tweetIdsParam ? tweetIdsParam.split(',') : undefined;
    
    // Set processing options
    const options = {
      dryRun: isDryRun,
      limit,
      logLevel
    };
    
    // Start timestamp for performance measurement
    const startTime = Date.now();
    
    // Process the tweets
    const results = await recreateMissingEntities(tweetIds, options);
    
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
    console.error('Error in recreate-entities API:', error);
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
    const expectedToken = process.env.CRON_SECRET || process.env.DEV_SECRET;
    
    if (!expectedToken || token !== expectedToken) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }
    
    // Parse request body
    const body = await request.json();
    
    // Extract configuration from body
    const {
      dryRun = false,
      limit = 100,
      logLevel = 'summary',
      tweetIds
    } = body;
    
    // Start timestamp for performance measurement
    const startTime = Date.now();
    
    // Process the tweets
    const results = await recreateMissingEntities(tweetIds, {
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
    console.error('Error in recreate-entities API (POST):', error);
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