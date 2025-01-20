import { TwitterApi } from 'twitter-api-v2';

interface RateLimitCache {
  reset: number;
  remaining: number;
  backoffAttempt: number;
}

interface TwitterError extends Error {
  code?: number;
  rateLimit?: {
    reset: number;
    remaining: number;
  };
}

// Cache for rate limit info
let rateLimitCache: RateLimitCache = {
  reset: 0,
  remaining: 1,
  backoffAttempt: 0
};

// Helper to check if we're rate limited
function isRateLimited(): boolean {
  return rateLimitCache.remaining <= 0 && Date.now() < rateLimitCache.reset * 1000;
}

// Helper to update rate limit info from response headers
function updateRateLimitInfo(headers: Record<string, string | string[]>) {
  if (headers['x-rate-limit-reset']) {
    rateLimitCache.reset = parseInt(String(headers['x-rate-limit-reset']));
  }
  if (headers['x-rate-limit-remaining']) {
    rateLimitCache.remaining = parseInt(String(headers['x-rate-limit-remaining']));
  }
}

// Helper for exponential backoff
async function waitForRateLimit(): Promise<void> {
  const now = Date.now();
  const resetTime = rateLimitCache.reset * 1000;
  
  if (now < resetTime) {
    // Calculate backoff time (exponential with max of 2 minutes)
    const backoffMs = Math.min(
      Math.pow(2, rateLimitCache.backoffAttempt) * 1000,
      120000
    );
    console.warn(`Rate limited, waiting ${backoffMs/1000} seconds before retry`);
    await new Promise(resolve => setTimeout(resolve, backoffMs));
    rateLimitCache.backoffAttempt++;
  } else {
    // Reset backoff if we're past the reset time
    rateLimitCache.backoffAttempt = 0;
    rateLimitCache.remaining = 1;
  }
}

// Initialize the read-only client for public tweet fetching
export async function getReadOnlyClient() {
  if (!process.env.TWITTER_API_KEY || !process.env.TWITTER_API_SECRET) {
    throw new Error('Missing Twitter API credentials in environment variables');
  }

  // Create client with app-only auth
  const client = new TwitterApi({
    appKey: process.env.TWITTER_API_KEY,
    appSecret: process.env.TWITTER_API_SECRET,
  });

  // Get app-only client
  const appClient = await client.appLogin();
  
  // Wrap the client to handle rate limits
  return new Proxy(appClient, {
    get(target: TwitterApi, prop: string | symbol) {
      const value = target[prop as keyof TwitterApi];
      if (typeof value === 'function') {
        return async (...args: unknown[]) => {
          try {
            if (isRateLimited()) {
              await waitForRateLimit();
            }
            const result = await (value as Function).apply(target, args);
            // Update rate limit info from successful response
            if (result?.rateLimit) {
              updateRateLimitInfo({
                'x-rate-limit-reset': String(result.rateLimit.reset),
                'x-rate-limit-remaining': String(result.rateLimit.remaining)
              });
            }
            return result;
          } catch (error) {
            const twitterError = error as TwitterError;
            if (twitterError.code === 429) {
              // Update rate limit info from error response
              if (twitterError.rateLimit) {
                updateRateLimitInfo({
                  'x-rate-limit-reset': String(twitterError.rateLimit.reset),
                  'x-rate-limit-remaining': String(twitterError.rateLimit.remaining)
                });
              }
              await waitForRateLimit();
              // Retry the request
              return (value as Function).apply(target, args);
            }
            throw error;
          }
        };
      }
      return value;
    }
  });
}

// Get the OAuth2 URL for login
export async function getOAuthUrl() {
  if (!process.env.TWITTER_CLIENT_ID) {
    throw new Error('Missing Twitter Client ID in environment variables');
  }

  const client = new TwitterApi({
    clientId: process.env.TWITTER_CLIENT_ID,
    clientSecret: process.env.TWITTER_API_SECRET,
  });
  
  // Generate OAuth 2.0 URL
  const { url, state, codeVerifier } = client.generateOAuth2AuthLink(
    process.env.NEXT_PUBLIC_URL + '/api/auth/x/callback',
    { scope: ['tweet.read', 'tweet.write', 'users.read'] }
  );

  return { url, state, codeVerifier };
}

// Fetch tech-related tweets (public read-only)
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

// Post a new tweet (requires authentication)
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

export async function getAuthenticatedClient(accessToken: string) {
  return new TwitterApi(accessToken);
} 