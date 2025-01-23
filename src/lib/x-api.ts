import { TwitterApi, TwitterApiv2, TweetV2, TweetPublicMetricsV2 } from 'twitter-api-v2';

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

// Interface to match TweetV2 structure but only include what we need
interface StoredTweet {
  id: string;
  text: string;
  edit_history_tweet_ids: string[];
  created_at?: string;
  public_metrics?: TweetPublicMetricsV2;
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

function convertToStoredTweet(tweet: TweetV2): StoredTweet {
  return {
    id: tweet.id,
    text: tweet.text,
    edit_history_tweet_ids: tweet.edit_history_tweet_ids,
    created_at: tweet.created_at,
    public_metrics: tweet.public_metrics
  };
}

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

async function searchBuildTweets(client: TwitterApiv2): Promise<StoredTweet[]> {
  console.log('[Init] Searching for .build tweets...');
  const paginator = await client.search('".build" lang:en -is:retweet', {
    'tweet.fields': ['created_at', 'public_metrics', 'entities'],
    'max_results': 10
  });

  const page = await paginator.fetchNext();
  if (!page?.data) {
    console.log('[Init] No .build tweets found');
    return [];
  }

  const tweets = Array.isArray(page.data) ? page.data : [page.data];
  console.log('[Init] Found .build tweets:', tweets.length);
  return tweets.map(tweet => convertToStoredTweet(tweet));
}

async function getUserTweets(client: TwitterApiv2, username: string): Promise<StoredTweet[]> {
  console.log('[Init] Fetching user tweets...');
  const user = await client.userByUsername(username);
  if (!user?.data) {
    throw new Error('User not found');
  }

  const paginator = await client.userTimeline(user.data.id, {
    'exclude': ['replies', 'retweets'],
    'tweet.fields': ['created_at', 'public_metrics', 'entities'],
    'max_results': 10
  });

  const page = await paginator.fetchNext();
  if (!page?.data) {
    console.log('[Init] No user tweets found');
    return [];
  }

  const tweets = Array.isArray(page.data) ? page.data : [page.data];
  console.log('[Init] Found user tweets:', tweets.length);
  return tweets.map(tweet => convertToStoredTweet(tweet));
}

// Initialize the read-only client for public tweet fetching using OAuth 1.0a
export async function getReadOnlyClient() {
  console.log('[Twitter API] Initializing read-only client...');
  
  // Check for required environment variables
  const apiKey = process.env.TWITTER_API_KEY?.trim();
  const apiSecret = process.env.TWITTER_API_SECRET?.trim();
  const accessToken = process.env.TWITTER_ACCESS_TOKEN?.trim();
  const accessSecret = process.env.TWITTER_ACCESS_SECRET?.trim();
  
  if (!apiKey || !apiSecret || !accessToken || !accessSecret) {
    console.error('[Twitter API] Missing or empty API credentials:', {
      hasApiKey: !!apiKey,
      apiKeyLength: apiKey?.length,
      hasApiSecret: !!apiSecret,
      apiSecretLength: apiSecret?.length,
      hasAccessToken: !!accessToken,
      accessTokenLength: accessToken?.length,
      hasAccessSecret: !!accessSecret,
      accessSecretLength: accessSecret?.length,
      env: {
        NODE_ENV: process.env.NODE_ENV,
        VERCEL_ENV: process.env.VERCEL_ENV
      }
    });
    throw new Error('Missing or empty Twitter API credentials in environment variables');
  }
  
  try {
    console.log('[Twitter API] Creating client with credentials:', {
      apiKeyLength: apiKey.length,
      apiSecretLength: apiSecret.length,
      accessTokenLength: accessToken.length,
      accessSecretLength: accessSecret.length
    });

    // Create client with OAuth 1.0a User Context auth
    const client = new TwitterApi({
      appKey: apiKey,         // API Key
      appSecret: apiSecret,   // API Key Secret
      accessToken: accessToken,     // Access Token
      accessSecret: accessSecret,   // Access Token Secret
    });

    // Test the credentials with a public endpoint that works with OAuth 1.0a
    try {
      // Use a public endpoint that doesn't require user context
      const testUser = process.env.NEXT_PUBLIC_TWITTER_USERNAME;
      if (!testUser) {
        throw new Error('NEXT_PUBLIC_TWITTER_USERNAME is required for credential verification');
      }
      
      const result = await client.v2.userByUsername(testUser);
      if (!result?.data) {
        throw new Error('Failed to verify credentials - no data returned');
      }
      console.log('[Twitter API] Credentials verified successfully');
    } catch (error) {
      console.error('[Twitter API] Credential verification failed:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        details: error instanceof Error && 'data' in error ? error.data : undefined
      });
      
      // Check for specific error conditions
      if (error instanceof Error) {
        if (error.message.includes('401')) {
          throw new Error('Invalid Twitter API credentials - please check your API keys and tokens');
        } else if (error.message.includes('403')) {
          throw new Error('Twitter API access forbidden - please check your app permissions');
        }
      }
      throw new Error('Twitter API credential verification failed');
    }

    const v2Client = client.v2;
    console.log('[Twitter API] Client initialized with OAuth 1.0a User Context authentication');
    
    // Wrap the client to handle rate limits
    return new Proxy(v2Client, {
      get(target: TwitterApiv2, prop: string | symbol) {
        const value = target[prop as keyof TwitterApiv2];
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
                details: error instanceof Error && 'data' in error ? error.data : undefined,
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
      details: error instanceof Error && 'data' in error ? error.data : undefined,
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
  const user = await client.userByUsername(cleanUsername);
  
  if (!user.data) {
    throw new Error('User not found');
  }

  const tweets = await client.userTimeline(user.data.id, {
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