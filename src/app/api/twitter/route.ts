import { NextResponse } from 'next/server';
import { getReadOnlyClient, postTweet } from '@/lib/x-api';
import {
  getCachedTweets,
  cacheTweets,
  getRateLimit,
  updateRateLimit,
  canMakeRequest,
  FIFTEEN_MINUTES
} from '@/lib/tweet-storage';

// Move helper functions outside of the route exports
async function searchRecentTweets(client: any) {
  try {
    // Check rate limit before making request
    const rateLimit = await getRateLimit('tweets/search/recent');
    if (!await canMakeRequest('tweets/search/recent')) {
      throw new Error('Rate limit exceeded for search endpoint');
    }

    // Search for tweets containing ".build"
    const searchResults = await client.v2.search('.build', {
      'tweet.fields': ['created_at', 'text', 'public_metrics'],
      'user.fields': ['profile_image_url', 'username'],
      max_results: 10,
    });

    // Update rate limit after successful request
    if (searchResults.rateLimit) {
      await updateRateLimit(
        'tweets/search/recent',
        new Date(searchResults.rateLimit.reset * 1000),
        searchResults.rateLimit.remaining
      );
    }

    if (searchResults.data && searchResults.data.length > 0) {
      return searchResults.data[0]; // Return the most recent matching tweet
    }
    return null;
  } catch (error) {
    console.error('Error searching tweets:', error);
    
    // Update rate limit if we hit a rate limit error
    if (error instanceof Error && error.message.includes('Rate limit')) {
      const resetTime = new Date(Date.now() + FIFTEEN_MINUTES);
      await updateRateLimit('tweets/search/recent', resetTime, 0);
    }
    
    return null;
  }
}

async function getRandomTweet(client: any, username: string) {
  try {
    // Check rate limit before making request
    if (!await canMakeRequest('users/by/username')) {
      throw new Error('Rate limit exceeded for user lookup endpoint');
    }

    const user = await client.v2.userByUsername(username);
    if (!user.data) {
      throw new Error('User not found');
    }

    // Check rate limit before timeline request
    if (!await canMakeRequest('users/:id/tweets')) {
      throw new Error('Rate limit exceeded for timeline endpoint');
    }

    const tweets = await client.v2.userTimeline(user.data.id, {
      exclude: ['replies', 'retweets'],
      'tweet.fields': ['created_at', 'text', 'public_metrics'],
      'user.fields': ['profile_image_url', 'username'],
      max_results: 10,
    });

    // Update rate limits after successful requests
    if (user.rateLimit) {
      await updateRateLimit(
        'users/by/username',
        new Date(user.rateLimit.reset * 1000),
        user.rateLimit.remaining
      );
    }

    if (tweets.rateLimit) {
      await updateRateLimit(
        'users/:id/tweets',
        new Date(tweets.rateLimit.reset * 1000),
        tweets.rateLimit.remaining
      );
    }

    if (!tweets.data || tweets.data.length === 0) {
      throw new Error('No tweets found');
    }

    // Get a random tweet from the results
    const randomIndex = Math.floor(Math.random() * tweets.data.length);
    return tweets.data[randomIndex];
  } catch (error) {
    console.error('Error getting random tweet:', error);
    return null;
  }
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
    const rateLimit = await getRateLimit('twitter/api');
    const now = new Date();
    if (!await canMakeRequest('twitter/api')) {
      console.log('Rate limit in effect, waiting for timeout');
      return NextResponse.json({ 
        error: 'Rate limit exceeded',
        lastRequest: rateLimit ? new Date(rateLimit.resetAt).toISOString() : 'never',
        nextRequest: rateLimit ? new Date(rateLimit.resetAt).toISOString() : undefined
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

        // Cache the tweets and update rate limit
        await cacheTweets([tweet]);
        await updateRateLimit(
          'twitter/api',
          new Date(Date.now() + FIFTEEN_MINUTES),
          0
        );

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

    // Update rate limit if we hit a rate limit error
    if (error instanceof Error && error.message.includes('Rate limit')) {
      await updateRateLimit(
        'twitter/api',
        new Date(Date.now() + FIFTEEN_MINUTES),
        0
      );
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