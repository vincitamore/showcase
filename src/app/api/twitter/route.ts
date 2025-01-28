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
import { APIError, handleAPIError } from '@/lib/api-error';

// Move helper functions outside of the route exports
async function searchRecentTweets(client: any) {
  try {
    // Check rate limit before making request
    const rateLimit = await getRateLimit('tweets/search/recent');
    if (!await canMakeRequest('tweets/search/recent')) {
      throw new APIError(
        `Rate limit exceeded for tweets/search/recent endpoint. Reset at ${rateLimit?.resetAt}`,
        429,
        'RATE_LIMIT_EXCEEDED'
      );
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
      throw new APIError(
        `Rate limit exceeded for tweets/search/recent endpoint. Reset at ${resetTime.toISOString()}`,
        429,
        'RATE_LIMIT_EXCEEDED'
      );
    }
    
    throw new APIError(
      `Failed to search tweets: ${error instanceof Error ? error.message : 'Unknown error'}`,
      500,
      'TWITTER_SEARCH_ERROR'
    );
  }
}

async function getRandomTweet(client: any, username: string) {
  try {
    // Check rate limit before making request
    if (!await canMakeRequest('users/by/username')) {
      throw new APIError(
        'Rate limit exceeded for user lookup endpoint',
        429,
        'RATE_LIMIT_EXCEEDED'
      );
    }

    const user = await client.v2.userByUsername(username);
    if (!user.data) {
      throw new APIError(
        `Twitter user @${username} not found`,
        404,
        'USER_NOT_FOUND'
      );
    }

    // Check rate limit before timeline request
    if (!await canMakeRequest('users/:id/tweets')) {
      throw new APIError(
        'Rate limit exceeded for timeline endpoint',
        429,
        'RATE_LIMIT_EXCEEDED'
      );
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
      throw new APIError(
        `No tweets found for user @${username}`,
        404,
        'NO_TWEETS_FOUND'
      );
    }

    // Get a random tweet from the results
    const randomIndex = Math.floor(Math.random() * tweets.data.length);
    return tweets.data[randomIndex];
  } catch (error) {
    console.error('Error getting random tweet:', error);
    
    if (error instanceof APIError) {
      throw error;
    }
    
    throw new APIError(
      `Failed to get random tweet: ${error instanceof Error ? error.message : 'Unknown error'}`,
      500,
      'TWITTER_FETCH_ERROR'
    );
  }
}

export async function GET(request: Request) {
  try {
    const searchParams = new URL(request.url).searchParams;
    const action = searchParams.get('action');
    const username = searchParams.get('username')?.replace('@', '');

    console.log('Twitter API Request:', { action, username });

    if (!action) {
      throw new APIError(
        'Missing required parameter: action',
        400,
        'MISSING_PARAMETER'
      );
    }

    // Check rate limit
    const rateLimit = await getRateLimit('twitter/api');
    const now = new Date();
    if (!await canMakeRequest('twitter/api')) {
      throw new APIError(
        'Rate limit exceeded for Twitter API',
        429,
        'RATE_LIMIT_EXCEEDED'
      );
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
          throw new APIError(
            'No tweets found',
            404,
            'NO_TWEETS_FOUND'
          );
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
        throw new APIError(
          `Invalid action parameter: ${action}`,
          400,
          'INVALID_PARAMETER'
        );
    }
  } catch (error) {
    return handleAPIError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { text, accessToken } = await request.json();
    console.log('Processing tweet post:', { hasText: !!text, hasToken: !!accessToken });

    if (!text?.trim()) {
      throw new APIError(
        'Missing required parameter: text',
        400,
        'MISSING_PARAMETER'
      );
    }

    if (!accessToken) {
      throw new APIError(
        'Authentication required: Missing access token',
        401,
        'UNAUTHORIZED'
      );
    }

    const tweet = await postTweet(text, accessToken);
    console.log('Tweet posted successfully:', tweet.id);

    return NextResponse.json(tweet);
  } catch (error) {
    return handleAPIError(error);
  }
} 