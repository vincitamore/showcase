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
import { logger, withLogging } from '@/lib/logger';

// Move helper functions outside of the route exports
async function searchRecentTweets(client: any) {
  try {
    // Check rate limit before making request
    const rateLimit = await getRateLimit('tweets/search/recent');
    if (!await canMakeRequest('tweets/search/recent')) {
      logger.warn('Rate limit exceeded for search', {
        step: 'rate-limit-check',
        endpoint: 'tweets/search/recent',
        resetAt: rateLimit?.resetAt
      });
      throw new APIError(
        `Rate limit exceeded for tweets/search/recent endpoint. Reset at ${rateLimit?.resetAt}`,
        429,
        'RATE_LIMIT_EXCEEDED'
      );
    }

    logger.info('Searching recent tweets', {
      step: 'search-start',
      query: '.build'
    });

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
      
      logger.debug('Updated rate limits', {
        step: 'rate-limit-update',
        endpoint: 'tweets/search/recent',
        remaining: searchResults.rateLimit.remaining,
        resetAt: new Date(searchResults.rateLimit.reset * 1000).toISOString()
      });
    }

    if (searchResults.data && searchResults.data.length > 0) {
      logger.info('Found matching tweets', {
        step: 'search-complete',
        count: searchResults.data.length
      });
      return searchResults.data[0]; // Return the most recent matching tweet
    }
    
    logger.info('No matching tweets found', {
      step: 'search-complete',
      query: '.build'
    });
    return null;
  } catch (error) {
    logger.error('Error searching tweets', {
      step: 'search-error',
      error
    });
    
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
      logger.warn('Rate limit exceeded for user lookup', {
        step: 'rate-limit-check',
        endpoint: 'users/by/username'
      });
      throw new APIError(
        'Rate limit exceeded for user lookup endpoint',
        429,
        'RATE_LIMIT_EXCEEDED'
      );
    }

    logger.info('Looking up user', {
      step: 'user-lookup',
      username
    });

    const user = await client.v2.userByUsername(username);
    if (!user.data) {
      logger.warn('User not found', {
        step: 'user-lookup',
        username
      });
      throw new APIError(
        `Twitter user @${username} not found`,
        404,
        'USER_NOT_FOUND'
      );
    }

    // Check rate limit before timeline request
    if (!await canMakeRequest('users/:id/tweets')) {
      logger.warn('Rate limit exceeded for timeline', {
        step: 'rate-limit-check',
        endpoint: 'users/:id/tweets'
      });
      throw new APIError(
        'Rate limit exceeded for timeline endpoint',
        429,
        'RATE_LIMIT_EXCEEDED'
      );
    }

    logger.info('Fetching user timeline', {
      step: 'timeline-fetch',
      userId: user.data.id
    });

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
      
      logger.debug('Updated user lookup rate limits', {
        step: 'rate-limit-update',
        endpoint: 'users/by/username',
        remaining: user.rateLimit.remaining,
        resetAt: new Date(user.rateLimit.reset * 1000).toISOString()
      });
    }

    if (tweets.rateLimit) {
      await updateRateLimit(
        'users/:id/tweets',
        new Date(tweets.rateLimit.reset * 1000),
        tweets.rateLimit.remaining
      );
      
      logger.debug('Updated timeline rate limits', {
        step: 'rate-limit-update',
        endpoint: 'users/:id/tweets',
        remaining: tweets.rateLimit.remaining,
        resetAt: new Date(tweets.rateLimit.reset * 1000).toISOString()
      });
    }

    if (!tweets.data || tweets.data.length === 0) {
      logger.warn('No tweets found for user', {
        step: 'timeline-fetch',
        username
      });
      throw new APIError(
        `No tweets found for user @${username}`,
        404,
        'NO_TWEETS_FOUND'
      );
    }

    // Get a random tweet from the results
    const randomIndex = Math.floor(Math.random() * tweets.data.length);
    logger.info('Selected random tweet', {
      step: 'tweet-select',
      tweetId: tweets.data[randomIndex].id,
      totalTweets: tweets.data.length
    });
    return tweets.data[randomIndex];
  } catch (error) {
    logger.error('Error getting random tweet', {
      step: 'random-tweet-error',
      username,
      error
    });
    
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

async function handleTwitterRequest(request: Request): Promise<Response> {
  const searchParams = new URL(request.url).searchParams;
  const action = searchParams.get('action');
  const username = searchParams.get('username')?.replace('@', '');

  logger.info('Processing Twitter API request', {
    step: 'request-start',
    action,
    username
  });

  if (!action) {
    logger.warn('Missing action parameter', {
      step: 'validation'
    });
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
    logger.warn('Rate limit exceeded for API', {
      step: 'rate-limit-check',
      endpoint: 'twitter/api'
    });
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
        logger.info('Using cached tweets', {
          step: 'cache-hit',
          count: cachedTweets.length
        });
        return NextResponse.json({ tweets: cachedTweets });
      }

      logger.info('Cache miss, fetching fresh tweets', {
        step: 'cache-miss'
      });
      
      const client = await getReadOnlyClient();

      // First try to find tweets with ".build"
      const buildTweet = await searchRecentTweets(client);
      
      // If no ".build" tweets found, get a random tweet from the user's timeline
      const tweet = buildTweet || (username ? await getRandomTweet(client, username) : null);

      if (!tweet) {
        logger.warn('No tweets found', {
          step: 'tweet-fetch',
          buildTweetFound: !!buildTweet,
          username
        });
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

      logger.info('Tweet fetched and cached', {
        step: 'complete',
        tweetId: tweet.id
      });
      return NextResponse.json(tweet);
    }

    default:
      logger.warn('Invalid action parameter', {
        step: 'validation',
        action
      });
      throw new APIError(
        `Invalid action parameter: ${action}`,
        400,
        'INVALID_PARAMETER'
      );
  }
}

async function handleTwitterPost(request: Request): Promise<Response> {
  const { text, accessToken } = await request.json();
  
  logger.info('Processing tweet post', {
    step: 'post-start',
    hasText: !!text,
    hasToken: !!accessToken
  });

  if (!text?.trim()) {
    logger.warn('Missing tweet text', {
      step: 'validation'
    });
    throw new APIError(
      'Missing required parameter: text',
      400,
      'MISSING_PARAMETER'
    );
  }

  if (!accessToken) {
    logger.warn('Missing access token', {
      step: 'validation'
    });
    throw new APIError(
      'Authentication required: Missing access token',
      401,
      'UNAUTHORIZED'
    );
  }

  const tweet = await postTweet(text, accessToken);
  logger.info('Tweet posted successfully', {
    step: 'complete',
    tweetId: tweet.id
  });

  return NextResponse.json(tweet);
}

export const GET = withLogging(handleTwitterRequest, 'api/twitter');
export const POST = withLogging(handleTwitterPost, 'api/twitter'); 