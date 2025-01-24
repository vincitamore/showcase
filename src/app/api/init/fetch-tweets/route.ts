import { NextRequest, NextResponse } from 'next/server';
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

// Helper function to validate and format dates
function toValidDate(date: Date | string | number | null | undefined): Date {
  if (!date) return new Date();
  
  try {
    const parsed = new Date(date);
    if (isNaN(parsed.getTime())) {
      console.warn('[Twitter Storage] Invalid date:', date);
      return new Date();
    }
    return parsed;
  } catch (error) {
    console.warn('[Twitter Storage] Error parsing date:', date, error);
    return new Date();
  }
}

// Helper function to safely convert date to ISO string
function toSafeISOString(date: Date | string | number | null | undefined): string {
  return toValidDate(date).toISOString();
}

// Convert database tweet to TweetV2 format
function convertToTweetV2(dbTweet: TweetWithEntities): TweetV2 {
  return {
    id: dbTweet.id,
    text: dbTweet.text,
    created_at: toSafeISOString(dbTweet.createdAt),
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

// Mark route as dynamic to prevent static generation
export const dynamic = 'force-dynamic';
// Use Node.js runtime instead of Edge
export const runtime = 'nodejs';
// Increase timeout for API operations
export const maxDuration = 10; // 10 seconds timeout

// This route is called during build/deployment to initialize tweets
export async function GET(req: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Ensure this is only called by Vercel cron
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
      console.error('[Init] Unauthorized request:', {
        hasAuth: !!authHeader,
        timestamp: new Date().toISOString(),
        step: 'auth-check'
      });
      return new NextResponse('Unauthorized', { status: 401 });
    }

    console.log('[Init] Starting tweet fetch...', {
      timestamp: new Date().toISOString(),
      step: 'start'
    });

    // Initialize Twitter client
    const client = await getReadOnlyClient();
    
    console.log('[Init] Client initialized, fetching user...', {
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      step: 'client-ready'
    });

    // Get user data
    const user = await executeWithRateLimit(
      'users/by/username',
      { username: env.TWITTER_USERNAME },
      () => client.userByUsername(env.TWITTER_USERNAME)
    );

    if (!user.data) {
      console.error('[Init] User not found:', {
        username: env.TWITTER_USERNAME,
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - startTime,
        step: 'user-not-found'
      });
      return new NextResponse('User not found', { status: 404 });
    }

    console.log('[Init] User found, fetching timeline...', {
      userId: user.data.id,
      username: user.data.username,
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      step: 'user-found'
    });

    // Get tweets
    const tweets = await executeWithRateLimit(
      'users/:id/tweets',
      {
        userId: user.data.id,
        exclude: ['retweets', 'replies'],
        expansions: ['author_id', 'attachments.media_keys'],
        'tweet.fields': ['created_at', 'public_metrics', 'entities'],
        'user.fields': ['profile_image_url', 'username'],
        'media.fields': ['url', 'preview_image_url', 'alt_text'],
        max_results: 100
      },
      () => client.userTimeline(user.data.id, {
        exclude: ['retweets', 'replies'],
        expansions: ['author_id', 'attachments.media_keys'],
        'tweet.fields': ['created_at', 'public_metrics', 'entities'],
        'user.fields': ['profile_image_url', 'username'],
        'media.fields': ['url', 'preview_image_url', 'alt_text'],
        max_results: 100
      })
    );

    console.log('[Init] Timeline fetched:', {
      tweetCount: tweets.data.data.length,
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      step: 'tweets-fetched'
    });

    // Cache tweets
    const cache = await cacheTweets(tweets.data.data);
    
    console.log('[Init] Tweets cached:', {
      cacheId: cache.id,
      tweetCount: tweets.data.data.length,
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      step: 'tweets-cached'
    });

    // Select random tweets
    const tweetIds = tweets.data.data.map(t => t.id);
    const selectedCount = Math.min(3, tweetIds.length);
    const selectedIds: string[] = [];
    
    while (selectedIds.length < selectedCount) {
      const randomIndex = Math.floor(Math.random() * tweetIds.length);
      const id = tweetIds[randomIndex];
      if (!selectedIds.includes(id)) {
        selectedIds.push(id);
      }
    }

    console.log('[Init] Selected random tweets:', {
      selectedCount,
      selectedIds,
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      step: 'tweets-selected'
    });

    // Update selected tweets
    const selectedCache = await updateSelectedTweets(selectedIds);
    
    console.log('[Init] Selected tweets updated:', {
      selectedCacheId: selectedCache.id,
      selectedIds,
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      step: 'complete'
    });

    return NextResponse.json({
      message: 'Tweets fetched and cached successfully',
      tweetCount: tweets.data.data.length,
      selectedCount: selectedIds.length
    });
  } catch (error) {
    console.error('[Init] Job failed:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      executionTimeMs: Date.now() - startTime,
      step: 'error'
    });
    
    return new NextResponse(
      error instanceof Error ? error.message : 'Internal Server Error',
      { status: 500 }
    );
  }
} 
