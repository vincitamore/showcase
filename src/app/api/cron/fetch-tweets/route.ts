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
import { TwitterApiv2, TweetV2, TweetPublicMetricsV2, TweetEntitiesV2 } from 'twitter-api-v2';

// Helper function to check if a tweet has entities with URLs
function hasTweetEntities(tweet: TweetV2): boolean {
  return !!tweet.entities?.urls && tweet.entities.urls.length > 0;
}

// Helper function to get random items from array with priority for tweets with entities
function getRandomItems(array: TweetV2[], count: number): TweetV2[] {
  // Separate tweets with and without entities
  const tweetsWithEntities = array.filter(hasTweetEntities);
  const tweetsWithoutEntities = array.filter(tweet => !hasTweetEntities(tweet));
  
  logStatus('Tweet selection stats', {
    totalTweets: array.length,
    withEntities: tweetsWithEntities.length,
    withoutEntities: tweetsWithoutEntities.length
  });
  
  // If we have enough tweets with entities, use those first
  if (tweetsWithEntities.length >= count) {
    const shuffled = [...tweetsWithEntities].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  }
  
  // Otherwise, fill remaining slots with tweets without entities
  const shuffledWithEntities = [...tweetsWithEntities].sort(() => 0.5 - Math.random());
  const shuffledWithoutEntities = [...tweetsWithoutEntities].sort(() => 0.5 - Math.random());
  const remaining = count - shuffledWithEntities.length;
  
  return [
    ...shuffledWithEntities,
    ...shuffledWithoutEntities.slice(0, remaining)
  ];
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

async function searchNewBuildTweets(client: TwitterApiv2, cachedTweets: TweetV2[]) {
  try {
    logStatus('Searching for .build tweets');
    const searchResults = await client.search('.build', {
      'tweet.fields': ['created_at', 'public_metrics', 'entities'],
      max_results: 10,
    });

    if (!searchResults?.data) {
      logStatus('No .build tweets found');
      return null;
    }

    const cachedIds = new Set(cachedTweets.map(tweet => tweet.id));
    const newTweets = (Array.isArray(searchResults.data) ? searchResults.data : [searchResults.data])
      .filter(tweet => !cachedIds.has(tweet.id));
    
    logStatus('Search results', {
      totalFound: Array.isArray(searchResults.data) ? searchResults.data.length : 1,
      newTweetsFound: newTweets.length,
      withEntities: newTweets.filter(hasTweetEntities).length
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

async function getRandomUserTweet(client: TwitterApiv2, username: string, cachedTweets: TweetV2[]) {
  try {
    logStatus('Fetching user tweets', { username });
    const user = await client.userByUsername(username);
    if (!user?.data) {
      logStatus('User not found', { username });
      throw new Error('User not found');
    }

    const timeline = await client.userTimeline(user.data.id, {
      exclude: ['replies', 'retweets'],
      'tweet.fields': ['created_at', 'public_metrics', 'entities'],
      max_results: 10,
    });

    if (!timeline?.data?.data) {
      logStatus('No timeline tweets found');
      return null;
    }

    const cachedIds = new Set(cachedTweets.map(tweet => tweet.id));
    const availableTweets = (Array.isArray(timeline.data.data) ? timeline.data.data : [timeline.data.data])
      .filter(tweet => !cachedIds.has(tweet.id));
    
    logStatus('Timeline results', {
      totalFound: Array.isArray(timeline.data.data) ? timeline.data.data.length : 1,
      newTweetsAvailable: availableTweets.length,
      withEntities: availableTweets.filter(hasTweetEntities).length
    });
    
    if (availableTweets.length === 0) return null;
    
    // Prioritize tweets with entities
    const tweetsWithEntities = availableTweets.filter(hasTweetEntities);
    if (tweetsWithEntities.length > 0) {
      const randomIndex = Math.floor(Math.random() * tweetsWithEntities.length);
      return [tweetsWithEntities[randomIndex]];
    }
    
    // Fallback to any tweet if none have entities
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
    const currentTweets = (cachedData?.tweets || []) as TweetV2[];
    logStatus('Current cache status', { 
      cachedTweetCount: currentTweets.length,
      withEntities: currentTweets.filter(hasTweetEntities).length
    });

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
          selected: selectedTweets.length,
          withEntities: selectedTweets.filter(hasTweetEntities).length
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
        totalTweets: updatedTweets.length,
        withEntities: updatedTweets.filter(hasTweetEntities).length
      });
    }

    // Always select and update random tweets for display, whether we got new ones or not
    const selectedTweets = getRandomItems(updatedTweets, 4);
    await updateSelectedTweets(selectedTweets);
    logStatus('Updated selected tweets', {
      available: updatedTweets.length,
      selected: selectedTweets.length,
      withEntities: selectedTweets.filter(hasTweetEntities).length
    });

    const duration = Date.now() - startTime;
    logStatus('Cron job completed successfully', {
      newTweetsAdded: tweetsToCache?.length ?? 0,
      totalTweetsInCache: updatedTweets.length,
      selectedTweetsCount: selectedTweets.length,
      withEntities: selectedTweets.filter(hasTweetEntities).length,
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

