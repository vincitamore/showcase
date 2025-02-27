import { NextResponse } from 'next/server';
import { getReadOnlyClient } from '@/lib/x-api';
import { 
  cacheTweets,
  getCachedTweets,
  updateSelectedTweets,
  scoreTweetRelevance,  
  SELECTED_TWEET_COUNT,
  FIFTEEN_MINUTES,
  DAILY_TWEET_FETCH_LIMIT,
  TECH_SCORE_THRESHOLD,
  getTwitterQuotaUsage,
  updateTwitterQuotaUsage
} from '@/lib/tweet-storage';
import { env } from '@/env';
import { TweetV2, TweetEntitiesV2, TweetEntityUrlV2, TwitterApiReadOnly, ApiResponseError } from 'twitter-api-v2';
import { 
  canMakeRequest,
  getRateLimit,
  updateRateLimit,
  MAX_TWEETS 
} from '@/lib/tweet-storage';
import { APIError, handleAPIError } from '@/lib/api-error';
import { logger, withLogging } from '@/lib/logger';
import { prisma } from '@/lib/db';

// Helper function to validate Twitter search query format
function validateTwitterQuery(query: string): { isValid: boolean; reason?: string } {
  if (!query || query.trim() === '') {
    return { isValid: false, reason: 'Query cannot be empty' };
  }
  
  // Check for query length limits (512 chars for basic/pro access)
  if (query.length > 512) {
    return { isValid: false, reason: 'Query exceeds 512 character limit' };
  }
  
  // Check for standalone operators
  // The from: operator is a valid standalone operator
  if (query.startsWith('from:')) {
    const usernameMatch = query.match(/^from:([a-zA-Z0-9_]+)/);
    if (!usernameMatch || !usernameMatch[1]) {
      return { isValid: false, reason: 'Username cannot be empty in from: operator' };
    }
    
    // We've already sanitized the username, so this should pass
    return { isValid: true };
  }
  
  // Check for other standalone operators
  const hasStandaloneOperator = 
    query.includes('from:') || 
    query.includes('@') || 
    query.includes('#') || 
    // Check for keywords (non-operator text)
    /[a-zA-Z0-9]+/.test(query.replace(/(-?from:|@|#|is:|has:|lang:)/g, ''));
  
  if (!hasStandaloneOperator) {
    return { 
      isValid: false, 
      reason: 'Query must contain at least one standalone operator (from:, @, #, or keywords)' 
    };
  }
  
  return { isValid: true };
}

// Helper function to validate tweet text and check for truncation
function validateTweetText(tweet: TweetV2): boolean {
  // Log warning if tweet appears to be truncated
  if (tweet.text.endsWith('…') && !tweet.text.endsWith('…https://')) {
    logger.warn('Tweet text appears to be truncated', {
      id: tweet.id,
      textLength: tweet.text.length,
      textEnd: tweet.text.substring(tweet.text.length - 20),
      step: 'tweet-text-validation'
    });
    return false;
  }
  return true;
}

type TweetWithEntities = {
  id: string;
  text: string;
  createdAt: Date;
  updatedAt: Date;
  publicMetrics: any;
  editHistoryTweetIds: string[];
  authorId: string;
  entities: Array<{
    id: string;
    type: string;
    text: string;
    url: string | null;
    expandedUrl: string | null;
    mediaKey: string | null;
    tweetId: string;
    metadata: any;
  }>;
};

type TwitterSearchResponse = {
  data: TweetV2[];
  meta: {
    result_count: number;
    newest_id: string;
    oldest_id: string;
    next_token?: string;
  };
  includes?: {
    users?: Array<{
    id: string;
    name: string;
    username: string;
    profile_image_url?: string;
    }>;
    media?: Array<{
      media_key: string;
      type: 'photo' | 'video' | 'animated_gif';
      url?: string;
      preview_image_url?: string;
    }>;
  };
};

// Convert database tweet to TweetV2 format
function convertToTweetV2(dbTweet: TweetWithEntities): TweetV2 {
  return {
    id: dbTweet.id,
    text: dbTweet.text,
    created_at: dbTweet.createdAt.toISOString(),
    edit_history_tweet_ids: dbTweet.editHistoryTweetIds,
    author_id: dbTweet.authorId,
    public_metrics: dbTweet.publicMetrics as any,
    entities: dbTweet.entities?.length ? {
      urls: dbTweet.entities.filter(e => e.type === 'url').map(e => ({
        start: 0,
        end: 0,
        url: e.url || '',
        expanded_url: e.expandedUrl || '',
        display_url: e.text || '',
        unwound_url: e.expandedUrl || '',
        media_key: e.mediaKey || undefined,
        status: (e.metadata as any)?.status?.toString(),
        title: (e.metadata as any)?.title?.toString(),
        description: (e.metadata as any)?.description?.toString(),
        images: (e.metadata as any)?.images || []
      } as TweetEntityUrlV2)),
      mentions: dbTweet.entities.filter(e => e.type === 'mention').map(e => ({
        start: 0,
        end: 0,
        username: e.text || '',
        id: (e.metadata as any)?.id?.toString() || ''
      })),
      hashtags: dbTweet.entities.filter(e => e.type === 'hashtag').map(e => ({
        start: 0,
        end: 0,
        tag: e.text || ''
      })),
      media: dbTweet.entities.filter(e => e.type === 'media').map(e => ({
        media_key: e.mediaKey || '',
        type: (e.metadata as any)?.type || 'photo',
        url: e.url || '',
        preview_image_url: (e.metadata as any)?.preview_image_url || e.url || '',
        width: (e.metadata as any)?.width,
        height: (e.metadata as any)?.height
      })),
      cashtags: [],
      annotations: []
    } as TweetEntitiesV2 : undefined
  };
}

export const dynamic = 'force-dynamic'
export const maxDuration = 58 // Just under Vercel's 60s limit

async function fetchTweetsHandler(req: Request): Promise<Response> {
  const startTime = Date.now();
  let cachedTweets: any[] = [];
  let response: any;
  let tweetPaginator: any;
  let extractedTweets: any[] = [];
  
  try {
    // Check for test mode via query param (development only)
    const url = new URL(req.url);
    const isTestMode = url.searchParams.get('test') === 'true';
    const devBypass = url.searchParams.get('dev_key') === env.DEV_SECRET;
    
    // Verify cron secret - allow bypass with correct dev_key if development or ALLOW_DEV_ENDPOINTS is enabled
    const authHeader = req.headers.get('authorization');
    const isProduction = process.env.NODE_ENV === 'production';
    const allowDevEndpoints = env.ALLOW_DEV_ENDPOINTS || false;
    
    // Check authorization:
    // 1. Always accept proper CRON_SECRET Bearer token
    // 2. Allow dev_key bypass if in development OR ALLOW_DEV_ENDPOINTS is true
    const isAuthorized = 
      authHeader === `Bearer ${env.CRON_SECRET}` || 
      ((!isProduction || allowDevEndpoints) && devBypass);
    
    logger.info('Authorization check', { 
      hasAuthHeader: !!authHeader, 
      isProduction, 
      allowDevEndpoints,
      isDevBypass: devBypass,
      isTestMode,
      isAuthorized,
      step: 'auth-check-details'
    });
    
    if (!isAuthorized) {
      logger.error('Unauthorized cron request', {
        hasAuth: !!authHeader,
        environment: process.env.NODE_ENV,
        allowDevEndpoints,
        step: 'auth-check'
      });
      return NextResponse.json(
        { error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } },
        { status: 401 }
      );
    }

    // Log test mode usage
    if (isTestMode || devBypass) {
      logger.info('Running in test mode', { 
        isTestMode, 
        devBypass,
        step: 'test-mode' 
      });
    }

    logger.info('Starting tweet fetch', { step: 'start' });

    // Check cache first
    const { tweets } = await getCachedTweets('current').catch(error => {
      logger.error('Failed to fetch cached tweets', {
        step: 'cache-fetch',
        error
      });
      throw new APIError('Failed to fetch cached tweets', 500, 'CACHE_ERROR');
    });
    cachedTweets = tweets;

    // Check if we already fetched tweets today to respect the daily limit
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const latestCache = await prisma.tweetCache.findFirst({
      where: {
        type: 'current',
        createdAt: {
          gte: today
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    // Count how many times we've fetched tweets today
    const fetchCountToday = await prisma.tweetCache.count({
      where: {
        type: 'current',
        createdAt: {
          gte: today
        }
      }
    });
    
    // Check both daily fetch limit and monthly quota
    const dailyQuotaInfo = await getTwitterQuotaUsage();
    const monthlyQuotaExceeded = dailyQuotaInfo.used >= dailyQuotaInfo.limit;
    
    logger.info('Checking quota limits', { 
      fetchCountToday,
      dailyLimit: DAILY_TWEET_FETCH_LIMIT,
      monthlyQuotaUsed: dailyQuotaInfo.used,
      monthlyQuotaLimit: dailyQuotaInfo.limit,
      dailyLimitReached: fetchCountToday >= DAILY_TWEET_FETCH_LIMIT,
      monthlyQuotaExceeded,
      step: 'quota-limit-check'
    });
    
    // If we've already hit our daily limit or monthly quota, just use cached tweets
    if (fetchCountToday >= DAILY_TWEET_FETCH_LIMIT || monthlyQuotaExceeded) {
      logger.info('Quota limit reached, using cache', {
        fetchCountToday,
        dailyLimit: DAILY_TWEET_FETCH_LIMIT,
        monthlyQuotaUsed: dailyQuotaInfo.used,
        monthlyQuotaLimit: dailyQuotaInfo.limit,
        cachedTweetCount: cachedTweets.length,
        reason: monthlyQuotaExceeded ? 'Monthly quota exceeded' : 'Daily limit reached',
        step: 'quota-limit-reached'
      });
      
      // Still select a fresh set of tweets to display, even if we don't fetch new ones
      await selectTweetsForDisplay(cachedTweets);
      
      return NextResponse.json({
        status: 'success',
        tweetCount: cachedTweets.length,
        source: 'cache',
        quotaLimits: {
          daily: {
            used: fetchCountToday,
            limit: DAILY_TWEET_FETCH_LIMIT,
            exceeded: fetchCountToday >= DAILY_TWEET_FETCH_LIMIT
          },
          monthly: {
            used: dailyQuotaInfo.used,
            limit: dailyQuotaInfo.limit,
            exceeded: monthlyQuotaExceeded
          }
        }
      });
    }

    // If we have enough recent tweets, skip the API call
    if (cachedTweets.length >= MAX_TWEETS) {
      const mostRecentTweet = cachedTweets[0];
      const cacheAge = Date.now() - new Date(mostRecentTweet.createdAt).getTime();

      // If cache is less than 15 minutes old, skip update
      if (cacheAge < FIFTEEN_MINUTES) {
        logger.info('Using recent cache', {
          step: 'using-cache',
          tweetCount: cachedTweets.length,
          cacheAgeMinutes: Math.floor(cacheAge / 60000)
        });
        
        // Still select a fresh set of tweets to display
        await selectTweetsForDisplay(cachedTweets);
        
        return NextResponse.json({
          status: 'success',
          tweetCount: cachedTweets.length,
          source: 'cache'
        });
      }
    }

    // Initialize Twitter client with detailed error handling
    let client: TwitterApiReadOnly;
    try {
      // Log environment variable presence (not values)
      logger.info('Twitter API environment variables', {
        hasApiKey: !!env.TWITTER_API_KEY,
        hasApiSecret: !!env.TWITTER_API_SECRET,
        hasAccessToken: !!env.TWITTER_ACCESS_TOKEN,
        hasAccessSecret: !!env.TWITTER_ACCESS_SECRET,
        hasUsername: !!env.TWITTER_USERNAME,
        step: 'twitter-env-check'
      });
      
      client = await getReadOnlyClient();
      logger.info('Twitter client initialized successfully', { step: 'client-init-success' });
    } catch (initError) {
      logger.error('Failed to initialize Twitter client', {
        step: 'client-init-failure',
        error: initError instanceof Error ? {
          name: initError.name,
          message: initError.message,
          stack: initError.stack
        } : String(initError)
      });
      throw new APIError('Failed to initialize Twitter client', 500, 'TWITTER_CLIENT_ERROR');
    }
    
    // Get user info for query
    const username = env.TWITTER_USERNAME?.replace('@', '');
    if (!username) {
      logger.error('Twitter username not configured', {
        step: 'config-check'
      });
      throw new APIError('Twitter username not configured', 500, 'CONFIG_ERROR');
    }

    // Log the actual username for debugging
    logger.info('Twitter username details', {
      step: 'username-debug',
      username,
      length: username.length,
      charCodes: Array.from(username).map(c => c.charCodeAt(0))
    });

    // Sanitize the username to ensure it only contains valid characters
    const sanitizedUsername = username.replace(/[^\w]/g, '');
    
    // Log the sanitized username
    logger.info('Sanitized username', {
      step: 'username-sanitize',
      original: username,
      sanitized: sanitizedUsername
    });

    // Use the sanitized username in the query
    const query = `from:${sanitizedUsername.trim()} -is:retweet`;
    
    logger.info('Using Twitter query', {
      step: 'query-preparation',
      query,
      username: sanitizedUsername.trim()
    });
    
    // Validate query format
    const queryValidation = validateTwitterQuery(query);
    if (!queryValidation.isValid) {
      logger.error('Invalid Twitter query format', {
        step: 'query-validation',
        query,
        reason: queryValidation.reason
      });
      throw new APIError(
        `Invalid Twitter query format: ${queryValidation.reason}`,
        400,
        'INVALID_QUERY_FORMAT'
      );
    }
    
    // Wrap the rate limit check in a try-catch for more detailed error info
    try {
      // Check if we can make the request - update the endpoint path to match the v2 path
      const canMakeReq = await canMakeRequest('tweets/search/recent');
      
      if (!canMakeReq) {
        const rateLimit = await getRateLimit('tweets/search/recent');
        const resetAt = new Date(rateLimit.resetAt);
        
        logger.warn('Rate limited, using cache', {
          step: 'rate-limited',
          endpoint: 'tweets/search/recent',
          resetAt: resetAt.toISOString(),
          remaining: rateLimit.remaining,
          cachedTweetCount: cachedTweets.length
        });

        // Return cached tweets if available
        if (cachedTweets.length > 0) {
          await selectTweetsForDisplay(cachedTweets);
          
          // Get current quota usage
          const quotaUsage = await getTwitterQuotaUsage();
          
          return NextResponse.json({
            message: 'Rate limit exceeded, returning cached tweets',
            tweets: cachedTweets,
            quotaUsage: {
              used: quotaUsage.used,
              limit: quotaUsage.limit,
              remaining: quotaUsage.limit - quotaUsage.used
            }
          }, { status: 200 });
        }

        // Get current quota usage
        const quotaUsage = await getTwitterQuotaUsage();
        
        return NextResponse.json({
          message: 'Rate limit exceeded and no cached tweets available',
          error: 'RATE_LIMIT_EXCEEDED',
          quotaUsage: {
            used: quotaUsage.used,
            limit: quotaUsage.limit,
            remaining: quotaUsage.limit - quotaUsage.used
          }
        }, { status: 429 });
      }
    } catch (rateLimitError) {
      logger.error('Error checking rate limit', {
        step: 'rate-limit-check-error',
        error: rateLimitError instanceof Error ? {
          name: rateLimitError.name,
          message: rateLimitError.message,
          stack: rateLimitError.stack
        } : String(rateLimitError)
      });
      throw new APIError('Failed to check rate limit', 500, 'RATE_LIMIT_CHECK_ERROR');
    }

    // Prepare search parameters - request exactly what we'll store
    // to optimize our monthly post quota usage
    const searchParams: any = {
      max_results: DAILY_TWEET_FETCH_LIMIT, // Request exactly what we need
      'tweet.fields': 'created_at,public_metrics,entities,author_id,attachments,text', // Explicitly request full text
      'user.fields': 'profile_image_url,username',
      'media.fields': 'url,preview_image_url,alt_text,type,width,height,duration_ms,variants',
      'expansions': 'author_id,attachments.media_keys,entities.mentions.username,referenced_tweets.id'
    };

    // If we have cached tweets, only fetch newer ones
    if (cachedTweets.length > 0) {
      const mostRecentTweet = cachedTweets[0];
      searchParams.since_id = mostRecentTweet.id;
    }

    // Make the API request
    logger.info('Making search request', {
      step: 'search-start',
      query,
      sinceId: searchParams.since_id,
      params: searchParams
    });

    // Fix: Use client.v2.search instead of client.get for recent search endpoint
    
    try {
      logger.info('Sending request to Twitter API', { 
        step: 'twitter-request-start',
        endpoint: 'tweets/search/recent',
        query
      });
      
      // Verify client is properly initialized
      if (!client || !client.v2) {
        logger.error('Twitter client not properly initialized', {
          step: 'client-check',
          hasClient: !!client,
          hasV2: client ? !!client.v2 : false
        });
        throw new APIError('Twitter client not properly initialized', 500, 'CLIENT_INITIALIZATION_ERROR');
      }
      
      // Use client.v2.search which is the correct method for the Twitter API v2 search endpoint
      // Ensure all parameters are properly formatted according to the Twitter API v2 documentation
      response = await client.v2.search(query, {
        max_results: DAILY_TWEET_FETCH_LIMIT, // Request exactly what we need
        'tweet.fields': 'created_at,public_metrics,entities,author_id,attachments,text', // Explicitly request full text
        'user.fields': 'profile_image_url,username',
        'media.fields': 'url,preview_image_url,alt_text,type,width,height,duration_ms,variants',
        'expansions': 'author_id,attachments.media_keys,entities.mentions.username,referenced_tweets.id'
      });
      
      // Extract tweets from the paginator
      tweetPaginator = response;
      
      // Add detailed logging of the paginator structure
      logger.info('Twitter API paginator structure', {
        step: 'paginator-structure',
        paginatorKeys: Object.keys(tweetPaginator),
        hasTweets: !!tweetPaginator.tweets,
        hasData: !!tweetPaginator.data,
        hasMeta: !!tweetPaginator.meta,
        hasIncludes: !!tweetPaginator.includes,
        hasRateLimit: !!tweetPaginator.rateLimit,
        hasFetchNext: typeof tweetPaginator.fetchNext === 'function',
        hasNext: typeof tweetPaginator.next === 'function',
        hasRealData: !!tweetPaginator._realData,
        realDataKeys: tweetPaginator._realData ? Object.keys(tweetPaginator._realData) : []
      });
      
      // Simplify tweet extraction logic to be more consistent
      let extractedTweets: TweetV2[] = [];
      
      if (tweetPaginator.data && Array.isArray(tweetPaginator.data)) {
        extractedTweets = tweetPaginator.data;
        logger.info('Found tweets in paginator.data array', {
          step: 'tweets-location',
          count: extractedTweets.length
        });
      } else if (tweetPaginator.tweets && Array.isArray(tweetPaginator.tweets)) {
        extractedTweets = tweetPaginator.tweets;
        logger.info('Found tweets in paginator.tweets array', {
          step: 'tweets-location',
          count: extractedTweets.length
        });
      } else if (tweetPaginator._realData && tweetPaginator._realData.data && Array.isArray(tweetPaginator._realData.data)) {
        extractedTweets = tweetPaginator._realData.data;
        logger.info('Found tweets in paginator._realData.data array', {
          step: 'tweets-location',
          count: extractedTweets.length
        });
      }
      
      logger.info('Extracted tweets', {
        count: extractedTweets.length,
        step: 'tweets-extraction'
      });
      
      // Analyze tweet text lengths
      let totalTextLength = 0;
      let tweetCount = 0;
      let longTweetCount = 0;
      
      for (const tweet of extractedTweets) {
        totalTextLength += tweet.text.length;
        tweetCount++;
        if (tweet.text.length > 280) {
          longTweetCount++;
          logger.info('Processing long tweet', {
            id: tweet.id,
            length: tweet.text.length,
            step: 'long-tweet-processing'
          });
        }
      }
      
      logger.info('Tweet length statistics', {
        totalTweets: tweetCount,
        longTweets: longTweetCount,
        averageLength: tweetCount ? Math.round(totalTextLength / tweetCount) : 0,
        step: 'tweet-length-stats'
      });
      
      // Add detailed response logging
      logger.info('Twitter API raw response structure', {
        step: 'twitter-response-structure',
        hasData: !!response.data,
        hasErrors: !!response.errors?.length,
        responseKeys: Object.keys(response),
        dataKeys: response.data ? Object.keys(response.data) : [],
        metaKeys: response.meta ? Object.keys(response.meta) : [],
        includesKeys: response.includes ? Object.keys(response.includes) : []
      });
      
      // Log any errors in the response
      if (response.errors?.length) {
        logger.warn('Twitter API returned errors in response', {
          step: 'twitter-response-errors',
          errors: response.errors
        });
      }
      
      // Validate response structure - twitter-api-v2 client returns a paginator object
      // The actual tweets are in the .data property of the paginator
      if (!response || !extractedTweets) {
        logger.error('Twitter API response missing data', {
          step: 'response-validation',
          responseType: typeof response,
          hasData: !!response?.data,
          hasTweets: !!extractedTweets
        });
        throw new APIError('Twitter API response missing data', 500, 'INVALID_RESPONSE_FORMAT');
      }
      
      logger.info('Twitter API request successful', { 
        step: 'twitter-request-success',
        hasData: !!response.data,
        dataCount: extractedTweets.length,
        hasMeta: !!response.meta,
        hasIncludes: !!response.includes,
        rateLimit: response.rateLimit ? {
          remaining: response.rateLimit.remaining,
          reset: response.rateLimit.reset
        } : null
      });
      
      // Log quota usage
      logger.info('Twitter API quota usage', {
        step: 'quota-tracking',
        requestedTweets: DAILY_TWEET_FETCH_LIMIT,
        receivedTweets: extractedTweets.length,
        monthlyQuota: 100, // Total monthly post quota
        quotaUsage: `${extractedTweets.length}/100 posts for this request`
      });
      
      // Update quota usage in the database
      if (extractedTweets.length > 0) {
        try {
          const quotaUsage = await updateTwitterQuotaUsage(extractedTweets.length);
          
          logger.info('Twitter API quota usage updated in database', {
            step: 'quota-tracking-db',
            requestedTweets: DAILY_TWEET_FETCH_LIMIT,
            receivedTweets: extractedTweets.length,
            totalUsed: quotaUsage.used,
            monthlyLimit: quotaUsage.limit,
            quotaUsage: `${quotaUsage.used}/${quotaUsage.limit} posts this month`,
            remaining: quotaUsage.limit - quotaUsage.used
          });
        } catch (quotaError) {
          logger.error('Error updating Twitter quota usage', {
            step: 'quota-tracking-error',
            error: quotaError instanceof Error ? quotaError.message : String(quotaError),
            receivedTweets: extractedTweets.length
          });
        }
      }
    } catch (twitterError: unknown) {
      const errorMessage = twitterError instanceof Error 
        ? twitterError.message 
        : String(twitterError);
        
      // Log the full error object for detailed inspection
      logger.error('Twitter API request failed', {
        step: 'twitter-request-error',
        error: errorMessage,
        query,
        errorObject: twitterError instanceof Error ? {
          name: twitterError.name,
          message: twitterError.message,
          stack: twitterError.stack,
          // For ApiResponseError, include additional details
          ...(twitterError instanceof ApiResponseError ? {
            code: twitterError.code,
            data: twitterError.data,
            rateLimit: twitterError.rateLimit,
            request: {
              method: twitterError.request?.method,
              urlPath: twitterError.request ? String(twitterError.request) : undefined
            },
            headers: twitterError.headers
          } : {})
        } : twitterError
      });
      
      // Check if this is a rate limit error (429)
      if (twitterError instanceof ApiResponseError && twitterError.code === 429) {
        logger.warn('Twitter API rate limit exceeded', {
          step: 'rate-limit-exceeded',
          resetAt: twitterError.rateLimit?.reset ? new Date(twitterError.rateLimit.reset * 1000).toISOString() : 'unknown',
          endpoint: 'tweets/search/recent'
        });
        
        // Return cached tweets if available
        if (cachedTweets.length > 0) {
          await selectTweetsForDisplay(cachedTweets);
          return NextResponse.json({
            message: 'Rate limit exceeded, returning cached tweets',
            tweets: cachedTweets
          }, { status: 200 });
        }
        
        return NextResponse.json({
          message: 'Rate limit exceeded and no cached tweets available',
          error: 'RATE_LIMIT_EXCEEDED'
        }, { status: 429 });
      }
      
      // Handle other specific error types
      if (twitterError instanceof ApiResponseError && twitterError.code === 400) {
        // Enhanced logging for 400 errors
        const errorDetails = {
          step: 'bad-request-detailed',
          query,
          username: {
            original: username,
            sanitized: sanitizedUsername,
            length: username.length,
            sanitizedLength: sanitizedUsername.length,
            charCodes: Array.from(username).map(c => c.charCodeAt(0))
          },
          errors: twitterError.data?.errors || [],
          title: twitterError.data?.title,
          detail: twitterError.data?.detail,
          parameters: {
            requestedParams: {
              query,
              max_results: 10,
              'tweet.fields': 'created_at,public_metrics',
              'user.fields': 'username'
            },
            headers: twitterError.headers || {},
            requestUrl: twitterError.request ? String(twitterError.request) : undefined
          }
        };
        
        logger.error('Twitter API bad request - detailed', errorDetails);
        
        throw new APIError(
          `Twitter API bad request: ${twitterError.data?.detail || errorMessage}. Error details: ${JSON.stringify(errorDetails)}`,
          400,
          'TWITTER_BAD_REQUEST'
        );
      }
      
      // Extract status code if available
      let externalApiStatus: number | null = null;
      if (twitterError instanceof Error) {
        // Try to extract status code from error message
        const statusMatch = errorMessage.match(/(\d{3})/);
        if (statusMatch && statusMatch[1]) {
          externalApiStatus = parseInt(statusMatch[1]);
        }
        
        // Check for specific error types in the message
        if (errorMessage.includes('429') || errorMessage.includes('rate limit')) {
          externalApiStatus = 429;
          // Add external API status to the log
          logger.error('Twitter API rate limit exceeded', {
            externalApiStatus,
            errorMessage
          });
          throw new APIError(
            `Twitter API rate limit exceeded (429)`, 
            429, 
            'TWITTER_RATE_LIMIT'
          );
        }
        
        // Check for 400 Bad Request errors - likely invalid query format
        if (errorMessage.includes('400') || errorMessage.toLowerCase().includes('bad request')) {
          externalApiStatus = 400;
          logger.error('Twitter API bad request error - likely invalid query format', {
            externalApiStatus,
            errorMessage,
            query,
            searchParams
          });
          throw new APIError(
            `Twitter API bad request error (400) - Check query format: ${query}`, 
            400, 
            'TWITTER_BAD_REQUEST'
          );
        }
        
        // Check if this is a network error
        if (errorMessage.includes('network error') || 
            errorMessage.includes('timeout') ||
            errorMessage.includes('Request failed')) {
          // Add external API status to the log
          logger.error('Twitter API network error', {
            externalApiStatus,
            errorMessage
          });
          throw new APIError(
            `Twitter API connection error (timeout or network issue)${externalApiStatus ? ` - Status: ${externalApiStatus}` : ''}`, 
            500, 
            'TWITTER_NETWORK_ERROR'
          );
        }
      }
      
      // Re-throw the error for the main error handler with the status code
      if (externalApiStatus && twitterError instanceof Error) {
        logger.error('Twitter API error with status code', {
          externalApiStatus,
          errorMessage
        });
        throw new APIError(
          `Twitter API error: ${errorMessage} - Status: ${externalApiStatus}`, 
          500, 
          'TWITTER_API_ERROR'
        );
      } else {
        throw twitterError;
      }
    }

    // Update rate limit after successful request
    if (response.rateLimit) {
      const remainingRequests = parseInt(response.rateLimit.remaining.toString());
      const rateLimitReset = new Date(parseInt(response.rateLimit.reset.toString()) * 1000);

      await updateRateLimit('tweets/search/recent', rateLimitReset, remainingRequests);

      logger.debug('Updated rate limits', {
        step: 'rate-limit-update',
        endpoint: 'tweets/search/recent',
        remaining: remainingRequests,
        resetAt: rateLimitReset.toISOString()
      });
    }

    // Get tweets from the response - handle paginator response structure
    // The twitter-api-v2 client returns a paginator object where the tweets are in the .data property
    // We already extracted the tweets earlier
    const newTweets = extractedTweets;
    
    // Log the actual structure of the response for debugging
    logger.info('Twitter API response structure details', {
      step: 'response-structure-debug',
      responseType: typeof response,
      isPaginator: typeof response.fetchNext === 'function',
      hasTweets: Array.isArray(extractedTweets),
      tweetsLength: extractedTweets.length,
      hasData: !!response.data,
      hasMeta: !!response.meta,
      hasIncludes: !!response.includes,
      sampleTweet: extractedTweets.length > 0 ? 
        { 
          id: extractedTweets[0]?.id || 'unknown', 
          text: extractedTweets[0]?.text?.substring(0, 50) || 'no text' 
        } : 'no tweets'
    });
    
    if (!newTweets.length) {
      logger.info('No new tweets found', {
        step: 'no-new-tweets',
        cachedCount: cachedTweets.length
      });
      
      // Still refresh the selected tweets from cache
      await selectTweetsForDisplay(cachedTweets);
      
      return NextResponse.json({
        status: 'success',
        tweetCount: cachedTweets.length,
        newTweets: 0,
        source: 'cache'
      });
    }

    logger.info('Search complete', {
      step: 'search-complete',
      newTweetCount: newTweets.length
    });

    // Score tweets by tech relevance
    const scoredTweets = newTweets.map((tweet: TweetV2) => ({
      tweet,
      score: scoreTweetRelevance(tweet)
    }));
    
    // Define interface for scored tweet
    interface ScoredTweet {
      tweet: TweetV2;
      score: number;
    }
    
    // Log tech scores
    logger.info('Tweet tech relevance scores', {
      scores: scoredTweets.map((t: ScoredTweet) => ({
        id: t.tweet.id,
        score: t.score,
        text: t.tweet.text.substring(0, 50) + (t.tweet.text.length > 50 ? '...' : '')
      })),
      step: 'tech-scoring'
    });
    
    // Note: We're now requesting exactly DAILY_TWEET_FETCH_LIMIT tweets from the API
    // to optimize our monthly post quota (100 posts/month). Each tweet returned counts
    // against this quota, so we only request what we'll actually store.
    
    // First take high-quality tech tweets
    const highQualityTweets = scoredTweets
      .filter((t: ScoredTweet) => t.score >= TECH_SCORE_THRESHOLD)
      .map((t: ScoredTweet) => t.tweet);
    
    // If we need more to meet our daily limit, add lower quality tweets sorted by score
    let selectedNewTweets = highQualityTweets;
    if (highQualityTweets.length < DAILY_TWEET_FETCH_LIMIT) {
      const lowerQualityNeeded = DAILY_TWEET_FETCH_LIMIT - highQualityTweets.length;
      const lowerQualityTweets = scoredTweets
        .filter((t: ScoredTweet) => t.score < TECH_SCORE_THRESHOLD)
        .sort((a: ScoredTweet, b: ScoredTweet) => b.score - a.score) // Higher score first
        .slice(0, lowerQualityNeeded)
        .map((t: ScoredTweet) => t.tweet);
      
      selectedNewTweets = [...highQualityTweets, ...lowerQualityTweets];
    } else if (highQualityTweets.length > DAILY_TWEET_FETCH_LIMIT) {
      // If we have more quality tweets than our limit, take the highest scoring ones
      selectedNewTweets = scoredTweets
        .sort((a: ScoredTweet, b: ScoredTweet) => b.score - a.score)
        .slice(0, DAILY_TWEET_FETCH_LIMIT)
        .map((t: ScoredTweet) => t.tweet);
    }
    
    logger.info('Selected tweets to cache', {
      highQualityCount: highQualityTweets.length,
      selectedCount: selectedNewTweets.length,
      dailyLimit: DAILY_TWEET_FETCH_LIMIT,
      ids: selectedNewTweets.map((t: TweetV2) => t.id),
      step: 'tweet-selection'
    });

    // Merge with existing tweets if needed
    const tweetsToCache = searchParams.since_id
      ? [...selectedNewTweets, ...cachedTweets].slice(0, MAX_TWEETS)
      : selectedNewTweets;

    // Log the includes object for debugging
    logger.info('Twitter API response includes', {
      step: 'includes-debug',
      hasIncludes: !!response.includes,
      includesKeys: response.includes ? Object.keys(response.includes) : [],
      mediaCount: response.includes?.media?.length || 0,
      usersCount: response.includes?.users?.length || 0,
      hasRealDataIncludes: !!tweetPaginator._realData?.includes,
      realDataIncludesKeys: tweetPaginator._realData?.includes ? Object.keys(tweetPaginator._realData.includes) : []
    });

    // Get the includes from the best available source
    const includes = response.includes || tweetPaginator._realData?.includes || {};

    // Cache the tweets
    await processTweetsForCache(tweetsToCache, 'current', includes);
    
    // Select tweets for display
    await selectTweetsForDisplay([...tweetsToCache]);

    // Get current quota usage
    const quotaUsage = await getTwitterQuotaUsage();

    return NextResponse.json({
      status: 'success',
      tweetCount: tweetsToCache.length,
      filteredCount: selectedNewTweets.length,
      highQualityCount: highQualityTweets.length,
      totalNewTweets: newTweets.length,
      source: 'api',
      quotaUsage: {
        used: quotaUsage.used,
        limit: quotaUsage.limit,
        remaining: quotaUsage.limit - quotaUsage.used
      }
    });

  } catch (error) {
    // Enhanced error logging with detailed information
    logger.error('Error in tweet fetch', {
      step: 'error',
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : 'No stack trace',
      errorDetails: error instanceof ApiResponseError ? {
        rateLimit: error.rateLimit,
        request: error.request,
        headers: error.headers,
        data: error.data
      } : error,
      duration: Date.now() - startTime
    });
    
    if (error instanceof APIError) {
      return NextResponse.json(
        {
          error: {
            message: error.message,
            code: error.code
          }
        },
        { status: error.statusCode }
      );
    }

    // Include more error details in the response for debugging
    const errorDetails = process.env.NODE_ENV !== 'production' || env.ALLOW_DEV_ENDPOINTS ? {
      message: error instanceof Error ? error.message : 'Unknown error',
      type: error instanceof Error ? error.constructor.name : typeof error,
      stack: error instanceof Error ? error.stack : undefined
    } : {
      message: 'Internal server error',
    };

    return NextResponse.json(
      {
        error: {
          message: 'Internal server error',
          code: 'INTERNAL_SERVER_ERROR',
          details: errorDetails
        }
      },
      { status: 500 }
    );
  }
}

// Wrap the handler with logging and ensure it returns Response
export const GET = withLogging(fetchTweetsHandler, 'api/cron/fetch-tweets'); 

// New helper function to select and update tweets for display
async function selectTweetsForDisplay(tweets: TweetV2[]) {
  try {
    logger.info('Selecting tweets for display', { 
      totalTweets: tweets.length,
      step: 'selection-start'
    });
    
    // Score tweets for tech relevance
    const scoredTweets = tweets.map(tweet => ({
      tweet,
      score: scoreTweetRelevance(tweet),
      // For tweets created within the last week, give them a freshness boost
      freshness: tweet.created_at ? 
        Math.max(0, 7 - (Date.now() - new Date(tweet.created_at).getTime()) / (24 * 60 * 60 * 1000)) / 7 :
        0
    }));
    
    // Log the scoring results
    logger.info('Tweet scoring results', {
      scores: scoredTweets.map(t => ({
        id: t.tweet.id,
        score: t.score,
        freshness: t.freshness,
        combined: t.score * 0.7 + t.freshness * 0.3,
        text: t.tweet.text.substring(0, 50) + (t.tweet.text.length > 50 ? '...' : '')
      })),
      step: 'tweet-scoring'
    });
    
    // First, prioritize tech-relevant tweets (score above threshold)
    const qualityTweets = scoredTweets.filter(t => t.score >= TECH_SCORE_THRESHOLD);
    
    // If we don't have enough quality tweets, include some lower-scored ones
    let selectedTweets = qualityTweets;
    if (qualityTweets.length < SELECTED_TWEET_COUNT) {
      const remainingCount = SELECTED_TWEET_COUNT - qualityTweets.length;
      const lowerQualityTweets = scoredTweets
        .filter(t => t.score < TECH_SCORE_THRESHOLD)
        .sort((a, b) => b.score - a.score) // Higher score first
        .slice(0, remainingCount);
      
      selectedTweets = [...qualityTweets, ...lowerQualityTweets];
    }
    
    // Final sorting: combine tech score (70%) with freshness (30%)
    selectedTweets.sort((a, b) => {
      const scoreA = a.score * 0.7 + a.freshness * 0.3;
      const scoreB = b.score * 0.7 + b.freshness * 0.3;
      return scoreB - scoreA; // Higher combined score first
    });
    
    // Select the top tweets up to our limit
    const finalSelection = selectedTweets.slice(0, SELECTED_TWEET_COUNT).map(t => t.tweet.id);
    
    // Update the selected tweets in the database
    await updateSelectedTweets(finalSelection);
    
    logger.info('Selected tweets for display', {
      selectedCount: finalSelection.length,
      qualityTweetCount: qualityTweets.length,
      ids: finalSelection,
      step: 'selection-complete'
    });
    
    return finalSelection;
  } catch (error) {
    logger.error('Error selecting tweets for display', {
      error: error instanceof Error ? error.message : 'Unknown error',
      step: 'selection-error'
    });
    throw error;
  }
}

// Improve the processTweetsForCache function to properly handle JSON data
async function processTweetsForCache(tweets: TweetV2[], type: string, includes?: any) {
  try {
    logger.info(`Processing ${tweets.length} tweets of type ${type}`);
    
    // Get existing tweets to avoid duplicates
    const existingTweets = await prisma.tweet.findMany({
      where: {
        id: {
          in: tweets.map(t => t.id)
        }
      },
      include: {
        entities: true
      }
    });
    
    logger.info('Found existing tweets', {
      existingCount: existingTweets.length,
      newCount: tweets.length,
      timestamp: new Date().toISOString(),
      step: 'tweets-found'
    });
    
    // Process each tweet
    const tweetRecords = [];
    
    // Get the username directly from environment - this is the user we're searching for
    // So we know all tweets are from this user
    const username = env.TWITTER_USERNAME?.replace('@', '') || 'unknown';
    
    logger.info('Using username as authorId for all tweets', {
      username,
      step: 'using-username-as-authorid'
    });
    
    for (const tweet of tweets) {
      try {
        // Validate tweet text and log info about it
        validateTweetText(tweet);
        
        // Log info about the tweet text
        logger.info('Tweet text info', {
          id: tweet.id,
          textLength: tweet.text.length,
          textSnippet: tweet.text.substring(0, 50) + (tweet.text.length > 50 ? '...' : ''),
          step: 'text-processing'
        });
        
        // Convert Twitter API date format to Date object
        const createdAt = tweet.created_at ? new Date(tweet.created_at) : new Date();
        
        // Log the date for debugging
        logger.info('Tweet date info', {
          id: tweet.id,
          created_at: tweet.created_at,
          parsedDate: createdAt.toISOString(),
          step: 'date-parsing'
        });
        
        // Process entities if present
        const entitiesData = [];
        
        if (tweet.entities) {
          // Process URLs
          if (tweet.entities.urls?.length) {
            for (const url of tweet.entities.urls) {
              entitiesData.push({
                type: 'url',
                text: url.display_url || url.url,
                url: url.url,
                expandedUrl: url.expanded_url,
                mediaKey: url.media_key,
                // Convert metadata to a Prisma-compatible JSON format
                metadata: {
                  status: url.status || null,
                  title: url.title || null,
                  description: url.description || null,
                  images: url.images || []
                } as any // Use type assertion to satisfy TypeScript
              });
            }
          }
          
          // Process mentions
          if (tweet.entities.mentions?.length) {
            for (const mention of tweet.entities.mentions) {
              entitiesData.push({
                type: 'mention',
                text: mention.username,
                // Convert metadata to a Prisma-compatible JSON format
                metadata: {
                  id: mention.id || null
                } as any // Use type assertion to satisfy TypeScript
              });
            }
          }
          
          // Process hashtags
          if (tweet.entities.hashtags?.length) {
            for (const hashtag of tweet.entities.hashtags) {
              entitiesData.push({
                type: 'hashtag',
                text: hashtag.tag
              });
            }
          }
        }
        
        // Process media from includes if present
        const mediaKeys = tweet.attachments?.media_keys || [];
        if (includes?.media && mediaKeys.length > 0) {
          const mediaItems = includes.media.filter((m: any) => 
            mediaKeys.includes(m.media_key)
          );
          
          for (const media of mediaItems) {
            entitiesData.push({
              type: 'media',
              text: media.alt_text || '',
              url: media.url || media.preview_image_url,
              mediaKey: media.media_key,
              // Convert metadata to a Prisma-compatible JSON format
              metadata: {
                type: media.type || null,
                width: media.width || null,
                height: media.height || null,
                preview_image_url: media.preview_image_url || null,
                duration_ms: media.duration_ms || null
              } as any // Use type assertion to satisfy TypeScript
            });
          }
        }
        
        // Check if tweet already exists
        const existingTweet = existingTweets.find(t => t.id === tweet.id);
        
        if (existingTweet) {
          logger.info(`Tweet ${tweet.id} already exists with ${existingTweet.entities.length} entities`);
          
          // Keep the original createdAt date if it exists and is valid
          const finalCreatedAt = existingTweet.createdAt && !isNaN(new Date(existingTweet.createdAt).getTime())
            ? existingTweet.createdAt
            : createdAt;
          
          // Filter out entities that already exist
          const newEntities = entitiesData.filter(newEntity => 
            !existingTweet.entities.some((existingEntity: any) => 
              existingEntity.type === newEntity.type && 
              existingEntity.text === newEntity.text
            )
          );
          
          logger.info(`Adding ${newEntities.length} new entities to tweet ${tweet.id}`, {
            existingEntities: existingTweet.entities.length,
            newEntitiesBeforeFilter: entitiesData.length,
            newEntitiesAfterFilter: newEntities.length,
            step: 'entity-filtering'
          });
          
          // Update the tweet but preserve entities - DO NOT use entities: { set: [] } which would delete existing entities
          const updatedTweet = await prisma.tweet.update({
            where: { id: tweet.id },
            data: {
              text: tweet.text,
              createdAt: finalCreatedAt, // Preserve original date
              publicMetrics: tweet.public_metrics ? { ...tweet.public_metrics } as any : undefined,
              authorId: username,
              editHistoryTweetIds: tweet.edit_history_tweet_ids || [],
              // Only add new entities, don't delete existing ones
              entities: newEntities.length > 0 ? {
                create: newEntities as any
              } : undefined // Skip entity update if no new entities to add
            }
          });
          
          tweetRecords.push(updatedTweet);
        } else {
          // Create a new tweet with all entities
          const newTweet = await prisma.tweet.create({
            data: {
              id: tweet.id,
              text: tweet.text,
              createdAt: createdAt,
              publicMetrics: tweet.public_metrics ? { ...tweet.public_metrics } as any : undefined,
              authorId: username,
              editHistoryTweetIds: tweet.edit_history_tweet_ids || [],
              entities: {
                create: entitiesData as any
              }
            }
          });
          
          tweetRecords.push(newTweet);
        }
      } catch (error) {
        logger.error('Error processing tweet', {
          id: tweet.id,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        });
      }
    }
    
    // Create a new cache entry with the tweets
    if (tweetRecords.length > 0) {
      await prisma.tweetCache.create({
        data: {
          type,
          tweets: {
            connect: tweetRecords.map(tweet => ({ id: tweet.id }))
          },
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
        }
      });
    } else {
      logger.warn('No tweets to cache', {
        type,
        step: 'cache-creation-skipped'
      });
    }
    
    return tweetRecords;
  } catch (error) {
    logger.error('Error processing tweets', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    throw error;
  }
}

// Add a new endpoint for cleaning up or deleting tweets
export async function DELETE(req: Request): Promise<Response> {
  try {
    // Check for authorization
    const url = new URL(req.url);
    const devBypass = url.searchParams.get('dev_key') === env.DEV_SECRET;
    const authHeader = req.headers.get('authorization');
    const isProduction = process.env.NODE_ENV === 'production';
    const allowDevEndpoints = env.ALLOW_DEV_ENDPOINTS || false;
    
    // Check authorization
    const isAuthorized = 
      authHeader === `Bearer ${env.CRON_SECRET}` || 
      ((!isProduction || allowDevEndpoints) && devBypass);
    
    if (!isAuthorized) {
      return NextResponse.json(
        { error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } },
        { status: 401 }
      );
    }
    
    // Get action from query params
    const action = url.searchParams.get('action') || 'report';
    
    // Get all tweets with error handling
    let tweets = [];
    try {
      tweets = await prisma.tweet.findMany({
        include: {
          entities: true
        }
      });
      
      console.log(`Found ${tweets.length} tweets for cleanup`, {
        step: 'cleanup-start',
        action
      });
    } catch (dbError) {
      console.error('Database connection error when fetching tweets:', dbError);
      return NextResponse.json({
        status: 'error',
        message: 'Database connection error',
        error: dbError instanceof Error ? dbError.message : 'Unknown database error'
      }, { status: 500 });
    }
    
    // Report on problematic tweets
    const problematicTweets = tweets.filter(tweet => {
      // Check if publicMetrics is a string (malformed)
      const isPublicMetricsString = typeof tweet.publicMetrics === 'string';
      
      // Check if any entities have malformed metadata
      const hasEntityWithStringMetadata = tweet.entities.some(
        entity => typeof entity.metadata === 'string'
      );
      
      // Check for future dates
      const hasFutureDate = tweet.createdAt > new Date();
      
      return isPublicMetricsString || hasEntityWithStringMetadata || hasFutureDate;
    });
    
    console.log(`Found ${problematicTweets.length} problematic tweets`, {
      step: 'cleanup-analysis',
      problematicCount: problematicTweets.length,
      totalCount: tweets.length
    });
    
    if (action === 'report') {
      // Just report the issues
      return NextResponse.json({
        status: 'success',
        message: 'Analysis complete',
        totalTweets: tweets.length,
        problematicTweets: problematicTweets.length,
        sampleIds: problematicTweets.slice(0, 5).map(t => t.id),
        issues: problematicTweets.slice(0, 5).map(t => ({
          id: t.id,
          hasFutureDate: t.createdAt > new Date(),
          createdAt: t.createdAt.toISOString(),
          isPublicMetricsString: typeof t.publicMetrics === 'string',
          hasEntityWithStringMetadata: t.entities.some(e => typeof e.metadata === 'string'),
          entityCount: t.entities.length
        }))
      });
    } else if (action === 'fix-dates') {
      // Fix tweets with future dates
      const futureDateTweets = tweets.filter(tweet => tweet.createdAt > new Date());
      
      console.log(`Found ${futureDateTweets.length} tweets with future dates`, {
        step: 'fix-dates',
        count: futureDateTweets.length
      });
      
      // Update each tweet with a future date to use the current date
      for (const tweet of futureDateTweets) {
        await prisma.tweet.update({
          where: { id: tweet.id },
          data: {
            createdAt: new Date()
          }
        });
      }
      
      return NextResponse.json({
        status: 'success',
        message: 'Fixed tweets with future dates',
        fixedCount: futureDateTweets.length,
        totalTweets: tweets.length
      });
    } else if (action === 'check-duplicates') {
      // Check for duplicate tweets by text content
      const tweetTexts = new Map<string, { count: number, ids: string[] }>();
      
      // Count occurrences of each tweet text
      for (const tweet of tweets) {
        const normalizedText = tweet.text.trim();
        if (!tweetTexts.has(normalizedText)) {
          tweetTexts.set(normalizedText, { count: 1, ids: [tweet.id] });
        } else {
          const entry = tweetTexts.get(normalizedText)!;
          entry.count++;
          entry.ids.push(tweet.id);
        }
      }
      
      // Filter to only duplicates
      const duplicates = Array.from(tweetTexts.entries())
        .filter(([_, data]) => data.count > 1)
        .map(([text, data]) => ({
          text: text.length > 50 ? `${text.substring(0, 50)}...` : text,
          count: data.count,
          ids: data.ids
        }));
      
      console.log(`Found ${duplicates.length} duplicate tweet texts`, {
        step: 'check-duplicates',
        duplicateCount: duplicates.length,
        totalTweets: tweets.length
      });
      
      return NextResponse.json({
        status: 'success',
        message: 'Checked for duplicate tweets',
        duplicateCount: duplicates.length,
        totalTweets: tweets.length,
        duplicates: duplicates.slice(0, 10) // Limit to 10 examples
      });
    } else if (action === 'fix-entities') {
      // Check for tweets with missing entities
      const tweetsWithMissingEntities = tweets.filter(tweet => 
        tweet.entities && 
        Object.keys(tweet.entities).some(key => (tweet.entities as any)[key]?.length > 0) && 
        tweet.entities.length === 0
      );
      
      console.log(`Found ${tweetsWithMissingEntities.length} tweets with potential entity issues`, {
        step: 'fix-entities',
        count: tweetsWithMissingEntities.length,
        totalTweets: tweets.length
      });
      
      // Get the original tweets from the Twitter API to restore entities
      let fixedCount = 0;
      let errorCount = 0;
      
      if (tweetsWithMissingEntities.length > 0) {
        try {
          // Initialize Twitter client
          const client = await getReadOnlyClient();
          
          // Get the username from environment
          const username = env.TWITTER_USERNAME?.replace('@', '') || 'unknown';
          
          for (const tweet of tweetsWithMissingEntities) {
            try {
              // Fetch the tweet directly from Twitter API
              const response = await client.v2.singleTweet(tweet.id, {
                'tweet.fields': ['created_at', 'entities', 'public_metrics'],
                'user.fields': ['username'],
                'media.fields': ['url', 'preview_image_url', 'alt_text'],
                expansions: ['attachments.media_keys']
              });
              
              if (response.data) {
                // Process the tweet entities
                const entitiesData = [];
                
                if (response.data.entities) {
                  // Process URLs
                  if (response.data.entities.urls?.length) {
                    for (const url of response.data.entities.urls) {
                      entitiesData.push({
                        type: 'url',
                        text: url.display_url || url.url,
                        url: url.url,
                        expandedUrl: url.expanded_url,
                        mediaKey: url.media_key,
                        metadata: {
                          status: url.status || null,
                          title: url.title || null,
                          description: url.description || null,
                          images: url.images || []
                        }
                      });
                    }
                  }
                  
                  // Process mentions
                  if (response.data.entities.mentions?.length) {
                    for (const mention of response.data.entities.mentions) {
                      entitiesData.push({
                        type: 'mention',
                        text: mention.username,
                        metadata: {
                          id: mention.id || null
                        }
                      });
                    }
                  }
                  
                  // Process hashtags
                  if (response.data.entities.hashtags?.length) {
                    for (const hashtag of response.data.entities.hashtags) {
                      entitiesData.push({
                        type: 'hashtag',
                        text: hashtag.tag
                      });
                    }
                  }
                }
                
                // Process media from includes if present
                const mediaKeys = response.data.attachments?.media_keys || [];
                if (response.includes?.media && mediaKeys.length > 0) {
                  const mediaItems = response.includes.media.filter((m: any) => 
                    mediaKeys.includes(m.media_key)
                  );
                  
                  for (const media of mediaItems) {
                    entitiesData.push({
                      type: 'media',
                      text: media.alt_text || '',
                      url: media.url || media.preview_image_url,
                      mediaKey: media.media_key,
                      metadata: {
                        type: media.type || null,
                        width: media.width || null,
                        height: media.height || null,
                        preview_image_url: media.preview_image_url || null,
                        duration_ms: media.duration_ms || null
                      }
                    });
                  }
                }
                
                if (entitiesData.length > 0) {
                  try {
                    // Update the tweet with the restored entities
                    await prisma.tweet.update({
                      where: { id: tweet.id },
                      data: {
                        entities: {
                          create: entitiesData as any
                        }
                      }
                    });
                    
                    fixedCount++;
                    
                    console.log(`Fixed entities for tweet ${tweet.id}`, {
                      step: 'fix-entities-success',
                      entityCount: entitiesData.length
                    });
                  } catch (dbUpdateError) {
                    errorCount++;
                    console.error(`Database error when updating entities for tweet ${tweet.id}:`, dbUpdateError);
                  }
                }
              }
            } catch (tweetError) {
              errorCount++;
              console.error(`Error fixing entities for tweet ${tweet.id}:`, {
                step: 'fix-entities-error',
                error: tweetError instanceof Error ? tweetError.message : String(tweetError),
                stack: tweetError instanceof Error ? tweetError.stack : undefined
              });
            }
          }
        } catch (clientError) {
          console.error('Error initializing Twitter client for entity fix:', {
            step: 'fix-entities-client-error',
            error: clientError instanceof Error ? clientError.message : String(clientError),
            stack: clientError instanceof Error ? clientError.stack : undefined
          });
        }
      }
      
      return NextResponse.json({
        status: 'success',
        message: 'Fixed tweets with missing entities',
        fixedCount,
        errorCount,
        totalTweets: tweets.length
      });
    } else if (action === 'fix') {
      // Fix problematic tweets
      let fixedCount = 0;
      
      for (const tweet of problematicTweets) {
        try {
          // Fix publicMetrics if it's a string
          let fixedPublicMetrics: any = tweet.publicMetrics;
          if (typeof tweet.publicMetrics === 'string') {
            try {
              fixedPublicMetrics = JSON.parse(tweet.publicMetrics);
            } catch (e) {
              // If parsing fails, set to empty object
              fixedPublicMetrics = {};
            }
          }
          
          // Fix future dates
          const fixedDate = tweet.createdAt > new Date() ? new Date() : tweet.createdAt;
          
          // Update the tweet with fixed data
          await prisma.tweet.update({
            where: {
              id: tweet.id
            },
            data: {
              publicMetrics: fixedPublicMetrics,
              createdAt: fixedDate
            }
          });
          
          // Fix entities with string metadata
          for (const entity of tweet.entities) {
            if (typeof entity.metadata === 'string') {
              let fixedMetadata: any = {};
              try {
                fixedMetadata = JSON.parse(entity.metadata);
              } catch (e) {
                // If parsing fails, leave as empty object
              }
              
              // Update the entity with fixed metadata
              await prisma.tweetEntity.update({
                where: {
                  id: entity.id
                },
                data: {
                  metadata: fixedMetadata
                }
              });
            }
          }
          
          fixedCount++;
        } catch (error) {
          logger.error(`Error fixing tweet ${tweet.id}`, {
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
      
      return NextResponse.json({
        status: 'success',
        message: 'Fixed problematic tweets',
        fixedCount,
        totalProblematic: problematicTweets.length
      });
    }
    
    return NextResponse.json({
      status: 'error',
      message: 'Invalid action specified',
      validActions: ['report', 'fix', 'fix-dates', 'check-duplicates', 'fix-entities']
    }, { status: 400 });
    
  } catch (error) {
    console.error('Error in tweet cleanup:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    
    return NextResponse.json({
      status: 'error',
      message: 'Failed to clean up tweets',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

