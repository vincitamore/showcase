import { NextResponse } from 'next/server';
import { getReadOnlyClient, executeWithRateLimit } from '@/lib/x-api';
import { cacheTweets, getCachedTweets, updateSelectedTweets } from '@/lib/tweet-storage';
import { env } from '@/env';
import { TweetV2, TweetEntitiesV2, TweetEntityUrlV2 } from 'twitter-api-v2';

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
        images: []
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
      cashtags: [],
      annotations: []
    } as TweetEntitiesV2 : undefined
  };
}

// Ensure this is only called by Vercel cron
export async function GET(request: Request) {
  const startTime = Date.now();
  
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
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

    // Get Twitter client
    const client = await getReadOnlyClient();
    
    console.log('[Cron] Client initialized, preparing search...', {
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      step: 'client-ready'
    });

    // Get user info for query
    const username = env.TWITTER_USERNAME?.replace('@', '');
    if (!username) {
      console.error('[Cron] Twitter username not configured:', {
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - startTime,
        step: 'config-error'
      });
      return new NextResponse('Twitter username not configured', { status: 500 });
    }

    // Construct search query for user's tweets, excluding replies and retweets
    const query = `from:${username} -is:reply -is:retweet`;

    // Fetch tweets with rate limit handling using recent search
    const tweets = await executeWithRateLimit(
      'tweets/search/recent',
      {
        query,
        max_results: 50,
        'tweet.fields': ['created_at', 'public_metrics', 'entities', 'author_id'],
        'user.fields': ['profile_image_url', 'username'],
        'media.fields': ['url', 'preview_image_url', 'alt_text'],
        expansions: ['author_id', 'attachments.media_keys']
      },
      () => client.get('tweets/search/recent', {
        query,
        max_results: 50,
        'tweet.fields': ['created_at', 'public_metrics', 'entities', 'author_id'],
        'user.fields': ['profile_image_url', 'username'],
        'media.fields': ['url', 'preview_image_url', 'alt_text'],
        expansions: ['author_id', 'attachments.media_keys']
      })
    );

    if (!tweets.data?.length) {
      console.error('[Cron] No tweets found:', {
        username,
        query,
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - startTime,
        step: 'no-tweets'
      });
      return new NextResponse('No tweets found', { status: 404 });
    }

    console.log('[Cron] Recent tweets fetched:', {
      count: tweets.data.length,
      firstTweetId: tweets.data[0].id,
      lastTweetId: tweets.data[tweets.data.length - 1].id,
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      step: 'tweets-fetched'
    });

    // Cache the tweets
    const cache = await cacheTweets(tweets.data);
    console.log('[Cron] Tweets cached:', {
      cacheId: cache.id,
      tweetCount: tweets.data.length,
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      step: 'tweets-cached'
    });

    // Get current cached tweets
    const cachedTweets = await getCachedTweets();
    if (!cachedTweets?.tweets?.length) {
      console.error('[Cron] Failed to verify cached tweets:', {
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - startTime,
        step: 'cache-verification-failed'
      });
      return new NextResponse('Failed to verify cached tweets', { status: 500 });
    }

    // Select random tweets
    const tweetIds = tweets.data.map((t: TweetV2) => t.id);
    const selectedCount = Math.min(4, tweetIds.length);
    const selectedIds: string[] = [];
    
    while (selectedIds.length < selectedCount) {
      const randomIndex = Math.floor(Math.random() * tweetIds.length);
      const id = tweetIds[randomIndex];
      if (!selectedIds.includes(id)) {
        selectedIds.push(id);
      }
    }

    console.log('[Cron] Selected random tweets:', {
      selectedCount,
      selectedIds,
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      step: 'tweets-selected'
    });

    // Update selected tweets
    const selectedCache = await updateSelectedTweets(selectedIds);
    
    console.log('[Cron] Selected tweets updated:', {
      selectedCacheId: selectedCache.id,
      selectedIds,
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      step: 'complete'
    });

    return NextResponse.json({
      message: 'Tweets fetched and cached successfully',
      tweetCount: tweets.data.length,
      selectedCount: selectedIds.length
    });
  } catch (error) {
    console.error('[Cron] Job failed:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      executionTimeMs: Date.now() - startTime,
      step: 'error',
      timestamp: new Date().toISOString()
    });
    
    return new NextResponse(
      error instanceof Error ? error.message : 'Internal Server Error',
      { status: 500 }
    );
  }
} 

