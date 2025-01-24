import { TwitterApi, TwitterApiv2, TweetV2, TweetPublicMetricsV2, TweetEntitiesV2, UserV2, ApiResponseError } from 'twitter-api-v2';
import { 
  canMakeRequest,
  getRateLimitTimestamp,
  updateRateLimitTimestamp,
  getCachedTweets
} from '@/lib/blob-storage';

// Rate limit configuration
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes in milliseconds
const MAX_RETRIES = 3;
const BASE_RETRY_DELAY = 15000; // 15 seconds base delay

interface RateLimitInfo {
  reset: number;
  remaining: number;
  lastUpdated: number;
}

interface RateLimitCache {
  [key: string]: RateLimitInfo;
}

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

// Helper to check if we're rate limited for a specific endpoint
function isRateLimited(endpoint: string): boolean {
  const now = Date.now();
  const limit = rateLimitCache[endpoint];
  
  if (!limit) return false;
  
  // If the rate limit info is stale (older than 15 minutes), consider it expired
  if (now - limit.lastUpdated > RATE_LIMIT_WINDOW) {
    delete rateLimitCache[endpoint];
    return false;
  }
  
  return limit.remaining <= 0 && now < limit.reset;
}

// Helper to update rate limit info from response headers
function updateRateLimitInfo(endpoint: string, headers: Record<string, string | string[]>) {
  const now = Date.now();
  
  if (!rateLimitCache[endpoint]) {
    rateLimitCache[endpoint] = {
      reset: now + RATE_LIMIT_WINDOW,
      remaining: 1,
      lastUpdated: now
    };
  }
  
  if (headers['x-rate-limit-reset']) {
    rateLimitCache[endpoint].reset = parseInt(String(headers['x-rate-limit-reset'])) * 1000;
  }
  if (headers['x-rate-limit-remaining']) {
    rateLimitCache[endpoint].remaining = parseInt(String(headers['x-rate-limit-remaining']));
  }
  rateLimitCache[endpoint].lastUpdated = now;
  
  console.log(`[Twitter API] Rate limit status for ${endpoint}:`, {
    reset: new Date(rateLimitCache[endpoint].reset).toISOString(),
    remaining: rateLimitCache[endpoint].remaining,
    timeUntilReset: Math.round((rateLimitCache[endpoint].reset - now) / 1000) + 's'
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

// Add detailed logging for API requests
async function logApiRequest(endpoint: string, params: Record<string, any>) {
  console.log('[Twitter API] Making request:', {
    endpoint,
    params,
    timestamp: new Date().toISOString()
  });
}

// Add detailed logging for API responses
async function logApiResponse(endpoint: string, response: any, error?: any) {
  if (error) {
    console.error('[Twitter API] Request failed:', {
      endpoint,
      error: error instanceof Error ? error.message : 'Unknown error',
      status: error.status,
      data: error.data,
      timestamp: new Date().toISOString()
    });
    return;
  }

  console.log('[Twitter API] Request succeeded:', {
    endpoint,
    status: 'success',
    resultCount: response?.data?.length || 0,
    includes: {
      users: response?.includes?.users?.length || 0,
      media: response?.includes?.media?.length || 0,
      tweets: response?.includes?.tweets?.length || 0
    },
    timestamp: new Date().toISOString()
  });
}

// Separate rate limits for different endpoints
const RATE_LIMITS = {
  verify: 15 * 60 * 1000,    // 15 minutes
  search: 15 * 60 * 1000,    // 15 minutes
  timeline: 15 * 60 * 1000,  // 15 minutes
  default: 15 * 60 * 1000    // 15 minutes fallback
};

// Track rate limits per endpoint using RateLimitInfo interface
const rateLimitCache: RateLimitCache = {};

// Helper functions for rate limit checking
async function checkEndpointRateLimit(endpoint: string): Promise<boolean> {
  const now = Date.now();
  const lastRequest = rateLimitCache[endpoint]?.reset || 0;
  const limit = RATE_LIMITS[endpoint as keyof typeof RATE_LIMITS] || RATE_LIMITS.default;
  
  console.log('[Twitter API] Endpoint rate limit check:', {
    endpoint,
    lastRequest: new Date(lastRequest).toISOString(),
    timeSince: `${Math.floor((now - lastRequest) / 1000)}s`,
    limit: `${limit / 1000}s`,
    canRequest: (now - lastRequest) >= limit
  });
  
  return (now - lastRequest) >= limit;
}

async function updateEndpointRateLimit(endpoint: string): Promise<void> {
  rateLimitCache[endpoint] = {
    reset: Date.now() + RATE_LIMIT_WINDOW,
    remaining: 1,
    lastUpdated: Date.now()
  };
}

// Helper to safely execute rate-limited API calls
export async function executeWithRateLimit<T>(
  endpoint: string,
  params: Record<string, any>,
  execute: () => Promise<T>
): Promise<T> {
  if (isRateLimited(endpoint)) {
    throw new Error(`Rate limit in effect for endpoint: ${endpoint}`);
  }

  try {
    await logApiRequest(endpoint, params);
    const result = await execute();
    await logApiResponse(endpoint, result);
    return result;
  } catch (error) {
    if (error instanceof ApiResponseError && error.code === 429) {
      console.log('[Twitter API] Rate limit exceeded:', {
        endpoint,
        params,
        error: error.message,
        rateLimitReset: error.rateLimit?.reset
      });
      
      // Update rate limit info with the reset time if available
      if (error.rateLimit?.reset) {
        updateRateLimitInfo(endpoint, {
          'x-rate-limit-reset': String(error.rateLimit.reset),
          'x-rate-limit-remaining': '0'
        });
      }
    }
    await logApiResponse(endpoint, null, error);
    throw error;
  }
}

// Initialize the read-only client for public tweet fetching using OAuth 1.0a
export async function getReadOnlyClient(): Promise<TwitterApiv2> {
  console.log('[Twitter API] Initializing read-only client...');
  
  // Check credentials before creating client
  const apiKey = process.env.TWITTER_API_KEY;
  const apiSecret = process.env.TWITTER_API_SECRET;
  const accessToken = process.env.TWITTER_ACCESS_TOKEN;
  const accessSecret = process.env.TWITTER_ACCESS_SECRET;

  if (!apiKey || !apiSecret || !accessToken || !accessSecret) {
    throw new Error('Twitter credentials not configured');
  }

  // Create client without immediate verification
  const client = new TwitterApi({
    appKey: apiKey,
    appSecret: apiSecret,
    accessToken: accessToken,
    accessSecret: accessSecret,
  });

  return client.v2;
}

// Get the OAuth2 URL for user login (using CLIENT_ID/CLIENT_SECRET)
export async function getOAuthUrl() {
  const clientId = process.env.TWITTER_CLIENT_ID;
  const clientSecret = process.env.TWITTER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('[Twitter OAuth] Missing OAuth credentials:', {
      hasClientId: !!clientId,
      hasClientSecret: !!clientSecret
    });
    throw new Error('Missing Twitter OAuth credentials');
  }

  const client = new TwitterApi({
    clientId: clientId,
    clientSecret: clientSecret,
  });
  
  // Generate OAuth 2.0 URL for user authentication
  const { url, state, codeVerifier } = client.generateOAuth2AuthLink(
    process.env.NEXT_PUBLIC_URL + '/api/auth/x/callback',
    { scope: ['tweet.read', 'tweet.write', 'users.read'] }
  );

  return { url, state, codeVerifier };
}

// Fetch tech-related tweets (public read-only using API Key/Secret)
export const fetchTechTweets = async (username: string) => {
  if (!username) {
    throw new Error('Username is required to fetch tweets');
  }

  // Remove @ symbol if present
  const cleanUsername = username.replace('@', '');
  
  const client = await getReadOnlyClient();
  const user = await client.userByUsername(cleanUsername);
  
  if (!user.data) {
    throw new Error('User not found');
  }

  const tweets = await client.userTimeline(user.data.id, {
    exclude: ['retweets'],  // Only exclude retweets, allow replies
    expansions: ['author_id', 'attachments.media_keys'],
    'tweet.fields': ['created_at', 'text', 'public_metrics'],
    'user.fields': ['profile_image_url', 'username'],
    max_results: 10,
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

// Get authenticated client for user actions (using OAuth 2.0)
export async function getAuthenticatedClient(accessToken: string) {
  if (!accessToken) {
    throw new Error('Access token is required for authenticated client');
  }
  return new TwitterApi(accessToken);
} 