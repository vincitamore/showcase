import { NextResponse } from 'next/server';
import { getReadOnlyClient } from '@/lib/x-api';
import { 
  cacheTweets,
  getRateLimitTimestamp,
  updateRateLimitTimestamp,
  getCachedTweets
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

// Vercel Cron Job - runs every 15 minutes
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes timeout

const FIFTEEN_MINUTES = 15 * 60 * 1000;

async function canMakeRequest() {
  try {
    const lastTimestamp = await getRateLimitTimestamp();
    if (!lastTimestamp) return true;
    
    const now = Date.now();
    const timeSinceLastRequest = now - lastTimestamp;
    console.log('Time since last request:', Math.round(timeSinceLastRequest / 1000), 'seconds');
    
    return timeSinceLastRequest >= FIFTEEN_MINUTES;
  } catch (error) {
    console.error('Error checking rate limit:', error);
    return false;
  }
}

async function searchNewBuildTweets(client: TwitterApi, cachedTweets: StoredTweet[]) {
  try {
    const searchResults = await client.v2.search('.build', {
      'tweet.fields': ['created_at', 'public_metrics'],
      max_results: 10,
    });

    if (!searchResults?.data) return null;

    const cachedIds = new Set(cachedTweets.map(tweet => tweet.id));
    // Handle the search results data
    const newTweets = (Array.isArray(searchResults.data) ? searchResults.data : [searchResults.data])
      .filter(tweet => !cachedIds.has(tweet.id))
      .map(convertToStoredTweet);
    
    return newTweets.length > 0 ? newTweets : null;
  } catch (error) {
    console.error('Error searching tweets:', error);
    return null;
  }
}

async function getRandomUserTweet(client: TwitterApi, username: string, cachedTweets: StoredTweet[]) {
  try {
    const user = await client.v2.userByUsername(username);
    if (!user?.data) throw new Error('User not found');

    const timeline = await client.v2.userTimeline(user.data.id, {
      exclude: ['replies', 'retweets'],
      'tweet.fields': ['created_at', 'public_metrics'],
      max_results: 10,
    });

    if (!timeline?.data?.data) return null;

    const cachedIds = new Set(cachedTweets.map(tweet => tweet.id));
    // Handle the timeline data
    const availableTweets = (Array.isArray(timeline.data.data) ? timeline.data.data : [timeline.data.data])
      .filter(tweet => !cachedIds.has(tweet.id))
      .map(convertToStoredTweet);
    
    if (availableTweets.length === 0) return null;
    
    const randomIndex = Math.floor(Math.random() * availableTweets.length);
    return [availableTweets[randomIndex]];
  } catch (error) {
    console.error('Error fetching random user tweet:', error);
    return null;
  }
}

export async function GET(request: Request) {
  try {
    // Verify the request is from Vercel Cron
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      console.error('Unauthorized cron request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if we can make a request
    const canRequest = await canMakeRequest();
    if (!canRequest) {
      const lastTimestamp = await getRateLimitTimestamp();
      const nextRequest = lastTimestamp ? lastTimestamp + FIFTEEN_MINUTES : Date.now() + FIFTEEN_MINUTES;
      
      console.log('Rate limit in effect, skipping fetch');
      return NextResponse.json({ 
        error: 'Rate limit in effect',
        nextRequest
      }, { status: 429 });
    }

    const client = await getReadOnlyClient();
    const username = process.env.NEXT_PUBLIC_TWITTER_USERNAME;
    if (!username) {
      throw new Error('Twitter username not configured');
    }

    // Get currently cached tweets
    const cachedData = await getCachedTweets();
    const currentTweets = (cachedData?.tweets || []) as StoredTweet[];

    // First try to find new tweets with ".build"
    const newBuildTweets = await searchNewBuildTweets(client, currentTweets);
    
    // If no new .build tweets, get a random user tweet
    const tweetsToCache = newBuildTweets || await getRandomUserTweet(client, username, currentTweets);

    if (!tweetsToCache) {
      console.log('No new tweets found to cache');
      return NextResponse.json({ 
        message: 'No new tweets to cache',
        currentCacheSize: currentTweets.length
      });
    }

    // Cache new tweets and update rate limit timestamp
    const updatedTweets = [...tweetsToCache, ...currentTweets].slice(0, 100);
    await cacheTweets(updatedTweets);
    await updateRateLimitTimestamp();

    return NextResponse.json({ 
      success: true, 
      newTweetsCount: tweetsToCache.length,
      totalTweetsCount: updatedTweets.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Cron job error:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch and cache tweets',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 

