import { NextResponse } from 'next/server';
import { getReadOnlyClient } from '@/lib/x-api';
import { 
  cacheTweets,
  getRateLimitTimestamp,
  updateRateLimitTimestamp,
  getCachedTweets,
  canMakeRequest,
  updateSelectedTweets
} from '@/lib/blob-storage';
import { 
  TwitterApiv2, 
  TweetV2, 
  TweetPublicMetricsV2, 
  TweetEntitiesV2, 
  TweetEntityUrlV2,
  UserV2, 
  MediaObjectV2 
} from 'twitter-api-v2';

type TweetEntities = {
  urls: TweetEntityUrlV2[];
  mentions: { start: number; end: number; username: string; id: string; }[];
  hashtags: { start: number; end: number; tag: string; }[];
  cashtags: { start: number; end: number; tag: string; }[];
  annotations: { start: number; end: number; probability: number; type: string; normalized_text: string; }[];
};

interface TweetWithAuthor extends TweetV2 {
  author?: {
    id: string;
    name: string;
    username: string;
    profile_image_url?: string;
  };
  media?: MediaObjectV2[];
  entities: TweetEntities;
}

// Helper function to check if a tweet has any type of entity
function hasTweetEntities(tweet: TweetV2): boolean {
  if (!tweet.entities) return false;

  const hasUrls = !!tweet.entities.urls?.length;
  const hasMentions = !!tweet.entities.mentions?.length;
  const hasHashtags = !!tweet.entities.hashtags?.length;
  const hasAnnotations = !!tweet.entities.annotations?.length;
  const hasCashtags = !!tweet.entities.cashtags?.length;

  return hasUrls || hasMentions || hasHashtags || hasAnnotations || hasCashtags;
}

// Helper function to extract user data from includes
function extractUserData(includes: any): Map<string, UserV2> {
  if (!includes?.users) return new Map();
  
  const userMap = new Map<string, UserV2>();
  includes.users.forEach((user: UserV2) => {
    if (user.id) {
      userMap.set(user.id, {
        id: user.id,
        name: user.name || '',
        username: user.username || '',
        profile_image_url: user.profile_image_url
      });
    }
  });
  
  return userMap;
}

// Helper function to extract media data from includes
function extractMediaData(includes: any): Map<string, MediaObjectV2> {
  if (!includes?.media) return new Map();
  
  const mediaMap = new Map<string, MediaObjectV2>();
  includes.media.forEach((media: MediaObjectV2) => {
    if (media.media_key) {
      mediaMap.set(media.media_key, {
        media_key: media.media_key,
        type: media.type,
        url: media.url,
        preview_image_url: media.preview_image_url,
        height: media.height,
        width: media.width
      });
    }
  });
  
  return mediaMap;
}

// Helper function to validate and clean tweet data
function validateTweet(
  tweet: TweetV2, 
  userData?: Map<string, UserV2>,
  mediaData?: Map<string, MediaObjectV2>
): TweetWithAuthor | null {
  try {
    // Handle null/undefined
    if (!tweet) {
      logStatus('Null or undefined tweet');
      return null;
    }

    // Initialize entities with empty arrays and proper type assertion
    const entities = {
      urls: [] as TweetEntityUrlV2[],
      mentions: [] as { start: number; end: number; username: string; id: string; }[],
      hashtags: [] as { start: number; end: number; tag: string; }[],
      cashtags: [] as { start: number; end: number; tag: string; }[],
      annotations: [] as { start: number; end: number; probability: number; type: string; normalized_text: string; }[]
    } satisfies TweetEntities;

    // Create a clean copy of the tweet with initialized entities
    const cleanTweet: TweetWithAuthor = {
      id: tweet.id,
      text: tweet.text,
      edit_history_tweet_ids: tweet.edit_history_tweet_ids,
      public_metrics: tweet.public_metrics,
      created_at: '', // Initialize created_at
      author_id: tweet.author_id,
      entities
    };

    // Add author data if available
    if (tweet.author_id && userData?.has(tweet.author_id)) {
      cleanTweet.author = userData.get(tweet.author_id);
    }

    // Add media data if available
    if (tweet.attachments?.media_keys && mediaData) {
      cleanTweet.media = tweet.attachments.media_keys
        .map(key => mediaData.get(key))
        .filter((media): media is MediaObjectV2 => !!media);
    }

    // Extract URLs from tweet text if no entities exist
    if (!tweet.entities?.urls || tweet.entities.urls.length === 0) {
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const matches = tweet.text.match(urlRegex);
      
      if (matches) {
        cleanTweet.entities.urls = matches.map((url) => {
          const start = tweet.text.indexOf(url);
          return {
            start,
            end: start + url.length,
            url,
            expanded_url: url,
            display_url: url.replace(/^https?:\/\//, ''),
            unwound_url: url,
            images: [],
            status: '200',
            title: '',
            description: ''
          } as TweetEntityUrlV2;
        });
        
        logStatus('Extracted URLs from text', {
          id: tweet.id,
          urls: cleanTweet.entities.urls
        });
      }
    } else if (tweet.entities?.urls) {
      cleanTweet.entities.urls = tweet.entities.urls;
    }

    // Log the full tweet structure for debugging
    const entityTypes = Object.keys(cleanTweet.entities).filter(key => 
      Array.isArray(cleanTweet.entities[key as keyof TweetEntities]) && 
      cleanTweet.entities[key as keyof TweetEntities].length > 0
    );

    logStatus('Validating tweet', {
      id: tweet.id,
      hasEntities: !!cleanTweet.entities && cleanTweet.entities.urls.length > 0,
      entityTypes,
      urlCount: cleanTweet.entities.urls.length,
      hasCreatedAt: !!tweet.created_at,
      hasAuthorId: !!tweet.author_id,
      hasAuthorData: !!cleanTweet.author,
      hasMediaKeys: !!tweet.attachments?.media_keys,
      mediaCount: cleanTweet.media?.length || 0,
      fullTweet: tweet
    });

    return cleanTweet;
  } catch (error) {
    logStatus('Error validating tweet', {
      error: error instanceof Error ? error.message : 'Unknown error',
      tweet: tweet?.id
    });
    return null;
  }
}

// Helper function to get random items from array with priority for tweets with entities
function getRandomItems(array: TweetWithAuthor[], count: number): TweetWithAuthor[] {
  if (!array?.length || count <= 0) {
    logStatus('Invalid input for getRandomItems', {
      arrayLength: array?.length,
      requestedCount: count
    });
    return [];
  }

  // Validate and clean tweets before processing
  const validTweets = array
    .map(tweet => validateTweet(tweet))
    .filter((tweet): tweet is TweetWithAuthor => tweet !== null);

  if (validTweets.length === 0) {
    logStatus('No valid tweets found');
    return [];
  }

  // Sort tweets by created_at to prioritize newer tweets
  const sortedTweets = [...validTweets].sort((a, b) => {
    const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
    return dateB - dateA; // Newest first
  });

  // Take the newest 40 tweets to select from
  const recentTweets = sortedTweets.slice(0, 40);
  
  // Separate tweets with and without entities
  const tweetsWithEntities = recentTweets.filter(t => hasTweetEntities(t));
  const tweetsWithoutEntities = recentTweets.filter(t => !hasTweetEntities(t));
  
  logStatus('Tweet selection stats', {
    totalTweets: validTweets.length,
    recentTweets: recentTweets.length,
    withEntities: tweetsWithEntities.length,
    withoutEntities: tweetsWithoutEntities.length,
    validDates: recentTweets.filter(t => !!t.created_at).length
  });
  
  // Try to maintain a ratio of 3:1 for tweets with entities
  const targetWithEntities = Math.min(Math.ceil(count * 0.75), tweetsWithEntities.length);
  const remainingCount = count - targetWithEntities;
  
  // Randomly select tweets with entities
  const selectedWithEntities = [...tweetsWithEntities]
    .sort(() => 0.5 - Math.random())
    .slice(0, targetWithEntities);
  
  // Fill remaining slots with tweets without entities
  const selectedWithoutEntities = [...tweetsWithoutEntities]
    .sort(() => 0.5 - Math.random())
    .slice(0, remainingCount);
  
  // Combine and shuffle the final selection
  const selected = [...selectedWithEntities, ...selectedWithoutEntities]
    .sort(() => 0.5 - Math.random());
  
  logStatus('Selected tweets', {
    total: selected.length,
    withEntities: selected.filter(t => hasTweetEntities(t)).length,
    withoutEntities: selected.filter(t => !hasTweetEntities(t)).length,
    dates: selected.map(t => t.created_at)
  });
  
  return selected;
}

// Vercel Cron Job - runs every 5 minutes but respects 15-minute rate limit
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 10; // 10 seconds timeout

const FIFTEEN_MINUTES = 15 * 60 * 1000;

function logStatus(message: string, data?: any) {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0]; // HH:mm:ss only
  console.log(`[CRON ${timestamp}] ${message}`, data ? JSON.stringify(data) : '');
}

async function checkRateLimit() {
  try {
    const now = Date.now();
    const canRequest = await canMakeRequest(now);
    
    logStatus('Rate limit check', {
      canRequest,
      timestamp: new Date(now).toISOString()
    });
    
    return canRequest;
  } catch (error) {
    logStatus('Rate limit check failed', { error: error instanceof Error ? error.message : 'Unknown error' });
    return false;
  }
}

async function searchNewBuildTweets(client: TwitterApiv2, cachedTweets: TweetWithAuthor[]): Promise<TweetWithAuthor[] | null> {
  try {
    logStatus('Searching .build tweets');
    const query = '(.build) lang:en -is:retweet -is:reply';
    
    const searchResults = await client.search(query, {
      'tweet.fields': ['created_at', 'public_metrics', 'entities', 'author_id', 'attachments'],
      'user.fields': ['profile_image_url', 'username', 'name'],
      'media.fields': ['url', 'preview_image_url', 'height', 'width', 'type'],
      expansions: ['author_id', 'attachments.media_keys'],
      max_results: 10,
    });

    if (!searchResults?.data) {
      logStatus('No .build tweets found');
      return null;
    }

    // Extract user and media data from includes
    const userData = extractUserData(searchResults.includes);
    const mediaData = extractMediaData(searchResults.includes);
    
    // Validate tweets with user and media data
    const tweets = Array.isArray(searchResults.data) ? searchResults.data : [searchResults.data];
    const validatedTweets = tweets
      .map(tweet => validateTweet(tweet, userData, mediaData))
      .filter((tweet): tweet is TweetWithAuthor => tweet !== null);
    
    logStatus('Search results', {
      found: tweets.length,
      valid: validatedTweets.length,
      withEntities: validatedTweets.filter(t => hasTweetEntities(t)).length
    });
    
    return validatedTweets;
  } catch (error) {
    logStatus('Search failed', { error: error instanceof Error ? error.message : 'Unknown error' });
    return null;
  }
}

async function getRandomUserTweet(client: TwitterApiv2, username: string): Promise<TweetWithAuthor[] | null> {
  try {
    logStatus('Fetching user tweets', { username });
    const user = await client.userByUsername(username);
    if (!user?.data) {
      logStatus('User not found', { username });
      throw new Error('User not found');
    }

    const timeline = await client.userTimeline(user.data.id, {
      exclude: ['retweets'],  // Allow replies to increase chances of finding tweets
      'tweet.fields': ['created_at', 'public_metrics', 'entities', 'author_id', 'attachments'],
      'user.fields': ['profile_image_url', 'username', 'name'],
      'media.fields': ['url', 'preview_image_url', 'height', 'width', 'type'],
      expansions: ['author_id', 'attachments.media_keys'],
      max_results: 20, // Increased to get more candidates
    });

    if (!timeline?.data?.data) {
      logStatus('No timeline tweets found');
      return null;
    }

    // Extract user and media data from includes
    const userData = extractUserData(timeline.includes);
    const mediaData = extractMediaData(timeline.includes);
    logStatus('Extracted includes data', {
      userCount: userData.size,
      userIds: Array.from(userData.keys()),
      mediaCount: mediaData.size,
      mediaKeys: Array.from(mediaData.keys())
    });

    const tweets = Array.isArray(timeline.data.data) ? timeline.data.data : [timeline.data.data];
    
    // Validate tweets with user and media data
    const validTweets = tweets
      .map(tweet => validateTweet(tweet, userData, mediaData))
      .filter((tweet): tweet is TweetWithAuthor => tweet !== null);
    
    // Separate tweets with and without entities
    const tweetsWithEntities = validTweets.filter(t => hasTweetEntities(t));
    const tweetsWithoutEntities = validTweets.filter(t => !hasTweetEntities(t));
    
    logStatus('Timeline results', {
      totalFound: tweets.length,
      validTweets: validTweets.length,
      withEntities: tweetsWithEntities.length,
      withoutEntities: tweetsWithoutEntities.length,
      withAuthorData: validTweets.filter(t => !!t.author).length,
      withMedia: validTweets.filter(t => !!t.media && t.media.length > 0).length
    });
    
    // Prefer tweets with entities if available
    if (tweetsWithEntities.length > 0) {
      const randomIndex = Math.floor(Math.random() * tweetsWithEntities.length);
      return [tweetsWithEntities[randomIndex]];
    }
    
    // Fallback to tweets without entities
    if (validTweets.length > 0) {
      const randomIndex = Math.floor(Math.random() * validTweets.length);
      return [validTweets[randomIndex]];
    }

    return null;
  } catch (error) {
    logStatus('Error fetching random user tweet', { error: error instanceof Error ? error.message : 'Unknown error' });
    return null;
  }
}

// Add detailed logging for tweet processing
function logTweetProcessing(tweets: TweetV2[], validTweets: TweetWithAuthor[]) {
  console.log('[CRON] Processing tweets:', {
    total: tweets.length,
    valid: validTweets.length,
    withMedia: validTweets.filter(t => t.media?.length).length,
    withEntities: validTweets.filter(t => 
      t.entities?.urls?.length || 
      t.entities?.mentions?.length || 
      t.entities?.hashtags?.length
    ).length,
    timestamp: new Date().toISOString()
  });
}

// Add detailed logging for search results
function logSearchResults(results: any) {
  console.log('[CRON] Search results:', {
    tweets: results.data?.length || 0,
    includes: {
      users: results.includes?.users?.length || 0,
      media: results.includes?.media?.length || 0
    },
    meta: results.meta,
    timestamp: new Date().toISOString()
  });
}

export async function GET(req: Request) {
  console.log('[CRON] Starting tweet fetch:', {
    timestamp: new Date().toISOString()
  });

  const startTime = Date.now();
  logStatus('Starting cron job');
  
  try {
    // Verify this is a Vercel cron invocation
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      console.error('[CRON] Unauthorized request');
      return new Response('Unauthorized', { status: 401 });
    }

    const canRequest = await checkRateLimit();
    if (!canRequest) {
      logStatus('Rate limited, skipping fetch');
      return new Response('Rate limited', { status: 429 });
    }

    // Update rate limit timestamp before making requests
    const now = Date.now();
    await updateRateLimitTimestamp(now);
    
    // Get currently cached tweets
    const cachedData = await getCachedTweets();
    const currentTweets = (cachedData?.tweets || []) as TweetWithAuthor[];
    logStatus('Cache status', { 
      tweets: currentTweets.length,
      withEntities: currentTweets.filter(hasTweetEntities).length
    });

    // Initialize client
    const client = await getReadOnlyClient();
    const username = process.env.NEXT_PUBLIC_TWITTER_USERNAME;
    if (!username) {
      throw new Error('Twitter username not configured');
    }

    // Fetch new tweets
    const newBuildTweets = await searchNewBuildTweets(client, currentTweets);
    const userTweets = await getRandomUserTweet(client, username);

    const newTweets = [
      ...(newBuildTweets || []),
      ...(userTweets || [])
    ];

    if (newTweets.length === 0) {
      logStatus('No new tweets fetched, using cache for rotation');
      const selectedTweets = getRandomItems(currentTweets, 7);
      await updateSelectedTweets(selectedTweets);
      
      return NextResponse.json({
        message: 'Used cached tweets',
        selectedTweets: selectedTweets.length,
        withEntities: selectedTweets.filter(hasTweetEntities).length,
        executionTimeMs: Date.now() - startTime
      });
    }

    // Validate and update cache
    const validNewTweets = newTweets
      .map(tweet => validateTweet(tweet))
      .filter((tweet): tweet is TweetWithAuthor => tweet !== null);

    // Update cache with new tweets while maintaining uniqueness
    const tweetMap = new Map<string, TweetWithAuthor>();
    
    // Add new tweets first to prioritize them
    validNewTweets.forEach(tweet => tweetMap.set(tweet.id, tweet));
    
    // Add existing tweets that aren't duplicates
    currentTweets.forEach(tweet => {
      if (!tweetMap.has(tweet.id)) {
        const validTweet = validateTweet(tweet);
        if (validTweet) {
          tweetMap.set(tweet.id, validTweet);
        }
      }
    });

    const updatedTweets = Array.from(tweetMap.values())
      .sort((a, b) => {
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return dateB - dateA; // Newest first
      })
      .slice(0, 100); // Keep only the 100 newest tweets

    await cacheTweets(updatedTweets);
    
    logStatus('Cache updated', {
      new: validNewTweets.length,
      total: updatedTweets.length,
      withEntities: updatedTweets.filter(hasTweetEntities).length
    });

    // Select new display tweets, prioritizing new tweets
    const selectedTweets = getRandomItems([...validNewTweets, ...updatedTweets], 7);
    await updateSelectedTweets(selectedTweets);
    
    logStatus('Display tweets updated', {
      selected: selectedTweets.length,
      withEntities: selectedTweets.filter(hasTweetEntities).length,
      newTweetsSelected: selectedTweets.filter(t => 
        validNewTweets.some(newT => newT.id === t.id)
      ).length
    });

    const executionTime = Date.now() - startTime;
    return NextResponse.json({
      message: 'Success',
      newTweets: validNewTweets.length,
      totalTweets: updatedTweets.length,
      selectedTweets: selectedTweets.length,
      executionTimeMs: executionTime
    });
  } catch (error) {
    const executionTime = Date.now() - startTime;
    logStatus('Job failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      executionTimeMs: executionTime
    });
    
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      executionTimeMs: executionTime
    }, { status: 500 });
  }
} 

