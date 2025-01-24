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
    const query = '(.build) lang:en -is:retweet -is:reply';
    logStatus('Using search query:', query);
    
    const searchResults = await client.search(query, {
      'tweet.fields': ['created_at', 'public_metrics', 'entities'],
      max_results: 10,
    });

    if (!searchResults?.data) {
      logStatus('No .build tweets found');
      return null;
    }

    // Always return the tweets, even if they're already cached
    const tweets = Array.isArray(searchResults.data) ? searchResults.data : [searchResults.data];
    
    logStatus('Search results', {
      totalFound: tweets.length,
      withEntities: tweets.filter(hasTweetEntities).length
    });
    
    return tweets;
  } catch (error) {
    logStatus('Error searching tweets', { error: error instanceof Error ? error.message : 'Unknown error' });
    return null;
  }
}

async function getRandomUserTweet(client: TwitterApiv2, username: string) {
  try {
    logStatus('Fetching user tweets', { username });
    const user = await client.userByUsername(username);
    if (!user?.data) {
      logStatus('User not found', { username });
      throw new Error('User not found');
    }

    const timeline = await client.userTimeline(user.data.id, {
      exclude: ['retweets'],  // Allow replies to increase chances of finding tweets
      'tweet.fields': ['created_at', 'public_metrics', 'entities'],
      max_results: 20, // Increased to get more candidates
    });

    if (!timeline?.data?.data) {
      logStatus('No timeline tweets found');
      return null;
    }

    const tweets = Array.isArray(timeline.data.data) ? timeline.data.data : [timeline.data.data];
    
    // Separate tweets with and without entities
    const tweetsWithEntities = tweets.filter(hasTweetEntities);
    const tweetsWithoutEntities = tweets.filter(tweet => !hasTweetEntities(tweet));
    
    logStatus('Timeline results', {
      totalFound: tweets.length,
      withEntities: tweetsWithEntities.length,
      withoutEntities: tweetsWithoutEntities.length
    });
    
    // Prefer tweets with entities if available
    if (tweetsWithEntities.length > 0) {
      const randomIndex = Math.floor(Math.random() * tweetsWithEntities.length);
      return [tweetsWithEntities[randomIndex]];
    }
    
    // Fallback to tweets without entities
    const randomIndex = Math.floor(Math.random() * tweets.length);
    return [tweets[randomIndex]];
  } catch (error) {
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

    // Always try both search and user tweets
    const newBuildTweets = await searchNewBuildTweets(client, currentTweets);
    const userTweets = await getRandomUserTweet(client, username);

    // Combine new tweets, ensuring we have at least one
    const newTweets = [
      ...(newBuildTweets || []),
      ...(userTweets || [])
    ];

    if (newTweets.length === 0) {
      throw new Error('Failed to fetch any new tweets');
    }

    // Update cache with new tweets, replacing any duplicates
    const tweetMap = new Map<string, TweetV2>();
    
    // Add new tweets first (so they take precedence over old ones)
    newTweets.forEach(tweet => tweetMap.set(tweet.id, tweet));
    
    // Add existing tweets that aren't being replaced
    currentTweets.forEach(tweet => {
      if (!tweetMap.has(tweet.id)) {
        tweetMap.set(tweet.id, tweet);
      }
    });

    // Convert back to array, limiting to 100 most recent
    const updatedTweets = Array.from(tweetMap.values()).slice(0, 100);
    
    // Update cache and rate limit timestamp
    await cacheTweets(updatedTweets);
    await updateRateLimitTimestamp();
    
    logStatus('Cache updated', {
      newTweetsAdded: newTweets.length,
      totalTweets: updatedTweets.length,
      withEntities: updatedTweets.filter(hasTweetEntities).length
    });

    // Select and update random tweets for display
    const selectedTweets = getRandomItems(updatedTweets, 4);
    await updateSelectedTweets(selectedTweets);
    
    logStatus('Updated selected tweets', {
      available: updatedTweets.length,
      selected: selectedTweets.length,
      withEntities: selectedTweets.filter(hasTweetEntities).length
    });

    const executionTime = Date.now() - startTime;
    return NextResponse.json({
      message: 'Successfully updated tweets',
      newTweetsAdded: newTweets.length,
      totalTweets: updatedTweets.length,
      selectedTweets: selectedTweets.length,
      executionTimeMs: executionTime
    });
  } catch (error) {
    const executionTime = Date.now() - startTime;
    logStatus('Cron job failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      executionTimeMs: executionTime
    });
    
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      executionTimeMs: executionTime
    }, { status: 500 });
  }
} 

