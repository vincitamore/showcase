import { NextResponse } from 'next/server';
import { getReadOnlyClient, executeWithRateLimit } from '@/lib/x-api';
import { cacheTweets, getCachedTweets, updateSelectedTweets, SELECTED_TWEET_COUNT } from '@/lib/tweet-storage';
import { env } from '@/env';
import { TweetV2, TweetEntitiesV2, TweetEntityUrlV2, TwitterApiv2, ApiResponseError, TweetSearchRecentV2Paginator, TwitterRateLimit } from 'twitter-api-v2';

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
    const query = `from:${username} -is:reply -is:retweet has:links`;

    try {
      // Fetch tweets with rate limit handling using recent search
      const paginator = await executeWithRateLimit<TweetSearchRecentV2Paginator>(
        'tweets/search/recent',
        {
          query,
          max_results: 50,
          'tweet.fields': [
            'created_at',
            'public_metrics',
            'entities',
            'author_id',
            'attachments'
          ],
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
        },
        () => client.search(query, {
          max_results: 50,
          'tweet.fields': [
            'created_at',
            'public_metrics',
            'entities',
            'author_id',
            'attachments'
          ],
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
        })
      );

      // Get the first page of tweets
      const page = await paginator.fetchNext();
      const tweets: TweetV2[] = Array.isArray(page.data) ? page.data : [];
      const meta = page.meta;

      if (!tweets?.length) {
        console.error('[Cron] No tweets found:', {
          username,
          query,
          meta,
          timestamp: new Date().toISOString(),
          durationMs: Date.now() - startTime,
          step: 'no-tweets'
        });
        return new NextResponse('No tweets found', { status: 404 });
      }

      console.log('[Cron] Recent tweets fetched:', {
        count: tweets.length,
        firstTweetId: tweets[0]?.id,
        lastTweetId: tweets[tweets.length - 1]?.id,
        meta,
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - startTime,
        step: 'tweets-fetched'
      });

      // Cache the tweets
      const cache = await cacheTweets(tweets);
      console.log('[Cron] Tweets cached:', {
        cacheId: cache.id,
        tweetCount: tweets.length,
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - startTime,
        step: 'tweets-cached'
      });

      // Get cached tweets to verify
      const cachedTweets = await getCachedTweets();
      if (!cachedTweets.tweets?.length) {
        console.error('[Cron] Failed to verify cached tweets:', {
          timestamp: new Date().toISOString(),
          durationMs: Date.now() - startTime,
          step: 'verify-cached'
        });
        return new Response('Failed to verify cached tweets', { status: 500 });
      }

      // Select random tweets with improved entity handling
      const tweetsWithEntities = tweets.filter(tweet => 
        tweet.entities?.urls?.length || 
        tweet.attachments?.media_keys?.length
      );
      
      // If we don't have enough tweets with entities, include tweets without entities
      const tweetPool = tweetsWithEntities.length >= SELECTED_TWEET_COUNT 
        ? tweetsWithEntities 
        : tweets;
      
      const tweetIds = tweetPool.map(t => t.id);
      console.log('[Cron] Tweet selection pool:', {
        totalTweets: tweets.length,
        withEntities: tweetsWithEntities.length,
        poolSize: tweetIds.length,
        timestamp: new Date().toISOString(),
        step: 'selection-pool'
      });
      
      const selectedCount = Math.min(SELECTED_TWEET_COUNT, tweetIds.length);
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
        withEntities: selectedIds
          .filter(id => tweetsWithEntities.some(t => t.id === id))
          .length,
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
        tweetCount: tweets.length,
        selectedCount: selectedIds.length
      });

    } catch (searchError) {
      console.error('[Cron] Search error:', {
        error: searchError instanceof Error ? searchError.message : 'Unknown error',
        stack: searchError instanceof Error ? searchError.stack : undefined,
        query,
        username,
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - startTime,
        step: 'search-error'
      });
      
      if (searchError instanceof ApiResponseError) {
        console.error('[Cron] Twitter API error details:', {
          code: searchError.code,
          data: searchError.data,
          rateLimit: searchError.rateLimit,
          headers: searchError.headers
        });
      }
      
      throw searchError;
    }
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

