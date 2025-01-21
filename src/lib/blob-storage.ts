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
    const { blobs } = await list({ prefix: CACHE_KEY });
    if (blobs.length === 0) return null;
    
    const response = await fetch(blobs[0].url);
    if (!response.ok) return null;
    
    const text = await response.text();
    return JSON.parse(text);
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
    const { blobs } = await list({ prefix: RATE_LIMIT_KEY });
    if (blobs.length === 0) return null;
    
    const response = await fetch(blobs[0].url);
    if (!response.ok) return null;
    
    const text = await response.text();
    return parseInt(text);
  } catch (error) {
    console.error('Error getting rate limit timestamp:', error);
    return null;
  }
}

export async function updateRateLimitTimestamp(): Promise<void> {
  try {
    await put(RATE_LIMIT_KEY, Date.now().toString(), {
      contentType: 'text/plain',
      access: 'public',
    });
  } catch (error) {
    console.error('Error updating rate limit timestamp:', error);
  }
}

export function canMakeRequest(lastTimestamp: number | null): boolean {
  if (!lastTimestamp) return true;
  return Date.now() - lastTimestamp >= FIFTEEN_MINUTES;
} 