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

// Helper function to check if a tweet has any type of entity
function hasTweetEntities(tweet: TweetV2): boolean {
  // Log the full entities structure for debugging
  logStatus('Checking entities for tweet', {
    id: tweet.id,
    hasEntities: !!tweet.entities,
    entityTypes: tweet.entities ? Object.keys(tweet.entities) : [],
    urlCount: tweet.entities?.urls?.length || 0,
    fullEntities: tweet.entities
  });

  // Check for any type of entity, not just URLs
  if (!tweet.entities) return false;

  // Check for various entity types
  const hasUrls = !!tweet.entities.urls?.length;
  const hasMentions = !!tweet.entities.mentions?.length;
  const hasHashtags = !!tweet.entities.hashtags?.length;
  const hasAnnotations = !!tweet.entities.annotations?.length;
  const hasCashtags = !!tweet.entities.cashtags?.length;

  const hasAnyEntity = hasUrls || hasMentions || hasHashtags || hasAnnotations || hasCashtags;

  // Log detailed entity presence
  logStatus('Entity detection result', {
    id: tweet.id,
    hasUrls,
    hasMentions,
    hasHashtags,
    hasAnnotations,
    hasCashtags,
    hasAnyEntity
  });

  return hasAnyEntity;
}

// Helper function to validate and clean tweet data
function validateTweet(tweet: TweetV2): TweetV2 | null {
  try {
    // Handle null/undefined
    if (!tweet) {
      logStatus('Null or undefined tweet');
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

    // Log the full tweet structure for debugging
    logStatus('Validating tweet', {
      id: tweet.id,
      hasEntities: !!tweet.entities,
      entityTypes: tweet.entities ? Object.keys(tweet.entities) : [],
      fullTweet: tweet
    });

    // Ensure required fields exist
    if (!cleanTweet.id || !cleanTweet.text || !Array.isArray(cleanTweet.edit_history_tweet_ids)) {
      logStatus('Invalid tweet structure', {
        id: tweet.id,
        hasText: !!tweet.text,
        hasEditHistory: Array.isArray(tweet.edit_history_tweet_ids)
      });
      return null;
    }

    // Handle created_at separately
    if (tweet.created_at) {
      try {
        const date = new Date(tweet.created_at);
        if (!isNaN(date.getTime())) {
          cleanTweet.created_at = date.toISOString();
        } else {
          logStatus('Invalid date found in tweet', {
            id: tweet.id,
            date: tweet.created_at
          });
        }
      } catch (error) {
        logStatus('Error parsing date for tweet', {
          id: tweet.id,
          date: tweet.created_at,
          error: error instanceof Error ? error.message : 'Unknown error'
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
        logStatus('Processed entities', {
          id: tweet.id,
          entityTypes: Object.keys(entities),
          urlCount: entities.urls.length,
          mentionCount: entities.mentions.length,
          hashtagCount: entities.hashtags.length,
          annotationCount: entities.annotations.length,
          cashtagCount: entities.cashtags.length
        });
      } catch (error) {
        logStatus('Error processing entities', {
          id: tweet.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

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
function getRandomItems(array: TweetV2[], count: number): TweetV2[] {
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
    .filter((tweet): tweet is TweetV2 => tweet !== null);

  if (validTweets.length === 0) {
    logStatus('No valid tweets found');
    return [];
  }

  // Separate tweets with and without entities
  const tweetsWithEntities = validTweets.filter(hasTweetEntities);
  const tweetsWithoutEntities = validTweets.filter(tweet => !hasTweetEntities(tweet));
  
  logStatus('Tweet selection stats', {
    totalTweets: validTweets.length,
    withEntities: tweetsWithEntities.length,
    withoutEntities: tweetsWithoutEntities.length,
    validDates: validTweets.filter(t => !!t.created_at).length
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
      'user.fields': ['profile_image_url', 'username', 'name'],
      'media.fields': ['url', 'preview_image_url'],
      expansions: ['author_id', 'attachments.media_keys'],
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
      'user.fields': ['profile_image_url', 'username', 'name'],
      'media.fields': ['url', 'preview_image_url'],
      expansions: ['author_id', 'attachments.media_keys'],
      max_results: 20, // Increased to get more candidates
    });

    if (!timeline?.data?.data) {
      logStatus('No timeline tweets found');
      return null;
    }

    const tweets = Array.isArray(timeline.data.data) ? timeline.data.data : [timeline.data.data];
    
    // Validate tweets before selection
    const validTweets = tweets
      .map(tweet => validateTweet(tweet))
      .filter((tweet): tweet is TweetV2 => tweet !== null);
    
    // Separate tweets with and without entities
    const tweetsWithEntities = validTweets.filter(hasTweetEntities);
    const tweetsWithoutEntities = validTweets.filter(tweet => !hasTweetEntities(tweet));
    
    logStatus('Timeline results', {
      totalFound: tweets.length,
      validTweets: validTweets.length,
      withEntities: tweetsWithEntities.length,
      withoutEntities: tweetsWithoutEntities.length
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

    // Validate all tweets before caching
    const validNewTweets = newTweets
      .map(tweet => validateTweet(tweet))
      .filter((tweet): tweet is TweetV2 => tweet !== null);

    if (validNewTweets.length === 0) {
      throw new Error('No valid tweets found after validation');
    }

    // Update cache with new tweets, replacing any duplicates
    const tweetMap = new Map<string, TweetV2>();
    
    // Add new tweets first (so they take precedence over old ones)
    validNewTweets.forEach(tweet => tweetMap.set(tweet.id, tweet));
    
    // Add existing tweets that aren't being replaced
    currentTweets.forEach(tweet => {
      if (!tweetMap.has(tweet.id)) {
        const validTweet = validateTweet(tweet);
        if (validTweet) {
          tweetMap.set(tweet.id, validTweet);
        }
      }
    });

    // Convert back to array, limiting to 100 most recent
    const updatedTweets = Array.from(tweetMap.values()).slice(0, 100);
    
    // Update cache and rate limit timestamp
    await cacheTweets(updatedTweets);
    await updateRateLimitTimestamp();
    
    logStatus('Cache updated', {
      newTweetsAdded: validNewTweets.length,
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
      newTweetsAdded: validNewTweets.length,
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

