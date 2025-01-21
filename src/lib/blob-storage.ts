import { list, put, del } from '@vercel/blob';
import { TweetV2 } from 'twitter-api-v2';

interface CachedTweets {
  tweets: TweetV2[];
  timestamp: number;
}

const CACHE_KEY = 'cached-tweets.json';
const RATE_LIMIT_KEY = 'rate-limit-timestamp.txt';
const FIFTEEN_MINUTES = 15 * 60 * 1000; // 15 minutes in milliseconds
const MAX_TWEETS = 100;

export async function getCachedTweets(): Promise<CachedTweets | null> {
  try {
    console.log('Listing blobs with prefix:', CACHE_KEY);
    const { blobs } = await list({ prefix: CACHE_KEY });
    console.log('Found blobs:', blobs.map(b => ({ url: b.url, pathname: b.pathname })));
    
    if (blobs.length === 0) {
      console.log('No blobs found with prefix:', CACHE_KEY);
      return null;
    }
    
    console.log('Fetching blob content from:', blobs[0].url);
    const response = await fetch(blobs[0].url);
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
    
    await put(CACHE_KEY, JSON.stringify(cachedData), {
      contentType: 'application/json',
      access: 'public',
    });
  } catch (error) {
    console.error('Error caching tweets:', error);
  }
}

export async function getRateLimitTimestamp(): Promise<number | null> {
  try {
    console.log('Listing blobs with prefix:', RATE_LIMIT_KEY);
    const { blobs } = await list({ prefix: RATE_LIMIT_KEY });
    console.log('Found rate limit blobs:', blobs.map(b => ({ url: b.url, pathname: b.pathname })));
    
    if (blobs.length === 0) {
      console.log('No rate limit timestamp found');
      return null;
    }
    
    console.log('Fetching rate limit timestamp from:', blobs[0].url);
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
      timestamp,
      date: new Date(timestamp).toISOString()
    });
    
    await put(RATE_LIMIT_KEY, timestamp.toString(), {
      contentType: 'text/plain',
      access: 'public',
    });
    
    console.log('Successfully updated rate limit timestamp');
  } catch (error) {
    console.error('Error updating rate limit timestamp:', error);
  }
}

export function canMakeRequest(lastTimestamp: number | null): boolean {
  if (!lastTimestamp) return true;
  return Date.now() - lastTimestamp >= FIFTEEN_MINUTES;
} 