import { NextResponse } from 'next/server';
import { getReadOnlyClient } from '@/lib/x-api';
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
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
      console.error('[Cron] Invalid authorization');
      return new NextResponse('Unauthorized', { status: 401 });
    }

    console.log('[Cron] Starting tweet fetch...');

    // Get Twitter client
    const client = await getReadOnlyClient();
    
    // Get user info
    const user = await client.userByUsername(env.TWITTER_USERNAME);
    if (!user.data) {
      console.error('[Cron] User not found');
      return new NextResponse('User not found', { status: 404 });
    }

    // Fetch tweets
    const tweets = await client.userTimeline(user.data.id, {
      exclude: ['replies', 'retweets'],
      'tweet.fields': ['created_at', 'public_metrics', 'entities', 'attachments'],
      'user.fields': ['profile_image_url', 'username', 'name'],
      'media.fields': ['url', 'preview_image_url'],
      expansions: ['author_id', 'attachments.media_keys'],
      max_results: 40
    });

    if (!tweets.data.data?.length) {
      console.error('[Cron] No tweets found');
      return new NextResponse('No tweets found', { status: 404 });
    }

    // Cache the tweets
    await cacheTweets(tweets.data.data);

    // Get current cached tweets
    const cachedTweets = await getCachedTweets();
    if (!cachedTweets?.tweets?.length) {
      console.error('[Cron] Failed to verify cached tweets');
      return new NextResponse('Failed to verify cached tweets', { status: 500 });
    }

    // Convert and update selected tweets
    const selectedTweets = cachedTweets.tweets
      .slice(0, 7) // Get first 7 tweets
      .sort(() => 0.5 - Math.random()) // Randomize order
      .map((tweet: TweetWithEntities) => tweet.id);

    await updateSelectedTweets(selectedTweets);

    return NextResponse.json({
      success: true,
      tweetsStored: tweets.data.data.length,
      selectedTweets: selectedTweets.length
    });
  } catch (error) {
    console.error('[Cron] Error fetching tweets:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
} 

