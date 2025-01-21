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
            // Determine which endpoint we're calling
            const endpoint = prop === 'search' ? 'search' : 'timeline';
            
            // Check if we're rate limited
            if (isRateLimited(endpoint)) {
              const waitTime = rateLimitCache[endpoint].reset - Date.now();
              console.log(`[Twitter API] Rate limited for ${endpoint}, waiting ${Math.round(waitTime / 1000)}s`);
              throw new Error(`Rate limit exceeded for ${endpoint}`);
            }

            const result = await (value as Function).apply(target, args);
            
            // Update rate limit info from successful response
            if (result?.rateLimit) {
              updateRateLimitInfo(endpoint, {
                'x-rate-limit-reset': String(result.rateLimit.reset),
                'x-rate-limit-remaining': String(result.rateLimit.remaining)
              });
            }
            
            return result;
          } catch (error) {
            if (error instanceof Error && error.message.includes('429')) {
              // Update rate limit info and throw custom error
              const endpoint = prop === 'search' ? 'search' : 'timeline';
              rateLimitCache[endpoint].remaining = 0;
              rateLimitCache[endpoint].reset = Date.now() + (15 * 60 * 1000); // 15 minutes from now
              console.log(`[Twitter API] Rate limit hit for ${endpoint}, reset at:`, new Date(rateLimitCache[endpoint].reset).toISOString());
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