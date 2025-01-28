import { NextResponse } from 'next/server';
import { getReadOnlyClient } from '@/lib/x-api';
import { cacheTweets, getCachedTweets, updateSelectedTweets, SELECTED_TWEET_COUNT, FIFTEEN_MINUTES } from '@/lib/tweet-storage';
import { env } from '@/env';
import { TweetV2, TweetEntitiesV2, TweetEntityUrlV2, TwitterApiv2, ApiResponseError } from 'twitter-api-v2';
import { 
  canMakeRequest,
  getRateLimit,
  updateRateLimit,
  MAX_TWEETS 
} from '@/lib/tweet-storage';
import { APIError, handleAPIError } from '@/lib/api-error';
import { logger, withLogging } from '@/lib/logger';

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
    // Verify cron secret
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
      logger.error('Unauthorized cron request', {
        hasAuth: !!authHeader,
        step: 'auth-check'
      });
      return NextResponse.json(
        { error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } },
        { status: 401 }
      );
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
        return NextResponse.json({
          status: 'success',
          tweetCount: cachedTweets.length,
          source: 'cache'
        });
      }
    }

    // Initialize Twitter client
    const client = await getReadOnlyClient().catch(error => {
      logger.error('Failed to initialize Twitter client', {
        step: 'client-init',
        error
      });
      throw new APIError('Failed to initialize Twitter client', 500, 'TWITTER_CLIENT_ERROR');
    });
    
    // Get user info for query
    const username = env.TWITTER_USERNAME?.replace('@', '');
    if (!username) {
      logger.error('Twitter username not configured', {
        step: 'config-check'
      });
      throw new APIError('Twitter username not configured', 500, 'CONFIG_ERROR');
    }

    const query = `from:${username} -is:retweet`;

    // Check if we can make the request
    const canMakeReq = await canMakeRequest('tweets/search/recent').catch(error => {
      logger.error('Failed to check rate limit', {
        step: 'rate-limit-check',
        error
      });
      throw new APIError('Failed to check rate limit', 500, 'RATE_LIMIT_CHECK_ERROR');
    });

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

    // Prepare search parameters
    const searchParams: any = {
      max_results: MAX_TWEETS,
      'tweet.fields': ['created_at', 'public_metrics', 'entities', 'author_id', 'attachments'],
      'user.fields': ['profile_image_url', 'username'],
      'media.fields': [
        'url',
        'preview_image_url',
        'alt_text',
        'type',
        'width',
        'height',
        'duration_ms',
        'variants'
      ],
      expansions: [
        'author_id',
        'attachments.media_keys',
        'attachments.poll_ids',
        'entities.mentions.username',
        'referenced_tweets.id',
        'referenced_tweets.id.author_id'
      ]
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
      sinceId: searchParams.since_id
    });

    const response = await client.search(query, searchParams);

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

    // Merge with existing tweets if needed
    const tweetsToCache = searchParams.since_id
      ? [...newTweets, ...cachedTweets].slice(0, MAX_TWEETS)
      : newTweets;

    // Cache the tweets
    await cacheTweets(tweetsToCache, 'current', response.includes);

    return NextResponse.json({
      status: 'success',
      tweetCount: tweetsToCache.length,
      newTweets: newTweets.length,
      source: 'api'
    });

  } catch (error) {
    logger.error('Error in tweet fetch', {
      step: 'error',
      error,
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

    return NextResponse.json(
      {
        error: {
          message: 'Internal server error',
          code: 'INTERNAL_SERVER_ERROR'
        }
      },
      { status: 500 }
    );
  }
}

// Wrap the handler with logging and ensure it returns Response
export const GET = withLogging(fetchTweetsHandler, 'api/cron/fetch-tweets'); 

