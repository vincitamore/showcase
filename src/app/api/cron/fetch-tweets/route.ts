import { NextResponse } from 'next/server';
import { getReadOnlyClient } from '@/lib/x-api';
import { cacheTweets, getCachedTweets, updateSelectedTweets, SELECTED_TWEET_COUNT } from '@/lib/tweet-storage';
import { env } from '@/env';
import { TweetV2, TweetEntitiesV2, TweetEntityUrlV2, TwitterApiv2, ApiResponseError } from 'twitter-api-v2';
import { 
  canMakeRequest, 
  getRateLimit,
  updateRateLimit,
  MAX_TWEETS 
} from '@/lib/tweet-storage';

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

export async function GET(req: Request) {
  const startTime = Date.now();
  
  try {
    // Verify cron secret
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
      console.error('[Cron] Unauthorized request:', {
        hasAuth: !!authHeader,
        timestamp: new Date().toISOString(),
        step: 'auth-check'
      });
      return new NextResponse('Unauthorized', { status: 401 });
    }

    console.log('[Cron] Starting tweet fetch...', {
      timestamp: new Date().toISOString(),
      step: 'start'
    });

    // Initialize Twitter client
    const client = await getReadOnlyClient();
    
    console.log('[Cron] Client initialized, preparing search...', {
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      step: 'client-ready'
    });

    // Get user info for query
    const username = env.TWITTER_USERNAME?.replace('@', '');
    if (!username) {
      console.error('[Cron] Twitter username not configured');
      return new NextResponse('Twitter username not configured', { status: 500 });
    }

    const query = `from:${username} -is:retweet`;

    // Check if we can make the request
    const canMakeReq = await canMakeRequest('tweets/search/recent');
    if (!canMakeReq) {
      const rateLimit = await getRateLimit('tweets/search/recent');
      const resetAt = new Date(rateLimit.resetAt);
      
      console.log('[Twitter API] Rate limited, returning 429:', {
        endpoint: 'tweets/search/recent',
        resetAt: resetAt.toISOString(),
        remaining: rateLimit.remaining,
        timestamp: new Date().toISOString(),
        step: 'rate-limited'
      });

      return NextResponse.json({
        status: 'rate_limited',
        resetAt: resetAt.toISOString(),
        message: 'Rate limit exceeded, try again after reset time'
      }, { status: 429 });
    }

    // Make the API request
    console.log('[Twitter API] Making search request:', {
      query,
      timestamp: new Date().toISOString(),
      step: 'search-start'
    });

    const response = await client.search(query, {
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
    });

    // Get tweets from the response
    const tweets = response.data.data;
    if (!tweets?.length) {
      console.log('[Twitter API] No tweets found:', {
        timestamp: new Date().toISOString(),
        step: 'no-tweets'
      });
      return NextResponse.json({ 
        status: 'success',
        tweetCount: 0
      });
    }

    // Update rate limit after successful request
    if (response.rateLimit) {
      const remainingRequests = parseInt(response.rateLimit.remaining.toString());
      const rateLimitReset = new Date(parseInt(response.rateLimit.reset.toString()) * 1000);

      await updateRateLimit('tweets/search/recent', rateLimitReset, remainingRequests);

      console.log('[Twitter API] Updated rate limits:', {
        endpoint: 'tweets/search/recent',
        remaining: remainingRequests,
        resetAt: rateLimitReset.toISOString(),
        timestamp: new Date().toISOString(),
        step: 'rate-limit-update'
      });
    }

    console.log('[Twitter API] Search complete:', {
      tweetCount: tweets.length,
      timestamp: new Date().toISOString(),
      step: 'search-complete'
    });

    // Cache the tweets
    await cacheTweets(tweets, 'current', response.includes);

    return NextResponse.json({
      status: 'success',
      tweetCount: tweets.length
    });

  } catch (error) {
    console.error('[Cron] Error fetching tweets:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    });

    // Handle rate limit errors specifically
    if (error instanceof ApiResponseError && error.code === 429) {
      const resetAt = error.rateLimit?.reset 
        ? new Date(parseInt(error.rateLimit.reset.toString()) * 1000)
        : new Date(Date.now() + 15 * 60 * 1000); // Default to 15 minutes if no reset time

      await updateRateLimit('tweets/search/recent', resetAt, 0);

      return NextResponse.json({
        status: 'rate_limited',
        resetAt: resetAt.toISOString(),
        message: 'Rate limit exceeded from API response'
      }, { status: 429 });
    }

    return NextResponse.json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 

