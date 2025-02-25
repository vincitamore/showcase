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
  TECH_SCORE_THRESHOLD
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
    
    logger.info('Checking daily fetch count', { 
      fetchCountToday,
      dailyLimit: DAILY_TWEET_FETCH_LIMIT,
      step: 'daily-limit-check'
    });
    
    // If we've already hit our daily limit, just use cached tweets
    if (fetchCountToday >= DAILY_TWEET_FETCH_LIMIT) {
      logger.info('Daily fetch limit reached, using cache', {
        fetchCountToday,
        dailyLimit: DAILY_TWEET_FETCH_LIMIT,
        cachedTweetCount: cachedTweets.length,
        step: 'daily-limit-reached'
      });
      
      // Still select a fresh set of tweets to display, even if we don't fetch new ones
      await selectTweetsForDisplay(cachedTweets);
      
      return NextResponse.json({
        status: 'success',
        tweetCount: cachedTweets.length,
        source: 'cache',
        dailyLimit: {
          reached: true,
          count: fetchCountToday,
          limit: DAILY_TWEET_FETCH_LIMIT
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

    const query = `from:${username} -is:retweet`;
    
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
          // Still select a fresh set of tweets for display
          await selectTweetsForDisplay(cachedTweets);
          
          return NextResponse.json({
            status: 'success',
            tweetCount: cachedTweets.length,
            source: 'cache',
            rateLimit: {
              resetAt: resetAt.toISOString(),
              message: 'Using cached tweets due to rate limit'
            }
          });
        }

        return NextResponse.json(
          {
            error: {
              message: 'Rate limit exceeded',
              code: 'RATE_LIMIT_EXCEEDED',
              resetAt: resetAt.toISOString()
            }
          },
          { status: 429 }
        );
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

    // Prepare search parameters - request more tweets than we'll store
    // so we can filter for tech-relevant content
    const searchParams: any = {
      max_results: 20, // Request more than we'll save to filter for quality
      'tweet.fields': 'created_at,public_metrics,entities,author_id,attachments',
      'user.fields': 'profile_image_url,username',
      'media.fields': 'url,preview_image_url,alt_text,type,width,height,duration_ms,variants',
      'expansions': 'author_id,attachments.media_keys,attachments.poll_ids,entities.mentions.username,referenced_tweets.id,referenced_tweets.id.author_id'
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

    // Fix: Use client.get directly with the endpoint and include query in searchParams
    searchParams.query = query;
    
    let response;
    try {
      logger.info('Sending request to Twitter API', { 
        step: 'twitter-request-start',
        endpoint: 'tweets/search/recent'
      });
      
      // Use the full URL with https://api.x.com/2/ prefix
      response = await client.get('tweets/search/recent', searchParams, { fullResponse: true });
      
      logger.info('Twitter API request successful', { 
        step: 'twitter-request-success',
        hasData: !!response.data,
        dataCount: response.data?.data?.length || 0,
        rateLimit: response.rateLimit ? {
          remaining: response.rateLimit.remaining,
          reset: response.rateLimit.reset
        } : null
      });
    } catch (twitterError) {
      logger.error('Failed to fetch from Twitter API', {
        step: 'twitter-request-error',
        errorType: twitterError instanceof Error ? twitterError.constructor.name : typeof twitterError,
        errorMessage: twitterError instanceof Error ? twitterError.message : String(twitterError),
        errorStack: twitterError instanceof Error ? twitterError.stack : 'No stack trace',
        params: searchParams
      });
      
      // Check if this is a network error
      if (twitterError instanceof Error && 
          (twitterError.message.includes('network error') || 
           twitterError.message.includes('timeout') ||
           twitterError.message.includes('Request failed'))) {
        throw new APIError('Twitter API connection error (timeout or network issue)', 500, 'TWITTER_NETWORK_ERROR');
      }
      
      // Check if this is a rate limit error
      if (twitterError instanceof Error && twitterError.message.includes('429')) {
        throw new APIError('Twitter API rate limit exceeded', 429, 'TWITTER_RATE_LIMIT');
      }
      
      // Re-throw the error for the main error handler
      throw twitterError;
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

    // Get tweets from the response
    const newTweets = response.data.data;
    
    if (!newTweets?.length) {
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

    // Cache the tweets
    await cacheTweets(tweetsToCache, 'current', response.data.includes);
    
    // Select tweets for display
    await selectTweetsForDisplay([...tweetsToCache]);

    return NextResponse.json({
      status: 'success',
      tweetCount: tweetsToCache.length,
      filteredCount: selectedNewTweets.length,
      highQualityCount: highQualityTweets.length,
      totalNewTweets: newTweets.length,
      source: 'api'
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

