import { TwitterApi, TwitterApiv2, TweetV2, TweetPublicMetricsV2, TweetEntitiesV2, UserV2, ApiResponseError, TwitterApiReadOnly } from 'twitter-api-v2';
import { IncomingHttpHeaders } from 'http';
import { 
  canMakeRequest,
  updateRateLimit,
  getRateLimit,
  getCachedTweets
} from '@/lib/tweet-storage';
import { env } from '@/env';

// Rate limit configuration
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes in milliseconds

// Interface to match TweetV2 structure but only include what we need
interface StoredTweet {
  id: string;
  text: string;
  edit_history_tweet_ids: string[];
  created_at?: string;
  public_metrics?: TweetPublicMetricsV2;
  entities?: TweetEntitiesV2;
}

interface TwitterApiResponse<T> {
  data: T;
  includes?: {
    users?: UserV2[];
    media?: any[];
  };
  meta?: {
    result_count: number;
    next_token?: string;
  };
}

function convertToStoredTweet(tweet: TweetV2): StoredTweet {
  // Ensure created_at is a valid ISO string if it exists
  let created_at: string | undefined;
  if (tweet.created_at) {
    try {
      const date = new Date(tweet.created_at);
      if (isNaN(date.getTime())) {
        console.warn('[Twitter API] Invalid date found in tweet:', tweet.id);
      } else {
        created_at = date.toISOString();
      }
    } catch (error) {
      console.warn('[Twitter API] Error parsing date for tweet:', tweet.id, error);
    }
  }

  return {
    id: tweet.id,
    text: tweet.text,
    edit_history_tweet_ids: tweet.edit_history_tweet_ids,
    created_at,
    public_metrics: tweet.public_metrics,
    entities: tweet.entities
  };
}

// Helper to get rate limit values from headers
function getRateLimitValues(headers: IncomingHttpHeaders | Headers) {
  let remaining = 0;
  let resetTime = 0;

  if (headers instanceof Headers) {
    remaining = parseInt(headers.get('x-rate-limit-remaining') || '0');
    resetTime = parseInt(headers.get('x-rate-limit-reset') || '0');
  } else {
    remaining = parseInt(String(headers['x-rate-limit-remaining']) || '0');
    resetTime = parseInt(String(headers['x-rate-limit-reset']) || '0');
  }

  return { remaining, resetTime };
}

// Helper to update rate limit info from response headers
async function updateRateLimitInfo(endpoint: string, headers: Record<string, string | string[]>) {
  const now = Date.now();
  let resetTime = now + RATE_LIMIT_WINDOW;
  let remaining = 1;

  if (headers['x-rate-limit-reset']) {
    resetTime = parseInt(String(headers['x-rate-limit-reset'])) * 1000;
  }
  if (headers['x-rate-limit-remaining']) {
    remaining = parseInt(String(headers['x-rate-limit-remaining']));
  }

  // Update database rate limit info
  await updateRateLimit(endpoint, new Date(resetTime), remaining);
  
  const timeUntilReset = resetTime - now;
  console.log(`[Twitter API] Rate limit status for ${endpoint}:`, {
    reset: new Date(resetTime).toISOString(),
    remaining,
    timeUntilReset: Math.floor(timeUntilReset / 1000) + 's'
  });
}

// Helper to validate API request parameters
function validateRequestParams(endpoint: string, params: Record<string, any>): boolean {
  try {
    // Common validation for all endpoints
    if (!endpoint) {
      console.error('[Twitter API] Missing endpoint in request');
      return false;
    }

    // Search endpoint validation
    if (endpoint.includes('search')) {
      if (!params.query) {
        console.error('[Twitter API] Missing query parameter for search request', { endpoint });
        return false;
      }
      if (!params['tweet.fields']?.includes('entities')) {
        console.warn('[Twitter API] Missing entities in tweet.fields for search request', { 
          endpoint,
          fields: params['tweet.fields']
        });
      }
    }

    // Timeline endpoint validation
    if (endpoint.includes('timeline')) {
      if (!params.userId) {
        console.error('[Twitter API] Missing userId parameter for timeline request', { endpoint });
        return false;
      }
      if (!params['tweet.fields']?.includes('entities')) {
        console.warn('[Twitter API] Missing entities in tweet.fields for timeline request', {
          endpoint,
          fields: params['tweet.fields']
        });
      }
    }

    // User lookup validation
    if (endpoint.includes('users') && !params.username) {
      console.error('[Twitter API] Missing username parameter for user lookup', { endpoint });
      return false;
    }

    return true;
  } catch (error) {
    console.error('[Twitter API] Error validating request parameters', { endpoint, error });
    return false;
  }
}

// Helper to validate tweet data structure
function validateTweetResponse(response: { data?: any }, endpoint: string): boolean {
  if (!response) {
    console.error('[Twitter API] Empty response from endpoint', { endpoint });
    return false;
  }

  // For search endpoints
  if (endpoint.includes('search')) {
    if (!response.data || !Array.isArray(response.data)) {
      console.error('[Twitter API] Invalid search response structure', {
        endpoint,
        hasData: !!response.data,
        dataType: response.data ? typeof response.data : 'undefined',
        isArray: response.data ? Array.isArray(response.data) : false
      });
      return false;
    }
    return true;
  }

  // For timeline endpoints
  if (endpoint.includes('timeline')) {
    if (!response.data || !Array.isArray(response.data)) {
      console.error('[Twitter API] Invalid timeline response structure', {
        endpoint,
        hasData: !!response.data,
        dataType: response.data ? typeof response.data : 'undefined',
        isArray: response.data ? Array.isArray(response.data) : false
      });
      return false;
    }
    return true;
  }

  // For user lookup
  if (endpoint.includes('users')) {
    if (!response.data || !response.data.id) {
      console.error('[Twitter API] Invalid user response structure', {
        endpoint,
        hasData: !!response.data,
        hasId: response.data ? !!response.data.id : false
      });
      return false;
    }
    return true;
  }

  return true;
}

// Initialize read-only client for fetching tweets
export async function getReadOnlyClient() {
  console.log('[Twitter API] Initializing read-only client...');
  return new TwitterApi({
    appKey: env.TWITTER_API_KEY,
    appSecret: env.TWITTER_API_SECRET,
    accessToken: env.TWITTER_ACCESS_TOKEN,
    accessSecret: env.TWITTER_ACCESS_SECRET,
  }).v2;
}

// Execute a Twitter API request with rate limit handling
export async function executeWithRateLimit<T>(
  endpoint: string,
  params: Record<string, any>,
  request: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();

  console.log('[Twitter API] Starting rate limit check:', {
    endpoint,
    params,
    timestamp: new Date().toISOString(),
    step: 'pre-check'
  });

  // Check if we can make the request
  const rateLimit = await getRateLimit(endpoint);
  const now = new Date();

  if (rateLimit) {
    const resetTime = new Date(rateLimit.resetAt);
    const timeUntilReset = resetTime.getTime() - now.getTime();
    
    if (now < resetTime && rateLimit.remaining <= 0) {
      const error = new Error(`Rate limit exceeded for ${endpoint}. Resets in ${Math.ceil(timeUntilReset / 1000)}s`);
      console.error('[Twitter API] Rate limit exceeded:', {
        endpoint,
        resetTime: resetTime.toISOString(),
        remaining: rateLimit.remaining,
        timeUntilReset: Math.ceil(timeUntilReset / 1000) + 's',
        timestamp: now.toISOString(),
        step: 'rate-limited'
      });
      throw error;
    }
  }

  try {
    console.log('[Twitter API] Making request:', {
      endpoint,
      params,
      timestamp: new Date().toISOString(),
      checkDurationMs: Date.now() - startTime,
      step: 'pre-request'
    });

    const response = await request();

    // Update rate limit info from response headers
    const headers = (response as any)._headers;
    if (headers) {
      const { remaining, resetTime } = getRateLimitValues(headers);
      
      await updateRateLimit(endpoint, new Date(resetTime * 1000), remaining);

      console.log('[Twitter API] Rate limit updated:', {
        endpoint,
        remaining,
        resetTime: new Date(resetTime * 1000).toISOString(),
        timestamp: new Date().toISOString(),
        requestDurationMs: Date.now() - startTime,
        step: 'rate-limit-updated'
      });
    }

    return response;
  } catch (error) {
    // Handle rate limit errors
    if (error instanceof ApiResponseError) {
      const headers = error.response?.headers;
      if (headers) {
        const { remaining, resetTime } = getRateLimitValues(headers);
        
        await updateRateLimit(endpoint, new Date(resetTime * 1000), remaining);

        console.log('[Twitter API] Rate limit updated from error:', {
          endpoint,
          remaining,
          resetTime: new Date(resetTime * 1000).toISOString(),
          timestamp: new Date().toISOString(),
          errorDurationMs: Date.now() - startTime,
          step: 'rate-limit-error'
        });

        // If it's a rate limit error, add more context
        if (error.code === 429) {
          const timeUntilReset = resetTime * 1000 - Date.now();
          error.message = `Rate limit exceeded. Resets in ${Math.ceil(timeUntilReset / 1000)}s`;
        }
      }
    }
    
    console.error('[Twitter API] Request failed:', {
      endpoint,
      error: error instanceof Error ? error.message : 'Unknown error',
      code: error instanceof ApiResponseError ? error.code : undefined,
      data: error instanceof ApiResponseError ? error.data : undefined,
      timestamp: new Date().toISOString(),
      errorDurationMs: Date.now() - startTime,
      step: 'request-error'
    });
    
    throw error;
  }
}

// Get the OAuth2 URL for user login
export async function getOAuthUrl() {
  const clientId = process.env.TWITTER_CLIENT_ID;
  const clientSecret = process.env.TWITTER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('[Twitter OAuth] Missing OAuth credentials');
    throw new Error('Missing Twitter OAuth credentials');
  }

  const client = new TwitterApi({
    clientId: clientId,
    clientSecret: clientSecret,
  });
  
  const { url, state, codeVerifier } = client.generateOAuth2AuthLink(
    process.env.NEXT_PUBLIC_URL + '/api/auth/x/callback',
    { scope: ['tweet.read', 'tweet.write', 'users.read'] }
  );

  return { url, state, codeVerifier };
}

// Get authenticated client for user actions
export async function getAuthenticatedClient(accessToken: string) {
  if (!accessToken) {
    throw new Error('Access token is required for authenticated client');
  }
  return new TwitterApi(accessToken);
}

// Fetch tech-related tweets (public read-only using API Key/Secret)
export const fetchTechTweets = async (username: string) => {
  if (!username) {
    throw new Error('Username is required to fetch tweets');
  }

  // Remove @ symbol if present
  const cleanUsername = username.replace('@', '');
  
  const client = await getReadOnlyClient();
  
  // Use search endpoint instead of user lookup
  const tweets = await client.get('tweets/search/recent', {
    query: `from:${cleanUsername} -is:retweet`,
    expansions: ['author_id', 'attachments.media_keys'],
    'tweet.fields': ['created_at', 'text', 'public_metrics'],
    'user.fields': ['profile_image_url', 'username'],
    max_results: 50,
  });
  
  return tweets.data;
};

// Post a new tweet (requires OAuth 2.0 user authentication)
export const postTweet = async (text: string, accessToken: string) => {
  if (!text?.trim()) {
    throw new Error('Tweet text is required');
  }

  if (!accessToken) {
    throw new Error('Authentication required to post tweets');
  }

  const client = new TwitterApi(accessToken);
  const tweet = await client.v2.tweet(text);
  return tweet.data;
}; 