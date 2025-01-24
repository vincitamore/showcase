import { list, put, del } from '@vercel/blob';
import { TwitterApi, TweetV2, Tweetv2TimelineResult } from 'twitter-api-v2';

interface CachedTweets {
  tweets: TweetV2[];
  timestamp: string;
}

// Cache keys
export const CACHE_KEY_PREFIX = 'tweets';
export const CURRENT_CACHE_FILE = 'tweets/current.json';
export const PREVIOUS_CACHE_FILE = 'tweets/previous.json';
export const RATE_LIMIT_PREFIX = 'rate-limit';
export const RATE_LIMIT_FILE = 'rate-limit/timestamp.txt';
export const SELECTED_TWEETS_FILE = 'tweets/selected.json';

// Constants
export const FIFTEEN_MINUTES = 15 * 60 * 1000; // 15 minutes in milliseconds
export const MAX_TWEETS = 100;
export const STORAGE_LIMIT_MB = 450; // Cleanup when approaching 500MB
export const BYTES_PER_MB = 1024 * 1024;

export interface SelectedTweets {
  tweets: TweetV2[];
  timestamp: string;
}

interface BlobInfo {
  pathname: string;
  url: string;
  size: number;
  uploadedAt: Date;
}

// Helper function to check if a tweet has entities with URLs
function hasTweetEntities(tweet: TweetV2): boolean {
  // Only log full entities in development
  if (process.env.NODE_ENV === 'development') {
    console.log('[Twitter] Checking entities for tweet:', {
      id: tweet.id,
      hasEntities: !!tweet.entities,
      entityTypes: tweet.entities ? Object.keys(tweet.entities) : [],
      urlCount: tweet.entities?.urls?.length || 0
    });
  }

  // Check for any type of entity, not just URLs
  if (!tweet.entities) return false;

  // Check for various entity types that exist in TweetEntitiesV2
  const hasUrls = !!tweet.entities.urls?.length;
  const hasMentions = !!tweet.entities.mentions?.length;
  const hasHashtags = !!tweet.entities.hashtags?.length;
  const hasAnnotations = !!tweet.entities.annotations?.length;
  const hasCashtags = !!tweet.entities.cashtags?.length;

  const hasAnyEntity = hasUrls || hasMentions || hasHashtags || hasAnnotations || hasCashtags;

  // Only log detailed entity presence in development
  if (process.env.NODE_ENV === 'development') {
    console.log('[Twitter] Entity detection result:', {
      id: tweet.id,
      hasUrls,
      hasMentions,
      hasHashtags,
      hasAnnotations,
      hasCashtags,
      hasAnyEntity
    });
  }

  return hasAnyEntity;
}

async function checkStorageUsage(): Promise<number> {
  try {
    // Check all tweet-related storage
    const { blobs: currentBlobs } = await list({ prefix: 'tweets/' });
    const totalBytes = currentBlobs.reduce((acc, blob) => acc + (blob.size || 0), 0);
    const totalMB = totalBytes / BYTES_PER_MB;
    
    console.log('Current tweet storage usage:', {
      totalMB: Math.round(totalMB * 100) / 100,
      totalFiles: currentBlobs.length,
      files: currentBlobs.map(b => b.pathname)
    });
    
    return totalMB;
  } catch (error) {
    console.error('Error checking storage usage:', error);
    return 0;
  }
}

async function cleanupOldCachedTweets(): Promise<void> {
  try {
    const currentUsageMB = await checkStorageUsage();
    
    if (currentUsageMB < STORAGE_LIMIT_MB) {
      console.log('Storage usage below limit, no cleanup needed');
      return;
    }
    
    console.log('Storage usage exceeds limit, starting cleanup...');
    const { blobs } = await list({ prefix: 'tweets/' });
    
    // Sort blobs by date, keeping most recent
    const sortedBlobs = blobs
      .filter(blob => !blob.pathname.includes('current.json') && !blob.pathname.includes('selected.json'))
      .map(blob => ({
        pathname: blob.pathname,
        url: blob.url,
        size: blob.size || 0,
        uploadedAt: new Date(blob.uploadedAt || Date.now())
      }))
      .sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());
    
    // Delete all but the most recent previous cache
    const blobsToDelete = sortedBlobs.slice(1);
    
    // Delete old blobs
    for (const blob of blobsToDelete) {
      console.log('Deleting old cached tweets file:', blob.pathname);
      await del(blob.url);
    }
    
    console.log('Cleanup completed:', {
      filesKept: sortedBlobs.length - blobsToDelete.length,
      filesDeleted: blobsToDelete.length
    });
  } catch (error) {
    console.error('Error during storage cleanup:', error);
  }
}

// Migration function to handle transition from old to new cache files
async function migrateOldCacheFiles(): Promise<void> {
  try {
    console.log('Checking for old cache files...');
    const { blobs: oldBlobs } = await list({ prefix: 'cached-tweets' });
    
    if (oldBlobs.length === 0) {
      console.log('No old cache files found');
      return;
    }
    
    // Sort by date, newest first
    const sortedBlobs = oldBlobs
      .map(blob => ({
        ...blob,
        uploadedAt: new Date(blob.uploadedAt || Date.now())
      }))
      .sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());
    
    // Get the two most recent files
    const [newest, secondNewest] = sortedBlobs;
    
    if (newest) {
      console.log('Migrating newest cache file:', newest.pathname);
      const response = await fetch(newest.url);
      if (response.ok) {
        const data = await response.text();
        await put(CURRENT_CACHE_FILE, data, {
          contentType: 'application/json',
          access: 'public',
          addRandomSuffix: false
        });
        await del(newest.url);
      }
    }
    
    if (secondNewest) {
      console.log('Migrating second newest cache file:', secondNewest.pathname);
      const response = await fetch(secondNewest.url);
      if (response.ok) {
        const data = await response.text();
        await put(PREVIOUS_CACHE_FILE, data, {
          contentType: 'application/json',
          access: 'public',
          addRandomSuffix: false
        });
        await del(secondNewest.url);
      }
    }
    
    // Delete any remaining old cache files
    const remainingBlobs = sortedBlobs.slice(2);
    for (const blob of remainingBlobs) {
      console.log('Deleting old cache file:', blob.pathname);
      await del(blob.url);
    }
    
    console.log('Cache migration completed:', {
      migratedCurrent: !!newest,
      migratedPrevious: !!secondNewest,
      deletedOld: remainingBlobs.length
    });
  } catch (error) {
    console.error('Error during cache migration:', error);
  }
}

export async function getCachedTweets(): Promise<CachedTweets | null> {
  try {
    // First try to get current cache
    const { blobs: currentBlobs } = await list({ prefix: CURRENT_CACHE_FILE });
    let cacheBlob = currentBlobs[0];
    
    // If no current cache, try previous
    if (!cacheBlob) {
      const { blobs: previousBlobs } = await list({ prefix: PREVIOUS_CACHE_FILE });
      cacheBlob = previousBlobs[0];
      
      // If still no cache found, try migrating old cache files
      if (!cacheBlob) {
        await migrateOldCacheFiles();
        // Try again after migration
        const { blobs: migratedBlobs } = await list({ prefix: CURRENT_CACHE_FILE });
        cacheBlob = migratedBlobs[0];
      }
    }
    
    // If no cache found at all
    if (!cacheBlob) {
      console.log('No cached tweets found');
      return null;
    }
    
    // Fetch the blob content
    const response = await fetch(cacheBlob.url);
    if (!response.ok) {
      console.error('Failed to fetch cache content:', response.statusText);
      return null;
    }
    
    const data = await response.json();
    if (!data?.tweets || !Array.isArray(data.tweets)) {
      console.error('Invalid cache data structure');
      return null;
    }
    
    console.log('Retrieved cached tweets:', {
      source: cacheBlob.pathname,
      count: data.tweets.length,
      withEntities: data.tweets.filter(hasTweetEntities).length
    });
    
    return data;
  } catch (error) {
    console.error('Error getting cached tweets:', error);
    return null;
  }
}

export async function cacheTweets(tweets: TweetV2[]): Promise<void> {
  try {
    // Ensure we don't exceed the maximum number of tweets
    const tweetsToCache = tweets.slice(0, MAX_TWEETS);
    
    const cachedData: CachedTweets = {
      tweets: tweetsToCache,
      timestamp: Date.now().toString()
    };
    
    // First, try to get current cache
    const { blobs: currentBlobs } = await list({ prefix: CURRENT_CACHE_FILE });
    
    // If current cache exists, move it to previous
    if (currentBlobs.length > 0) {
      console.log('Moving current cache to previous');
      const currentResponse = await fetch(currentBlobs[0].url);
      if (currentResponse.ok) {
        const currentData = await currentResponse.text();
        await put(PREVIOUS_CACHE_FILE, currentData, {
          contentType: 'application/json',
          access: 'public',
          addRandomSuffix: false
        });
      }
      // Delete old current cache
      await del(currentBlobs[0].url);
    }
    
    // Delete old previous cache if it exists
    const { blobs: previousBlobs } = await list({ prefix: PREVIOUS_CACHE_FILE });
    if (previousBlobs.length > 0) {
      console.log('Deleting old previous cache');
      await del(previousBlobs[0].url);
    }
    
    // Store new tweets as current cache
    console.log('Storing new tweets as current cache', {
      count: tweetsToCache.length,
      withEntities: tweetsToCache.filter(hasTweetEntities).length
    });
    
    await put(CURRENT_CACHE_FILE, JSON.stringify(cachedData), {
      contentType: 'application/json',
      access: 'public',
      addRandomSuffix: false
    });
    
    console.log('Successfully cached tweets:', {
      count: tweetsToCache.length,
      timestamp: new Date().toISOString(),
      withEntities: tweetsToCache.filter(hasTweetEntities).length,
      currentFile: CURRENT_CACHE_FILE,
      previousFile: PREVIOUS_CACHE_FILE
    });
  } catch (error) {
    console.error('Error caching tweets:', error);
    throw error; // Propagate error to caller
  }
}

export async function getRateLimitTimestamp(): Promise<number | null> {
  try {
    console.log('Getting rate limit timestamp...');
    const { blobs } = await list({ prefix: RATE_LIMIT_FILE });
    
    if (blobs.length === 0) {
      console.log('No rate limit timestamp found');
      return null;
    }
    
    const response = await fetch(blobs[0].url);
    console.log('Rate limit fetch response status:', response.status);
    
    if (!response.ok) {
      console.error('Failed to fetch rate limit timestamp:', response.statusText);
      return null;
    }
    
    const text = await response.text();
    console.log('Received rate limit timestamp:', text);
    
    const timestamp = parseInt(text);
    if (isNaN(timestamp)) {
      console.error('Invalid timestamp format:', text);
      return null;
    }
    
    console.log('Parsed rate limit timestamp:', {
      timestamp,
      date: new Date(timestamp).toISOString(),
      age: Math.round((Date.now() - timestamp) / 1000) + 's'
    });
    
    return timestamp;
  } catch (error) {
    console.error('Error getting rate limit timestamp:', error);
    return null;
  }
}

export async function updateRateLimitTimestamp(): Promise<void> {
  try {
    const now = Date.now();
    
    // Delete any existing timestamp file
    const { blobs } = await list({ prefix: RATE_LIMIT_FILE });
    if (blobs.length > 0) {
      await del(blobs[0].url);
    }
    
    // Store new timestamp
    await put(RATE_LIMIT_FILE, now.toString(), {
      contentType: 'text/plain',
      access: 'public',
      addRandomSuffix: false
    });
    
    console.log('Updated rate limit timestamp:', {
      timestamp: now,
      date: new Date(now).toISOString()
    });
  } catch (error) {
    console.error('Error updating rate limit timestamp:', error);
    throw error;
  }
}

export async function updateSelectedTweets(tweets: TweetV2[]): Promise<void> {
  try {
    console.log('Updating selected tweets...', {
      count: tweets.length,
      withEntities: tweets.filter(hasTweetEntities).length
    });
    
    const data: SelectedTweets = {
      tweets,
      timestamp: Date.now().toString()
    };
    
    await put(SELECTED_TWEETS_FILE, JSON.stringify(data), {
      access: 'public',
      addRandomSuffix: false,
      contentType: 'application/json'
    });
    
    console.log('Selected tweets updated:', {
      count: tweets.length,
      timestamp: new Date(data.timestamp).toISOString(),
      filename: SELECTED_TWEETS_FILE,
      withEntities: tweets.filter(hasTweetEntities).length
    });
  } catch (error) {
    console.error('Error updating selected tweets:', error);
    throw error;
  }
}

// Helper function to get random items ensuring at least one has entities
function getRandomTweetsWithOneEntity(tweets: TweetV2[], count: number): TweetV2[] {
  // First, separate tweets with and without entities
  const tweetsWithEntities = tweets.filter(hasTweetEntities);
  const tweetsWithoutEntities = tweets.filter(t => !hasTweetEntities(t));
  
  // If no tweets with entities, just return random selection
  if (tweetsWithEntities.length === 0) {
    console.log('No tweets with entities available');
    return getRandomItems(tweets, count);
  }
  
  // Get one random tweet with entities
  const selectedEntityTweet = getRandomItems(tweetsWithEntities, 1)[0];
  
  // Combine remaining tweets and get random selection
  const remainingTweets = tweets.filter(t => t.id !== selectedEntityTweet.id);
  const additionalTweets = getRandomItems(remainingTweets, count - 1);
  
  // Combine and shuffle the final selection
  const finalSelection = [selectedEntityTweet, ...additionalTweets];
  return getRandomItems(finalSelection, finalSelection.length);
}

export async function getSelectedTweets(): Promise<SelectedTweets | null> {
  try {
    console.log('Getting selected tweets...');
    const { blobs } = await list({ prefix: SELECTED_TWEETS_FILE });
    
    if (blobs.length === 0) {
      // If no selected tweets, try to get from current cache
      console.log('No selected tweets found, checking current cache...');
      const currentCache = await getCachedTweets();
      if (currentCache?.tweets.length) {
        // Select tweets ensuring at least one has entities
        const selectedTweets = getRandomTweetsWithOneEntity(currentCache.tweets, 4);
        if (selectedTweets.length) {
          await updateSelectedTweets(selectedTweets);
          return {
            tweets: selectedTweets,
            timestamp: Date.now().toString()
          };
        }
      }
      return null;
    }
    
    const response = await fetch(blobs[0].url);
    if (!response.ok) {
      console.error('Failed to fetch selected tweets:', response.statusText);
      return null;
    }
    
    const data = await response.json() as SelectedTweets;
    
    // Check if selected tweets are older than 15 minutes
    const timestamp = parseInt(data.timestamp);
    if (!isNaN(timestamp) && Date.now() - timestamp >= FIFTEEN_MINUTES) {
      console.log('Selected tweets are older than 15 minutes, selecting new ones...');
      const currentCache = await getCachedTweets();
      if (currentCache?.tweets.length) {
        // Filter out currently selected tweets to ensure rotation
        const availableTweets = currentCache.tweets.filter(tweet => 
          !data.tweets.some(selected => selected.id === tweet.id)
        );
        if (availableTweets.length) {
          const selectedTweets = getRandomTweetsWithOneEntity(availableTweets, 4);
          if (selectedTweets.length) {
            await updateSelectedTweets(selectedTweets);
            return {
              tweets: selectedTweets,
              timestamp: Date.now().toString()
            };
          }
        }
      }
    }
    
    console.log('Retrieved selected tweets:', {
      count: data.tweets.length,
      timestamp: new Date(data.timestamp).toISOString(),
      withEntities: data.tweets.filter(hasTweetEntities).length,
      tweetIds: data.tweets.map(t => t.id)
    });
    
    return data;
  } catch (error) {
    console.error('Error getting selected tweets:', error);
    return null;
  }
}

// Helper function to get random items from an array
function getRandomItems<T>(array: T[], count: number): T[] {
  const shuffled = [...array].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

export async function canMakeRequest(now: number): Promise<boolean> {
  try {
    const lastTimestamp = await getRateLimitTimestamp();
    if (!lastTimestamp) {
      console.log('No previous request timestamp found, allowing request');
      return true;
    }
    
    const minutesSinceLastRequest = Math.floor((now - lastTimestamp) / (60 * 1000));
    const withinRateLimit = (now - lastTimestamp) < FIFTEEN_MINUTES;
    
    console.log('Rate limit check:', {
      lastTimestamp,
      lastRequestDate: new Date(lastTimestamp).toISOString(),
      minutesSinceLastRequest,
      withinRateLimit,
      timeUntilReset: Math.max(0, Math.round((lastTimestamp + FIFTEEN_MINUTES - now) / 1000)) + 's'
    });
    
    return !withinRateLimit;
  } catch (error) {
    console.error('Error checking rate limit:', error);
    return false;
  }
}

export async function searchBuildTweets(client: TwitterApi) {
  console.log('Searching for build tweets...')
  try {
    const tweets = await client.v2.search('(from:vincit_amore) -is:reply -is:retweet', {
      'tweet.fields': ['created_at', 'public_metrics', 'entities', 'attachments'],
      'user.fields': ['profile_image_url', 'username', 'name'],
      'media.fields': ['url', 'preview_image_url'],
      expansions: ['author_id', 'attachments.media_keys'],
      max_results: 10
    })
    
    const tweetData = tweets.data.data // Access the array of tweets
    console.log('Search results:', {
      count: tweetData?.length || 0,
      hasEntities: tweetData?.some((t: TweetV2) => !!t.entities) || false,
      sampleTweet: tweetData?.[0] ? {
        id: tweetData[0].id,
        text: tweetData[0].text.substring(0, 50) + '...',
        hasEntities: !!tweetData[0].entities,
        urlCount: tweetData[0].entities?.urls?.length || 0
      } : null
    })
    
    return tweets
  } catch (error) {
    console.error('Error searching tweets:', error)
    throw error
  }
}

export async function getUserTweets(client: TwitterApi, userId: string) {
  console.log('Fetching user tweets...')
  try {
    const tweets = await client.v2.userTimeline(userId, {
      exclude: ['replies', 'retweets'],
      'tweet.fields': ['created_at', 'public_metrics', 'entities', 'attachments'],
      'user.fields': ['profile_image_url', 'username', 'name'],
      'media.fields': ['url', 'preview_image_url'],
      expansions: ['author_id', 'attachments.media_keys'],
      max_results: 10
    })
    
    const tweetData = tweets.data.data // Access the array of tweets
    console.log('User timeline results:', {
      count: tweetData?.length || 0,
      hasEntities: tweetData?.some((t: TweetV2) => !!t.entities) || false,
      sampleTweet: tweetData?.[0] ? {
        id: tweetData[0].id,
        text: tweetData[0].text.substring(0, 50) + '...',
        hasEntities: !!tweetData[0].entities,
        urlCount: tweetData[0].entities?.urls?.length || 0
      } : null
    })
    
    return tweets
  } catch (error) {
    console.error('Error fetching user tweets:', error)
    throw error
  }
}

export async function saveTweets(tweets: TweetV2[]) {
  console.log('Saving tweets to blob storage...')
  try {
    const data: SelectedTweets = {
      tweets,
      timestamp: new Date().toISOString()
    }
    await put(SELECTED_TWEETS_FILE, JSON.stringify(data), {
      access: 'public',
      addRandomSuffix: false,
      contentType: 'application/json'
    });
    console.log('Successfully saved tweets')
  } catch (error) {
    console.error('Error saving tweets:', error)
    throw error
  }
} 