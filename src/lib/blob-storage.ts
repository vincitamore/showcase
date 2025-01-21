import { list, put, del } from '@vercel/blob';
import { TweetV2 } from 'twitter-api-v2';

interface CachedTweets {
  tweets: TweetV2[];
  timestamp: number;
}

// Cache keys
export const CACHE_KEY_PREFIX = 'cached-tweets';
export const RATE_LIMIT_PREFIX = 'rate-limit-timestamp';
export const RATE_LIMIT_FILE = 'rate-limit-timestamp.txt';
export const SELECTED_TWEETS_FILE = 'selected-tweets.json';

// Constants
export const FIFTEEN_MINUTES = 15 * 60 * 1000; // 15 minutes in milliseconds
export const MAX_TWEETS = 100;
export const STORAGE_LIMIT_MB = 450; // Cleanup when approaching 500MB
export const BYTES_PER_MB = 1024 * 1024;

export interface SelectedTweets {
  tweets: TweetV2[];
  timestamp: number;
}

interface BlobInfo {
  pathname: string;
  url: string;
  size: number;
  uploadedAt: Date;
}

async function checkStorageUsage(): Promise<number> {
  try {
    const { blobs } = await list({ prefix: CACHE_KEY_PREFIX });
    const totalBytes = blobs.reduce((acc, blob) => acc + (blob.size || 0), 0);
    const totalMB = totalBytes / BYTES_PER_MB;
    
    console.log('Current blob storage usage:', {
      totalMB: Math.round(totalMB * 100) / 100,
      totalFiles: blobs.length
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
    const { blobs } = await list({ prefix: CACHE_KEY_PREFIX });
    
    // Sort blobs by date, keeping most recent
    const sortedBlobs = blobs
      .map(blob => ({
        pathname: blob.pathname,
        url: blob.url,
        size: blob.size || 0,
        uploadedAt: new Date(blob.uploadedAt || Date.now())
      }))
      .sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());
    
    let currentSize = 0;
    const blobsToKeep: BlobInfo[] = [];
    const blobsToDelete: BlobInfo[] = [];
    
    // Keep adding blobs until we hit 80% of our limit
    for (const blob of sortedBlobs) {
      const newSize = currentSize + (blob.size / BYTES_PER_MB);
      if (newSize < STORAGE_LIMIT_MB * 0.8) {
        blobsToKeep.push(blob);
        currentSize = newSize;
      } else {
        blobsToDelete.push(blob);
      }
    }
    
    // Delete old blobs
    for (const blob of blobsToDelete) {
      console.log('Deleting old cached tweets file:', blob.pathname);
      await del(blob.url);
    }
    
    console.log('Cleanup completed:', {
      filesKept: blobsToKeep.length,
      filesDeleted: blobsToDelete.length,
      newSizeMB: Math.round(currentSize * 100) / 100
    });
  } catch (error) {
    console.error('Error during storage cleanup:', error);
  }
}

export async function getCachedTweets(): Promise<CachedTweets | null> {
  try {
    console.log('Listing blobs with prefix:', CACHE_KEY_PREFIX);
    const { blobs } = await list({ prefix: CACHE_KEY_PREFIX });
    console.log('Found blobs:', blobs.map(b => ({ url: b.url, pathname: b.pathname })));
    
    if (blobs.length === 0) {
      console.log('No blobs found with prefix:', CACHE_KEY_PREFIX);
      return null;
    }
    
    // Sort by pathname to get the most recent blob (they have timestamps in the name)
    const sortedBlobs = blobs.sort((a, b) => b.pathname.localeCompare(a.pathname));
    console.log('Using most recent blob:', sortedBlobs[0].pathname);
    
    const response = await fetch(sortedBlobs[0].url);
    console.log('Fetch response status:', response.status);
    
    if (!response.ok) {
      console.error('Failed to fetch blob content:', response.statusText);
      return null;
    }
    
    const text = await response.text();
    console.log('Received blob content:', text.substring(0, 100) + '...');
    
    const parsed = JSON.parse(text);
    console.log('Parsed cached data:', {
      hasTweets: Array.isArray(parsed?.tweets),
      tweetCount: parsed?.tweets?.length ?? 0,
      timestamp: new Date(parsed?.timestamp).toISOString()
    });
    
    return parsed;
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
      timestamp: Date.now()
    };
    
    const filename = `${CACHE_KEY_PREFIX}-${Date.now()}.json`;
    console.log('Caching tweets to:', filename);
    
    await put(filename, JSON.stringify(cachedData), {
      contentType: 'application/json',
      access: 'public',
    });
    
    console.log('Successfully cached tweets:', {
      count: tweetsToCache.length,
      timestamp: new Date().toISOString()
    });
    
    // Check storage usage and cleanup if needed
    await cleanupOldCachedTweets();
  } catch (error) {
    console.error('Error caching tweets:', error);
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
      minutesAgo: Math.round((Date.now() - timestamp) / (60 * 1000))
    });
    
    return timestamp;
  } catch (error) {
    console.error('Error getting rate limit timestamp:', error);
    return null;
  }
}

export async function updateRateLimitTimestamp(): Promise<void> {
  try {
    const timestamp = Date.now();
    
    console.log('Updating rate limit timestamp:', {
      filename: RATE_LIMIT_FILE,
      timestamp,
      date: new Date(timestamp).toISOString()
    });
    
    await put(RATE_LIMIT_FILE, timestamp.toString(), {
      contentType: 'text/plain',
      access: 'public',
      addRandomSuffix: false
    });
    
    console.log('Successfully updated rate limit timestamp');
  } catch (error) {
    console.error('Error updating rate limit timestamp:', error);
  }
}

export function canMakeRequest(lastTimestamp: number | null): boolean {
  if (!lastTimestamp) return true;
  const timeSinceLastRequest = Date.now() - lastTimestamp;
  const canMake = timeSinceLastRequest >= FIFTEEN_MINUTES;
  console.log('Checking if can make request:', {
    lastTimestamp: new Date(lastTimestamp).toISOString(),
    timeSinceLastRequest: Math.round(timeSinceLastRequest / 1000) + 's',
    canMake
  });
  return canMake;
}

export async function getSelectedTweets(): Promise<SelectedTweets | null> {
  try {
    console.log('Getting selected tweets...');
    const { blobs } = await list({ prefix: SELECTED_TWEETS_FILE });
    
    if (blobs.length === 0) {
      console.log('No selected tweets found');
      return null;
    }
    
    const response = await fetch(blobs[0].url);
    if (!response.ok) {
      console.error('Failed to fetch selected tweets blob:', response.status);
      return null;
    }
    
    const data = await response.json();
    console.log('Retrieved selected tweets:', {
      count: data.tweets?.length ?? 0,
      timestamp: new Date(data.timestamp).toISOString()
    });
    
    return data;
  } catch (error) {
    console.error('Error getting selected tweets:', error);
    return null;
  }
}

export async function updateSelectedTweets(tweets: TweetV2[]): Promise<void> {
  try {
    console.log('Updating selected tweets...');
    const data: SelectedTweets = {
      tweets,
      timestamp: Date.now()
    };
    
    await put(SELECTED_TWEETS_FILE, JSON.stringify(data), {
      access: 'public',
      addRandomSuffix: false,
      contentType: 'application/json'
    });
    
    console.log('Selected tweets updated:', {
      count: tweets.length,
      timestamp: new Date(data.timestamp).toISOString(),
      filename: SELECTED_TWEETS_FILE
    });
  } catch (error) {
    console.error('Error updating selected tweets:', error);
    throw error;
  }
} 