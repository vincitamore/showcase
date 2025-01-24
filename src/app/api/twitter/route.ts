import { NextResponse } from 'next/server';
import { getReadOnlyClient, postTweet } from '@/lib/x-api';
import {
  getCachedTweets,
  cacheTweets,
  getRateLimitTimestamp,
  updateRateLimitTimestamp,
  canMakeRequest,
  FIFTEEN_MINUTES
} from '@/lib/blob-storage';

async function searchRecentTweets(client: any) {
  try {
    // Search for tweets containing ".build"
    const searchResults = await client.v2.search('.build', {
      'tweet.fields': ['created_at', 'text', 'public_metrics'],
      'user.fields': ['profile_image_url', 'username'],
      max_results: 10,
    });

    if (searchResults.data && searchResults.data.length > 0) {
      return searchResults.data[0]; // Return the most recent matching tweet
    }
    return null;
  } catch (error) {
    console.error('Error searching tweets:', error);
    return null;
  }
}

async function getRandomTweet(client: any, username: string) {
  const user = await client.v2.userByUsername(username);
  if (!user.data) {
    throw new Error('User not found');
  }

  const tweets = await client.v2.userTimeline(user.data.id, {
    exclude: ['replies', 'retweets'],
    'tweet.fields': ['created_at', 'text', 'public_metrics'],
    'user.fields': ['profile_image_url', 'username'],
    max_results: 10,
  });

  if (!tweets.data || tweets.data.length === 0) {
    throw new Error('No tweets found');
  }

  // Get a random tweet from the results
  const randomIndex = Math.floor(Math.random() * tweets.data.length);
  return tweets.data[randomIndex];
}

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  try {
    const action = searchParams.get('action');
    const username = searchParams.get('username')?.replace('@', '');

    console.log('Twitter API Request:', { action, username });

    if (!action) {
      return NextResponse.json({ error: 'Missing action parameter' }, { status: 400 });
    }

    // Check rate limit
    const lastRequestTime = await getRateLimitTimestamp();
    const now = Date.now();
    if (!canMakeRequest(now)) {
      console.log('Rate limit in effect, waiting for timeout');
      return NextResponse.json({ 
        error: 'Rate limit exceeded',
        lastRequest: lastRequestTime ? new Date(lastRequestTime).toISOString() : 'never',
        nextRequest: lastRequestTime ? new Date(lastRequestTime + FIFTEEN_MINUTES).toISOString() : undefined
      }, { status: 429 });
    }

    switch (action) {
      case 'fetch_tweets': {
        // Check cache first
        const cachedData = await getCachedTweets();
        const cachedTweets = cachedData?.tweets ?? [];
        
        if (cachedTweets.length > 0) {
          console.log('Returning cached tweets, count:', cachedTweets.length);
          return NextResponse.json({ tweets: cachedTweets });
        }

        // Make new request
        console.log('Fetching fresh tweets');
        const client = await getReadOnlyClient();

        // First try to find tweets with ".build"
        const buildTweet = await searchRecentTweets(client);
        
        // If no ".build" tweets found, get a random tweet from the user's timeline
        const tweet = buildTweet || (username ? await getRandomTweet(client, username) : null);

        if (!tweet) {
          return NextResponse.json({ error: 'No tweets found' }, { status: 404 });
        }

        // Cache the tweets and update rate limit timestamp
        await cacheTweets([tweet]);
        await updateRateLimitTimestamp(Date.now());

        console.log('Tweet fetched and cached successfully');
        return NextResponse.json(tweet);
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    // Log the full error details
    console.error('Twitter API Error:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      name: error instanceof Error ? error.name : 'Unknown',
      stack: error instanceof Error ? error.stack : undefined,
      raw: error,
      url: request.url,
      params: { 
        action: searchParams.get('action'),
        username: searchParams.get('username')
      },
      env: {
        hasApiKey: !!process.env.TWITTER_API_KEY,
        hasApiSecret: !!process.env.TWITTER_API_SECRET,
        nodeEnv: process.env.NODE_ENV,
        vercelEnv: process.env.VERCEL_ENV
      }
    });

    // Update rate limit timestamp if we hit a rate limit error
    if (error instanceof Error && error.message.includes('Rate limit')) {
      await updateRateLimitTimestamp(Date.now());
    }

    return NextResponse.json({
      error: 'Failed to process Twitter request',
      details: error instanceof Error ? error.message : 'Unknown error',
      type: error instanceof Error ? error.name : 'Unknown',
      env: process.env.VERCEL_ENV || process.env.NODE_ENV
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { text, accessToken } = await request.json();
    console.log('Processing tweet post:', { hasText: !!text, hasToken: !!accessToken });

    if (!text?.trim()) {
      return NextResponse.json({ error: 'Tweet text is required' }, { status: 400 });
    }

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const tweet = await postTweet(text, accessToken);
    console.log('Tweet posted successfully:', tweet.id);

    return NextResponse.json(tweet);
  } catch (error) {
    console.error('Tweet post error:', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { 
        error: 'Failed to post tweet',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 