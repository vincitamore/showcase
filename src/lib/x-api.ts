import { TwitterApi } from 'twitter-api-v2';

interface RateLimitCache {
  search: {
    reset: number;
    remaining: number;
  };
  timeline: {
    reset: number;
    remaining: number;
  };
}

// Cache for rate limit info per endpoint
const rateLimitCache: RateLimitCache = {
  search: {
    reset: 0,
    remaining: 1
  },
  timeline: {
    reset: 0,
    remaining: 1
  }
};

// Helper to check if we're rate limited for a specific endpoint
function isRateLimited(endpoint: keyof RateLimitCache): boolean {
  const now = Date.now();
  const limit = rateLimitCache[endpoint];
  return limit.remaining <= 0 && now < limit.reset;
}

// Helper to update rate limit info from response headers
function updateRateLimitInfo(endpoint: keyof RateLimitCache, headers: Record<string, string | string[]>) {
  if (headers['x-rate-limit-reset']) {
    rateLimitCache[endpoint].reset = parseInt(String(headers['x-rate-limit-reset'])) * 1000; // Convert to milliseconds
  }
  if (headers['x-rate-limit-remaining']) {
    rateLimitCache[endpoint].remaining = parseInt(String(headers['x-rate-limit-remaining']));
  }
  console.log(`[Twitter API] Rate limit status for ${endpoint}:`, {
    reset: new Date(rateLimitCache[endpoint].reset).toISOString(),
    remaining: rateLimitCache[endpoint].remaining
  });
}

// Initialize the read-only client for public tweet fetching using API Key/Secret
export async function getReadOnlyClient() {
  console.log('[Twitter API] Initializing read-only client...');
  
  // Check for required environment variables
  const apiKey = process.env.TWITTER_API_KEY;
  const apiSecret = process.env.TWITTER_API_SECRET;
  
  if (!apiKey || !apiSecret) {
    console.error('[Twitter API] Missing API credentials:', {
      hasApiKey: !!apiKey,
      hasApiSecret: !!apiSecret,
      env: {
        NODE_ENV: process.env.NODE_ENV,
        VERCEL_ENV: process.env.VERCEL_ENV
      }
    });
    throw new Error('Missing Twitter API credentials in environment variables');
  }
  
  try {
    // Create client with API Key/Secret auth
    const client = new TwitterApi({
      appKey: apiKey,         // API Key
      appSecret: apiSecret,   // API Key Secret
    });

    // Get app-only bearer token
    console.log('[Twitter API] Requesting app-only bearer token...');
    const appClient = await client.appLogin();
    console.log('[Twitter API] Successfully obtained bearer token');
    
    // Wrap the client to handle rate limits
    return new Proxy(appClient, {
      get(target: TwitterApi, prop: string | symbol) {
        const value = target[prop as keyof TwitterApi];
        if (typeof value === 'function') {
          return async (...args: unknown[]) => {
            try {
              // Determine which endpoint we're calling
              const endpoint = prop === 'search' ? 'search' : 'timeline';
              
              // Check if we're rate limited
              if (isRateLimited(endpoint)) {
                const waitTime = rateLimitCache[endpoint].reset - Date.now();
                console.log(`[Twitter API] Rate limited for ${endpoint}, waiting ${Math.round(waitTime / 1000)}s`);
                throw new Error(`Rate limit exceeded for ${endpoint}`);
              }

              console.log(`[Twitter API] Making request to ${String(prop)}...`);
              const result = await (value as Function).apply(target, args);
              
              // Update rate limit info from response headers if available
              if (result?.rateLimit) {
                updateRateLimitInfo(endpoint, result.rateLimit);
              }
              
              return result;
            } catch (error) {
              // Log detailed error information
              console.error('[Twitter API] Request failed:', {
                endpoint: String(prop),
                error: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined,
                env: {
                  NODE_ENV: process.env.NODE_ENV,
                  VERCEL_ENV: process.env.VERCEL_ENV
                }
              });
              throw error;
            }
          };
        }
        return value;
      }
    });
  } catch (error) {
    console.error('[Twitter API] Failed to initialize client:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      env: {
        NODE_ENV: process.env.NODE_ENV,
        VERCEL_ENV: process.env.VERCEL_ENV
      }
    });
    throw error;
  }
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
  const user = await client.v2.userByUsername(cleanUsername);
  
  if (!user.data) {
    throw new Error('User not found');
  }

  const tweets = await client.v2.userTimeline(user.data.id, {
    exclude: ['replies', 'retweets'],
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