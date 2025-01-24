import { TwitterApi, TwitterApiv2, TweetV2, TweetPublicMetricsV2, TweetEntitiesV2 } from 'twitter-api-v2';
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

// Cache for rate limit info per endpoint
const rateLimitCache: RateLimitCache = {};

// Interface to match TweetV2 structure but only include what we need
interface StoredTweet {
  id: string;
  text: string;
  edit_history_tweet_ids: string[];
  created_at?: string;
  public_metrics?: TweetPublicMetricsV2;
  entities?: any;
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

// Helper to safely execute rate-limited API calls with retries
async function executeWithRateLimit<T>(
  endpoint: string,
  operation: () => Promise<T>,
  retryCount = 0
): Promise<T> {
  try {
    // During build time, only use cached data
    if (process.env.VERCEL_ENV === 'production' && process.env.NEXT_PHASE === 'build') {
      if (endpoint.includes('search') || endpoint.includes('timeline')) {
        const cachedData = await getCachedTweets();
        if (cachedData?.tweets?.length) {
          console.log(`[Twitter API] Using cached data during build for ${endpoint}`);
          return cachedData as any;
        }
        throw new Error('No cached data available during build');
      }
      throw new Error('API calls not allowed during build time');
    }

    if (isRateLimited(endpoint)) {
      const waitTime = rateLimitCache[endpoint].reset - Date.now();
      console.log(`[Twitter API] Rate limited for ${endpoint}, waiting ${Math.round(waitTime / 1000)}s`);
      
      // If we have cached data, use it
      if (endpoint.includes('search') || endpoint.includes('timeline')) {
        const cachedData = await getCachedTweets();
        if (cachedData?.tweets?.length) {
          console.log(`[Twitter API] Using cached data for ${endpoint}`);
          return cachedData as any;
        }
      }
      
      throw new Error(`Rate limit exceeded for ${endpoint}`);
    }

    const result = await operation();
    return result;
  } catch (error: any) {
    // Only retry once for rate limit errors
    if (error?.data?.status === 429 && retryCount < 1) {
      const delay = BASE_RETRY_DELAY * (0.5 + Math.random());
      console.log(`[Twitter API] Rate limited, retrying in ${Math.round(delay)}ms (attempt ${retryCount + 1}/1)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return executeWithRateLimit(endpoint, operation, retryCount + 1);
    }
    throw error;
  }
}

// Helper to validate and clean tweet data
function validateTweet(tweet: any): TweetV2 | null {
  try {
    // Handle null/undefined
    if (!tweet) {
      console.warn('[Twitter] Null or undefined tweet');
      return null;
    }

    // Create a clean copy of the tweet with empty entities
    const cleanTweet: TweetV2 = {
      id: tweet.id,
      text: tweet.text,
      edit_history_tweet_ids: tweet.edit_history_tweet_ids,
      public_metrics: tweet.public_metrics,
      entities: {
        urls: [],
        mentions: [],
        hashtags: [],
        cashtags: [],
        annotations: []
      } as TweetEntitiesV2
    };

    // Ensure required fields exist
    if (!cleanTweet.id || !cleanTweet.text || !Array.isArray(cleanTweet.edit_history_tweet_ids)) {
      console.warn('[Twitter] Invalid tweet structure:', {
        id: tweet.id,
        hasText: !!tweet.text,
        hasEditHistory: Array.isArray(tweet.edit_history_tweet_ids)
      });
      return null;
    }

    // Handle created_at separately
    if (tweet.created_at) {
      try {
        // Handle both ISO string and timestamp formats
        const date = new Date(tweet.created_at);
        if (!isNaN(date.getTime())) {
          cleanTweet.created_at = date.toISOString();
        } else {
          console.warn('[Twitter] Invalid date found in tweet:', {
            id: tweet.id,
            date: tweet.created_at
          });
        }
      } catch (error) {
        console.warn('[Twitter] Error parsing date for tweet:', {
          id: tweet.id,
          date: tweet.created_at,
          error
        });
      }
    }

    // Handle entities
    if (tweet.entities) {
      try {
        // Deep clone entities to avoid reference issues
        const clonedEntities = JSON.parse(JSON.stringify(tweet.entities));
        const entities = cleanTweet.entities as TweetEntitiesV2;
        
        // Validate and clean URLs
        if (Array.isArray(clonedEntities.urls)) {
          entities.urls = clonedEntities.urls.map((url: any) => ({
            start: url.start || url.indices?.[0] || 0,
            end: url.end || url.indices?.[1] || 0,
            url: url.url || '',
            expanded_url: url.expanded_url || url.url || '',
            display_url: url.display_url || url.expanded_url || url.url || '',
            title: url.title,
            description: url.description,
            unwound_url: url.unwound_url,
            images: url.images?.map((img: any) => ({
              url: img.url,
              width: img.width || 0,
              height: img.height || 0
            }))
          }));
        }

        // Copy other entity types if they exist
        if (Array.isArray(clonedEntities.mentions)) {
          entities.mentions = clonedEntities.mentions.map((mention: any) => ({
            start: mention.start || mention.indices?.[0] || 0,
            end: mention.end || mention.indices?.[1] || 0,
            username: mention.username || '',
            id: mention.id || ''
          }));
        }
        if (Array.isArray(clonedEntities.hashtags)) {
          entities.hashtags = clonedEntities.hashtags.map((hashtag: any) => ({
            start: hashtag.start || hashtag.indices?.[0] || 0,
            end: hashtag.end || hashtag.indices?.[1] || 0,
            tag: hashtag.tag || hashtag.text || ''
          }));
        }
        if (Array.isArray(clonedEntities.cashtags)) {
          entities.cashtags = clonedEntities.cashtags.map((cashtag: any) => ({
            start: cashtag.start || cashtag.indices?.[0] || 0,
            end: cashtag.end || cashtag.indices?.[1] || 0,
            tag: cashtag.tag || cashtag.text || ''
          }));
        }
        if (Array.isArray(clonedEntities.annotations)) {
          entities.annotations = clonedEntities.annotations.map((annotation: any) => ({
            start: annotation.start || annotation.indices?.[0] || 0,
            end: annotation.end || annotation.indices?.[1] || 0,
            probability: annotation.probability || 0,
            type: annotation.type || '',
            normalized_text: annotation.normalized_text || ''
          }));
        }

        // Log entity processing results
        console.log('[Twitter] Processed entities:', {
          id: tweet.id,
          entityTypes: Object.keys(entities),
          urlCount: entities.urls.length,
          mentionCount: entities.mentions.length,
          hashtagCount: entities.hashtags.length,
          annotationCount: entities.annotations.length,
          cashtagCount: entities.cashtags.length
        });
      } catch (error) {
        console.warn('[Twitter] Error processing entities:', {
          id: tweet.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return cleanTweet;
  } catch (error) {
    console.warn('[Twitter] Error validating tweet:', error);
    return null;
  }
}

// Helper to safely process tweets
function processTweets(tweets: any[]): TweetV2[] {
  if (!Array.isArray(tweets)) {
    console.warn('[Twitter] Invalid tweets array:', typeof tweets);
    return [];
  }

  const validTweets = tweets
    .map(tweet => validateTweet(tweet))
    .filter((tweet): tweet is TweetV2 => tweet !== null);

  console.log('[Twitter] Processed tweets:', {
    total: tweets.length,
    valid: validTweets.length,
    invalid: tweets.length - validTweets.length
  });

  return validTweets;
}

async function searchBuildTweets(client: TwitterApiv2): Promise<TweetV2[]> {
  return executeWithRateLimit('search', async () => {
    console.log('[Init] Searching for .build tweets...');
    const query = '(.build) lang:en -is:retweet -is:reply';
    console.log('[Init] Using search query:', query);
    
    const paginator = await client.search(query, {
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
    
    return processTweets(tweets);
  });
}

async function getUserTweets(client: TwitterApiv2, username: string): Promise<TweetV2[]> {
  return executeWithRateLimit('timeline', async () => {
    console.log('[Init] Fetching user tweets...');
    const user = await client.userByUsername(username);
    if (!user?.data) {
      throw new Error('User not found');
    }

    const paginator = await client.userTimeline(user.data.id, {
      'exclude': ['retweets'],
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
    
    return processTweets(tweets);
  });
}

// Initialize the read-only client for public tweet fetching using OAuth 1.0a
export async function getReadOnlyClient(): Promise<TwitterApiv2> {
  // During build time, return null client to prevent API calls
  if (process.env.VERCEL_ENV === 'production' && process.env.NEXT_PHASE === 'build') {
    throw new Error('API client not available during build phase');
  }

  console.log('[Twitter API] Initializing read-only client...');

  // Check if we can make a request based on rate limit
  const now = Date.now();
  const lastUpdate = await getRateLimitTimestamp();
  
  // Calculate time windows
  const minutesSinceLastUpdate = lastUpdate ? Math.floor((now - lastUpdate) / (60 * 1000)) : Infinity;
  const withinRateLimit = lastUpdate ? (now - lastUpdate) < RATE_LIMIT_WINDOW : false;
  const timeUntilReset = lastUpdate ? Math.max(0, (lastUpdate + RATE_LIMIT_WINDOW - now) / 1000) : 0;
  
  console.log('[Twitter API] Rate limit evaluation:', {
    lastUpdate: lastUpdate ?? 'none',
    lastUpdateDate: lastUpdate ? new Date(lastUpdate).toISOString() : 'never',
    minutesSinceLastUpdate,
    withinRateLimit,
    timeUntilReset: Math.round(timeUntilReset) + 's',
    rateLimitWindow: RATE_LIMIT_WINDOW / 1000 + 's',
    now: new Date(now).toISOString()
  });

  // Block requests if we're within the rate limit window and have a valid last update
  if (withinRateLimit && lastUpdate && lastUpdate > 0) {
    console.log('[Twitter API] Rate limit check failed:', {
      reason: 'Within rate limit window',
      minutesSinceLastUpdate,
      timeUntilReset: Math.round(timeUntilReset) + 's'
    });
    throw new Error('Rate limit window active');
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
      throw new Error('Twitter username not configured');
    }

    try {
      await executeWithRateLimit('verify', async () => {
        const response = await client.v2.userByUsername(testUser);
        console.log('[Twitter API] Credentials verified successfully');
        
        // Only update timestamp on successful request
        if (response?.data) {
          await updateRateLimitTimestamp();
          console.log('[Twitter API] Updated rate limit timestamp after successful verification');
        }
      });
      return client.v2;
    } catch (verifyError: any) {
      // Check if this is a Twitter API rate limit response
      if (verifyError?.data?.status === 429) {
        console.error('[Twitter API] Twitter rate limit exceeded:', {
          error: verifyError.message,
          status: verifyError.data?.status,
          retryAfter: verifyError.data?.headers?.['retry-after'],
          rateLimitReset: verifyError.data?.headers?.['x-rate-limit-reset']
        });
        throw new Error('Twitter API rate limit exceeded during verification');
      }
      
      console.error('[Twitter API] Credential verification failed:', {
        error: verifyError.message,
        status: verifyError.data?.status,
        details: verifyError.data
      });
      throw verifyError;
    }
  } catch (error: any) {
    console.error('[Twitter API] Client initialization failed:', {
      error: error.message,
      status: error.data?.status,
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