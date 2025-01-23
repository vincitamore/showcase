import { TwitterApi, TwitterApiv2, TweetV2, TweetPublicMetricsV2 } from 'twitter-api-v2';
import { 
  canMakeRequest,
  getRateLimitTimestamp,
  updateRateLimitTimestamp
} from '@/lib/blob-storage';

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
  // Ensure created_at is a valid ISO string if it exists
  let created_at: string | undefined;
  if (tweet.created_at) {
    try {
      // Parse and validate the date
      const date = new Date(tweet.created_at);
      if (isNaN(date.getTime())) {
        console.warn('[Twitter API] Invalid date found in tweet:', tweet.id);
        created_at = undefined;
      } else {
        created_at = date.toISOString();
      }
    } catch (error) {
      console.warn('[Twitter API] Error parsing date for tweet:', tweet.id, error);
      created_at = undefined;
    }
  }

  return {
    id: tweet.id,
    text: tweet.text,
    edit_history_tweet_ids: tweet.edit_history_tweet_ids,
    created_at,
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
  
  // Filter out tweets with invalid dates before converting
  const validTweets = tweets.filter(tweet => {
    if (!tweet.created_at) return true; // Keep tweets without dates
    try {
      const date = new Date(tweet.created_at);
      return !isNaN(date.getTime());
    } catch {
      console.warn('[Twitter API] Filtering out tweet with invalid date:', tweet.id);
      return false;
    }
  });

  return validTweets.map(tweet => convertToStoredTweet(tweet));
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
  
  // Filter out tweets with invalid dates before converting
  const validTweets = tweets.filter(tweet => {
    if (!tweet.created_at) return true; // Keep tweets without dates
    try {
      const date = new Date(tweet.created_at);
      return !isNaN(date.getTime());
    } catch {
      console.warn('[Twitter API] Filtering out tweet with invalid date:', tweet.id);
      return false;
    }
  });

  return validTweets.map(tweet => convertToStoredTweet(tweet));
}

// Initialize the read-only client for public tweet fetching using OAuth 1.0a
async function getReadOnlyClient(): Promise<TwitterApiv2> {
  console.log('[Twitter API] Initializing read-only client...');

  // Check if we can make a request based on rate limit
  const canRequest = await canMakeRequest(Date.now());
  if (!canRequest) {
    const lastUpdate = await getRateLimitTimestamp();
    console.log('[Twitter API] Rate limited during initialization, last update:', lastUpdate);
    throw new Error('Rate limited during client initialization');
  }

  const apiKey = process.env.TWITTER_API_KEY?.trim();
  const apiSecret = process.env.TWITTER_API_SECRET?.trim();
  const accessToken = process.env.TWITTER_ACCESS_TOKEN?.trim();
  const accessSecret = process.env.TWITTER_ACCESS_SECRET?.trim();

  if (!apiKey || !apiSecret || !accessToken || !accessSecret) {
    console.error('[Twitter API] Missing required credentials');
    throw new Error('Twitter API credentials not configured');
  }

  console.log('[Twitter API] Creating client with credentials:', {
    apiKeyLength: apiKey.length,
    apiSecretLength: apiSecret.length,
    accessTokenLength: accessToken.length,
    accessSecretLength: accessSecret.length
  });

  try {
    const client = new TwitterApi({
      appKey: apiKey,
      appSecret: apiSecret,
      accessToken: accessToken,
      accessSecret: accessSecret,
    });

    // Verify credentials with a test request
    const testUser = process.env.NEXT_PUBLIC_TWITTER_USERNAME;
    if (!testUser) {
      throw new Error('Twitter username not configured for verification');
    }

    try {
      await client.v2.userByUsername(testUser);
      console.log('[Twitter API] Credentials verified successfully');
      await updateRateLimitTimestamp();
      return client.v2;
    } catch (verifyError: any) {
      console.error('[Twitter API] Credential verification failed:', {
        error: verifyError.message,
        stack: verifyError.stack,
        details: verifyError.data
      });
      throw verifyError;
    }
  } catch (error: any) {
    console.error('[Twitter API] Client initialization failed:', {
      error: error.message,
      stack: error.stack,
      details: error.data
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