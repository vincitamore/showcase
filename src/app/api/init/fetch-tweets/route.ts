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
export async function GET(request: Request) {
  const startTime = Date.now();
  
  try {
    // During build time, return empty success to prevent API calls
    if (process.env.VERCEL_ENV === 'production' && process.env.NEXT_PHASE === 'build') {
      console.log('[Init] Build phase detected, skipping initialization');
      return NextResponse.json({ 
        success: true,
        message: 'Skipped during build phase',
        fromCache: false
      });
    }

    // Verify the request is from Vercel Cron
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
      console.error('[Init] Invalid authorization');
      return new NextResponse('Unauthorized', { status: 401 });
    }

    console.log('[Init] Starting tweet initialization...', {
      timestamp: new Date().toISOString()
    });

    // Get Twitter client
    const client = await getReadOnlyClient();
    
    // Get user info
    const username = env.TWITTER_USERNAME?.replace('@', '');
    if (!username) {
      console.error('[Init] Twitter username not configured');
      return new NextResponse('Twitter username not configured', { status: 500 });
    }

    const user = await client.userByUsername(username);
    if (!user.data) {
      console.error('[Init] User not found:', { username });
      return new NextResponse('User not found', { status: 404 });
    }

    console.log('[Init] Found user:', {
      id: user.data.id,
      username: user.data.username
    });

    // Fetch tweets with proper parameters
    const tweets = await executeWithRateLimit(
      'userTimeline',
      {
        userId: user.data.id,
        exclude: ['replies', 'retweets'],
        'tweet.fields': ['created_at', 'public_metrics', 'entities', 'author_id'],
        'user.fields': ['name', 'username', 'profile_image_url'],
        'media.fields': ['url', 'preview_image_url', 'type', 'height', 'width'],
        expansions: ['author_id', 'attachments.media_keys'],
        max_results: 40
      },
      () => client.userTimeline(user.data.id, {
        exclude: ['replies', 'retweets'],
        'tweet.fields': ['created_at', 'public_metrics', 'entities', 'author_id'],
        'user.fields': ['name', 'username', 'profile_image_url'],
        'media.fields': ['url', 'preview_image_url', 'type', 'height', 'width'],
        expansions: ['author_id', 'attachments.media_keys'],
        max_results: 40
      })
    );

    if (!tweets.data?.data?.length) {
      console.error('[Init] No tweets found for user:', { username });
      return new NextResponse('No tweets found', { status: 404 });
    }

    console.log('[Init] Retrieved tweets:', {
      count: tweets.data.data.length,
      firstTweetId: tweets.data.data[0].id,
      lastTweetId: tweets.data.data[tweets.data.data.length - 1].id
    });

    // Cache the tweets
    const cache = await cacheTweets(tweets.data.data);
    console.log('[Init] Cached tweets:', {
      cacheId: cache.id,
      tweetCount: tweets.data.data.length
    });

    // Get current cached tweets
    const cachedTweets = await getCachedTweets();
    if (!cachedTweets?.tweets?.length) {
      console.error('[Init] Failed to verify cached tweets');
      return new NextResponse('Failed to verify cached tweets', { status: 500 });
    }

    // Convert and update selected tweets
    const selectedTweets = cachedTweets.tweets
      .slice(0, 7) // Get first 7 tweets
      .sort(() => 0.5 - Math.random()) // Randomize order
      .map((tweet: TweetWithEntities) => tweet.id);

    await updateSelectedTweets(selectedTweets);
    
    const executionTime = Date.now() - startTime;
    console.log('[Init] Job completed successfully:', {
      tweetsStored: tweets.data.data.length,
      selectedTweets: selectedTweets.length,
      executionTimeMs: executionTime
    });

    return NextResponse.json({
      success: true,
      tweetsStored: tweets.data.data.length,
      selectedTweets: selectedTweets.length,
      executionTimeMs: executionTime
    });
  } catch (error) {
    const executionTime = Date.now() - startTime;
    console.error('[Init] Job failed:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      executionTimeMs: executionTime
    });

    return new NextResponse(
      error instanceof Error ? error.message : 'Internal Server Error', 
      { status: 500 }
    );
  }
} 
