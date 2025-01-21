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
import { TwitterApi, TweetV2, TweetPublicMetricsV2 } from 'twitter-api-v2';

// Update interface to match TweetV2 structure but only include what we need
interface StoredTweet {
  id: string;
  text: string;
  edit_history_tweet_ids: string[];
  created_at?: string;
  public_metrics?: TweetPublicMetricsV2;
}

function convertToStoredTweet(tweet: TweetV2): StoredTweet {
  return {
    id: tweet.id,
    text: tweet.text,
    edit_history_tweet_ids: tweet.edit_history_tweet_ids,
    created_at: tweet.created_at,
    public_metrics: tweet.public_metrics
  };
}

// Vercel Cron Job - runs every 5 minutes but respects 15-minute rate limit
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes timeout

const FIFTEEN_MINUTES = 15 * 60 * 1000;

function logStatus(message: string, data?: any) {
  const timestamp = new Date().toISOString();
  console.log(`[CRON ${timestamp}] ${message}`, data ? JSON.stringify(data, null, 2) : '');
}

async function checkRateLimit() {
  try {
    const lastTimestamp = await getRateLimitTimestamp();
    if (!lastTimestamp) {
      logStatus('No previous request timestamp found, allowing request');
      return true;
    }
    
    const now = Date.now();
    const timeSinceLastRequest = now - lastTimestamp;
    const minutesSince = Math.round(timeSinceLastRequest / (60 * 1000));
    const minutesUntilNext = Math.max(0, 15 - minutesSince);
    
    logStatus('Rate limit status', {
      lastRequestAt: new Date(lastTimestamp).toISOString(),
      minutesSinceLastRequest: minutesSince,
      minutesUntilNextAllowed: minutesUntilNext,
      canRequest: timeSinceLastRequest >= FIFTEEN_MINUTES
    });
    
    return timeSinceLastRequest >= FIFTEEN_MINUTES;
  } catch (error) {
    logStatus('Error checking rate limit', { error: error instanceof Error ? error.message : 'Unknown error' });
    return false;
  }
}

async function searchNewBuildTweets(client: TwitterApi, cachedTweets: StoredTweet[]) {
  try {
    logStatus('Searching for .build tweets');
    const searchResults = await client.v2.search('.build', {
      'tweet.fields': ['created_at', 'public_metrics'],
      max_results: 10,
    });

    if (!searchResults?.data) {
      logStatus('No .build tweets found');
      return null;
    }

    const cachedIds = new Set(cachedTweets.map(tweet => tweet.id));
    const newTweets = (Array.isArray(searchResults.data) ? searchResults.data : [searchResults.data])
      .filter(tweet => !cachedIds.has(tweet.id))
      .map(convertToStoredTweet);
    
    logStatus('Search results', {
      totalFound: Array.isArray(searchResults.data) ? searchResults.data.length : 1,
      newTweetsFound: newTweets.length
    });
    
    return newTweets.length > 0 ? newTweets : null;
  } catch (error) {
    // If rate limited, log and return null
    if (error instanceof Error && error.message.includes('Rate limit exceeded for search')) {
      logStatus('Search rate limit exceeded, skipping search');
      return null;
    }
    logStatus('Error searching tweets', { error: error instanceof Error ? error.message : 'Unknown error' });
    return null;
  }
}

async function getRandomUserTweet(client: TwitterApi, username: string, cachedTweets: StoredTweet[]) {
  try {
    logStatus('Fetching user tweets', { username });
    const user = await client.v2.userByUsername(username);
    if (!user?.data) {
      logStatus('User not found', { username });
      throw new Error('User not found');
    }

    const timeline = await client.v2.userTimeline(user.data.id, {
      exclude: ['replies', 'retweets'],
      'tweet.fields': ['created_at', 'public_metrics'],
      max_results: 10,
    });

    if (!timeline?.data?.data) {
      logStatus('No timeline tweets found');
      return null;
    }

    const cachedIds = new Set(cachedTweets.map(tweet => tweet.id));
    const availableTweets = (Array.isArray(timeline.data.data) ? timeline.data.data : [timeline.data.data])
      .filter(tweet => !cachedIds.has(tweet.id))
      .map(convertToStoredTweet);
    
    logStatus('Timeline results', {
      totalFound: Array.isArray(timeline.data.data) ? timeline.data.data.length : 1,
      newTweetsAvailable: availableTweets.length
    });
    
    if (availableTweets.length === 0) return null;
    
    const randomIndex = Math.floor(Math.random() * availableTweets.length);
    return [availableTweets[randomIndex]];
  } catch (error) {
    // If rate limited, log and return null
    if (error instanceof Error && error.message.includes('Rate limit exceeded for timeline')) {
      logStatus('Timeline rate limit exceeded, skipping user tweets');
      return null;
    }
    logStatus('Error fetching random user tweet', { error: error instanceof Error ? error.message : 'Unknown error' });
    return null;
  }
}

// Helper function to get random items from an array
function getRandomItems<T>(array: T[], count: number): T[] {
  const shuffled = [...array].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

export async function GET(request: Request) {
  const startTime = Date.now();
  logStatus('Cron job started');
  
  try {
    // Verify the request is from Vercel Cron
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      logStatus('Unauthorized cron request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get currently cached tweets first
    const cachedData = await getCachedTweets();
    const currentTweets = (cachedData?.tweets || []) as StoredTweet[];
    logStatus('Current cache status', { cachedTweetCount: currentTweets.length });

    // Check if we can make a request
    const canRequest = await checkRateLimit();
    if (!canRequest) {
      logStatus('Rate limit in effect, using cached tweets');
      
      // Even when rate limited, we should still update selected tweets from cache
      if (currentTweets.length > 0) {
        const selectedTweets = getRandomItems(currentTweets, 4);
        await updateSelectedTweets(selectedTweets);
        logStatus('Updated selected tweets from cache', {
          available: currentTweets.length,
          selected: selectedTweets.length
        });
        
        return NextResponse.json({ 
          message: 'Rate limited but updated selected tweets from cache',
          selectedCount: selectedTweets.length,
          nextRequest: await getRateLimitTimestamp()
        });
      }
      
      return NextResponse.json({ 
        error: 'Rate limit in effect and no cached tweets available',
        nextRequest: await getRateLimitTimestamp()
      }, { status: 429 });
    }

    // Initialize Twitter client
    logStatus('Initializing Twitter client');
    const client = await getReadOnlyClient();
    const username = process.env.NEXT_PUBLIC_TWITTER_USERNAME;
    if (!username) {
      throw new Error('Twitter username not configured');
    }

    // Try to fetch new tweets
    const newBuildTweets = await searchNewBuildTweets(client, currentTweets);
    const tweetsToCache = newBuildTweets || await getRandomUserTweet(client, username, currentTweets);

    // Update cache if we got new tweets
    let updatedTweets = currentTweets;
    if (tweetsToCache) {
      updatedTweets = [...tweetsToCache, ...currentTweets].slice(0, 100);
      await cacheTweets(updatedTweets);
      await updateRateLimitTimestamp();
      logStatus('Cache updated with new tweets', {
        newTweetsAdded: tweetsToCache.length,
        totalTweets: updatedTweets.length
      });
    }

    // Always select and update random tweets for display, whether we got new ones or not
    const selectedTweets = getRandomItems(updatedTweets, 4);
    await updateSelectedTweets(selectedTweets);
    logStatus('Updated selected tweets', {
      available: updatedTweets.length,
      selected: selectedTweets.length
    });

    const duration = Date.now() - startTime;
    logStatus('Cron job completed successfully', {
      newTweetsAdded: tweetsToCache?.length ?? 0,
      totalTweetsInCache: updatedTweets.length,
      selectedTweetsCount: selectedTweets.length,
      executionTimeMs: duration
    });

    return NextResponse.json({ 
      success: true, 
      newTweetsCount: tweetsToCache?.length ?? 0,
      totalTweetsCount: updatedTweets.length,
      selectedTweetsCount: selectedTweets.length,
      executionTimeMs: duration,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logStatus('Cron job failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      executionTimeMs: duration
    });
    
    return NextResponse.json({ 
      error: 'Failed to fetch and cache tweets',
      details: error instanceof Error ? error.message : 'Unknown error',
      executionTimeMs: duration
    }, { status: 500 });
  }
} 

