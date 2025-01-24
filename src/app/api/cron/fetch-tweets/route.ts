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
import { TwitterApiv2, TweetV2, TweetPublicMetricsV2, TweetEntitiesV2, UserV2, MediaObjectV2 } from 'twitter-api-v2';

interface TweetWithAuthor extends TweetV2 {
  author?: {
    id: string;
    name: string;
    username: string;
    profile_image_url?: string;
  };
  media?: MediaObjectV2[];
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

    // Create a clean copy of the tweet with empty entities
    const cleanTweet: TweetWithAuthor = {
      id: tweet.id,
      text: tweet.text,
      edit_history_tweet_ids: tweet.edit_history_tweet_ids,
      public_metrics: tweet.public_metrics,
      created_at: '', // Initialize created_at
      author_id: tweet.author_id,
      entities: {
        urls: [],
        mentions: [],
        hashtags: [],
        cashtags: [],
        annotations: []
      } as TweetEntitiesV2
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

    // Log the full tweet structure for debugging
    logStatus('Validating tweet', {
      id: tweet.id,
      hasEntities: !!tweet.entities,
      entityTypes: tweet.entities ? Object.keys(tweet.entities) : [],
      hasCreatedAt: !!tweet.created_at,
      hasAuthorId: !!tweet.author_id,
      hasAuthorData: !!cleanTweet.author,
      hasMediaKeys: !!tweet.attachments?.media_keys,
      mediaCount: cleanTweet.media?.length || 0,
      fullTweet: tweet
    });

    // Ensure required fields exist
    if (!cleanTweet.id || !cleanTweet.text || !Array.isArray(cleanTweet.edit_history_tweet_ids)) {
      logStatus('Invalid tweet structure', {
        id: tweet.id,
        hasText: !!tweet.text,
        hasEditHistory: Array.isArray(tweet.edit_history_tweet_ids),
        hasAuthorId: !!tweet.author_id
      });
      return null;
    }

    // Handle created_at - try multiple formats
    if (tweet.created_at) {
      try {
        // First try parsing as ISO string
        const date = new Date(tweet.created_at);
        if (!isNaN(date.getTime())) {
          cleanTweet.created_at = date.toISOString();
        } else {
          // Try parsing as a timestamp
          const timestamp = parseInt(tweet.created_at);
          if (!isNaN(timestamp)) {
            const timestampDate = new Date(timestamp);
            if (!isNaN(timestampDate.getTime())) {
              cleanTweet.created_at = timestampDate.toISOString();
            } else {
              logStatus('Invalid timestamp in tweet', {
                id: tweet.id,
                date: tweet.created_at,
                timestamp
              });
              // Set to current time as fallback
              cleanTweet.created_at = new Date().toISOString();
            }
          } else {
            logStatus('Invalid date format in tweet', {
              id: tweet.id,
              date: tweet.created_at
            });
            // Set to current time as fallback
            cleanTweet.created_at = new Date().toISOString();
          }
        }
      } catch (error) {
        logStatus('Error parsing date for tweet', {
          id: tweet.id,
          date: tweet.created_at,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        // Set to current time as fallback
        cleanTweet.created_at = new Date().toISOString();
      }
    } else {
      // If no created_at provided, use current time
      cleanTweet.created_at = new Date().toISOString();
      logStatus('No created_at found, using current time', {
        id: tweet.id,
        created_at: cleanTweet.created_at
      });
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

  // Separate tweets with and without entities
  const tweetsWithEntities = validTweets.filter(t => hasTweetEntities(t));
  const tweetsWithoutEntities = validTweets.filter(t => !hasTweetEntities(t));
  
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
      console.log('[CRON] Rate limited, using cached tweets');
      return new Response('Rate limited, using cached tweets', { status: 429 });
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
      throw new Error('No new tweets fetched');
    }

    // Validate and update cache
    const validNewTweets = newTweets
      .map(tweet => validateTweet(tweet))
      .filter((tweet): tweet is TweetWithAuthor => tweet !== null);

    if (validNewTweets.length === 0) {
      throw new Error('No valid tweets after validation');
    }

    // Update cache with new tweets
    const tweetMap = new Map<string, TweetWithAuthor>();
    validNewTweets.forEach(tweet => tweetMap.set(tweet.id, tweet));
    currentTweets.forEach(tweet => {
      if (!tweetMap.has(tweet.id)) {
        const validTweet = validateTweet(tweet);
        if (validTweet) {
          tweetMap.set(tweet.id, validTweet);
        }
      }
    });

    const updatedTweets = Array.from(tweetMap.values()).slice(0, 100);
    await cacheTweets(updatedTweets);
    
    logStatus('Cache updated', {
      new: validNewTweets.length,
      total: updatedTweets.length,
      withEntities: updatedTweets.filter(hasTweetEntities).length
    });

    // Select new display tweets
    const selectedTweets = getRandomItems(updatedTweets, 4);
    await updateSelectedTweets(selectedTweets);
    
    logStatus('Display tweets updated', {
      selected: selectedTweets.length,
      withEntities: selectedTweets.filter(hasTweetEntities).length
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

