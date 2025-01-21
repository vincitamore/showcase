import { NextResponse } from 'next/server';
import { getReadOnlyClient } from '@/lib/x-api';
import { 
  cacheTweets,
  updateRateLimitTimestamp,
  updateSelectedTweets
} from '@/lib/blob-storage';
import { TweetV2, TweetPublicMetricsV2, TwitterApi } from 'twitter-api-v2';

// Interface to match TweetV2 structure but only include what we need
interface StoredTweet {
  id: string;
  text: string;
  edit_history_tweet_ids: string[];
  created_at?: string;
  public_metrics?: TweetPublicMetricsV2;
}

function convertToStoredTweet(tweet: TweetV2): StoredTweet {
  return {
    id: tweet.id,
    text: tweet.text,
    edit_history_tweet_ids: tweet.edit_history_tweet_ids,
    created_at: tweet.created_at,
    public_metrics: tweet.public_metrics
  };
}

async function searchBuildTweets(client: TwitterApi): Promise<StoredTweet[]> {
  console.log('[Init] Searching for .build tweets...');
  const searchResults = await client.v2.search('.build', {
    'tweet.fields': ['created_at', 'public_metrics'],
    max_results: 10,
  });

  if (!searchResults?.data) {
    return [];
  }

  const tweets = (Array.isArray(searchResults.data) ? searchResults.data : [searchResults.data])
    .map(tweet => convertToStoredTweet(tweet as TweetV2));
  console.log('[Init] Found .build tweets:', tweets.length);
  return tweets;
}

async function getUserTweets(client: TwitterApi, username: string): Promise<StoredTweet[]> {
  console.log('[Init] Fetching user tweets...');
  const user = await client.v2.userByUsername(username);
  if (!user?.data) {
    throw new Error('User not found');
  }

  const timeline = await client.v2.userTimeline(user.data.id, {
    exclude: ['replies', 'retweets'],
    'tweet.fields': ['created_at', 'public_metrics'],
    max_results: 10,
  });

  if (!timeline?.data?.data) {
    return [];
  }

  const tweets = (Array.isArray(timeline.data.data) ? timeline.data.data : [timeline.data.data])
    .map(tweet => convertToStoredTweet(tweet as TweetV2));
  console.log('[Init] Found user tweets:', tweets.length);
  return tweets;
}

// This route is called during build/deployment to initialize tweets
export async function GET(request: Request) {
  console.log('[Init] Starting initial tweet fetch...');
  
  try {
    // Verify the request is from our deployment
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      console.log('[Init] Unauthorized request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await getReadOnlyClient();
    const username = process.env.NEXT_PUBLIC_TWITTER_USERNAME;
    
    if (!username) {
      throw new Error('Twitter username not configured');
    }

    // Search for .build tweets first
    let tweets = await searchBuildTweets(client);

    // If no .build tweets, get tweets from configured user
    if (tweets.length === 0) {
      tweets = await getUserTweets(client, username);
    }

    if (tweets.length === 0) {
      console.log('[Init] No tweets found');
      return NextResponse.json({ 
        message: 'No tweets found to cache'
      });
    }

    // Cache the tweets
    await cacheTweets(tweets);
    await updateRateLimitTimestamp();

    // Select random tweets for display
    const selectedTweets = tweets
      .sort(() => Math.random() - 0.5)
      .slice(0, 4);
    await updateSelectedTweets(selectedTweets);

    console.log('[Init] Successfully cached and selected tweets');
    return NextResponse.json({ 
      success: true,
      tweetsCount: tweets.length,
      selectedCount: selectedTweets.length
    });
  } catch (error) {
    console.error('[Init] Error during initial tweet fetch:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch initial tweets',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 
