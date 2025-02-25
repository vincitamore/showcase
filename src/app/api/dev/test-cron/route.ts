import { NextResponse } from 'next/server';
import { env } from '@/env';
import { logger } from '@/lib/logger';

// This is only enabled in development mode for testing cron jobs
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  // Only allow in development or with special override
  const isProduction = process.env.NODE_ENV === 'production';
  const allowDevEndpoints = env.ALLOW_DEV_ENDPOINTS || false;
  
  logger.info('Dev test endpoint accessed', {
    isProduction,
    allowDevEndpoints,
    url: req.url,
    method: req.method,
    headers: Object.fromEntries(req.headers.entries()),
    step: 'request-received'
  });
  
  if (isProduction && !allowDevEndpoints) {
    logger.warn('Dev endpoint access rejected', {
      isProduction,
      allowDevEndpoints,
      step: 'access-rejected'
    });
    
    return NextResponse.json(
      { error: { message: 'Not available in production', code: 'DISABLED' } },
      { status: 403 }
    );
  }

  // Check for dev secret
  const authHeader = req.headers.get('authorization');
  const devSecret = process.env.DEV_SECRET || env.CRON_SECRET;
  
  if (authHeader !== `Bearer ${devSecret}`) {
    logger.warn('Unauthorized dev endpoint access', {
      hasAuthHeader: !!authHeader,
      step: 'auth-check-failed'
    });
    
    return NextResponse.json(
      { error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } },
      { status: 401 }
    );
  }

  // Get target cron path from query param
  const { searchParams } = new URL(req.url);
  const cronPath = searchParams.get('path');

  if (!cronPath) {
    logger.warn('Missing path parameter', {
      step: 'param-check-failed'
    });
    
    return NextResponse.json(
      { error: { message: 'Missing path parameter', code: 'MISSING_PARAM' } },
      { status: 400 }
    );
  }

  // Log important environment variables (without exposing secrets)
  logger.info('Environment context', {
    environment: process.env.NODE_ENV,
    allowDevEndpoints,
    nextPublicUrl: process.env.NEXT_PUBLIC_URL,
    hasCronSecret: !!env.CRON_SECRET,
    hasDevSecret: !!process.env.DEV_SECRET,
    hasTwitterCredentials: {
      apiKey: !!env.TWITTER_API_KEY,
      apiSecret: !!env.TWITTER_API_SECRET,
      accessToken: !!env.TWITTER_ACCESS_TOKEN,
      accessSecret: !!env.TWITTER_ACCESS_SECRET,
      username: !!env.TWITTER_USERNAME
    },
    step: 'env-context'
  });

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

    // Fetch with detailed error handling
    let response;
    try {
      response = await fetch(cronReq);
    } catch (fetchError) {
      logger.error('Network error when calling cron endpoint', {
        error: fetchError instanceof Error ? {
          name: fetchError.name,
          message: fetchError.message,
          stack: fetchError.stack
        } : fetchError,
        path: cronPath,
        targetUrl
      });
      
      return NextResponse.json(
        { 
          error: { 
            message: 'Network error connecting to cron endpoint', 
            code: 'NETWORK_ERROR',
            details: fetchError instanceof Error ? fetchError.message : String(fetchError)
          } 
        },
        { status: 502 }
      );
    }
    
    // Detailed response logging
    logger.info('Cron endpoint response', { 
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries())
    });
    
    // Handle different response types
    let data;
    const contentType = response.headers.get('content-type');
    
    try {
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
        logger.info('Parsed JSON response data', { 
          dataKeys: Object.keys(data),
          hasError: !!data.error
        });
      } else {
        // Handle non-JSON responses
        const text = await response.text();
        logger.info('Received non-JSON response', { 
          contentType: contentType || 'unknown',
          textLength: text.length,
          textPreview: text.substring(0, 200)
        });
        
        data = {
          text,
          contentType: contentType || 'unknown'
        };
      }
    } catch (parseError) {
      logger.error('Error parsing response', { 
        error: parseError instanceof Error ? {
          name: parseError.name,
          message: parseError.message,
          stack: parseError.stack
        } : parseError,
        contentType,
        status: response.status
      });
      
      // Try to get the raw text as fallback
      try {
        const text = await response.clone().text();
        data = { 
          parseError: parseError instanceof Error ? parseError.message : String(parseError),
          rawText: text.substring(0, 1000) // Limit to avoid huge logs
        };
      } catch (textError) {
        data = { 
          parseError: parseError instanceof Error ? parseError.message : String(parseError),
          textError: textError instanceof Error ? textError.message : String(textError),
          unableToGetRawResponse: true
        };
      }
    }
    
    // Include additional response info
    const result = {
      status: 'success',
      cronResponse: data,
      responseStatus: response.status,
      responseInfo: {
        url: response.url,
        ok: response.ok,
        redirected: response.redirected,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries())
      }
    };
    
    // If the cron endpoint returned an error, log it
    if (response.status >= 400 || data?.error) {
      logger.warn('Cron endpoint returned an error', {
        status: response.status,
        statusText: response.statusText,
        error: data?.error,
        path: cronPath
      });
    }
    
    return NextResponse.json(result);
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
    
    // Provide detailed error information in the response
    const errorDetails = process.env.NODE_ENV !== 'production' || env.ALLOW_DEV_ENDPOINTS ? {
      message: error instanceof Error ? error.message : String(error),
      type: error instanceof Error ? error.constructor.name : typeof error,
      stack: error instanceof Error ? error.stack : undefined
    } : {
      message: 'Internal server error'
    };
    
    return NextResponse.json(
      { 
        error: { 
          message: 'Error executing cron job', 
          code: 'EXECUTION_ERROR',
          details: errorDetails
        } 
      },
      { status: 500 }
    );
  }
} 