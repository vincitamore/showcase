import { prisma } from '@/lib/prisma';

/**
 * Interface for detected tweet entity
 */
interface DetectedEntity {
  type: 'mention' | 'hashtag' | 'url';
  text: string; 
  indices: number[];
  expandedUrl?: string;
  displayUrl?: string;
  mediaKey?: string;
  metadata?: Record<string, any>;
}

/**
 * Detect @mentions in tweet text
 * @param text The tweet text to scan
 * @returns Array of detected mention entities
 */
export function detectMentions(text: string): DetectedEntity[] {
  if (!text) return [];
  
  // Regex for Twitter mentions - matches @username
  const mentionRegex = /@([a-zA-Z0-9_]+)/g;
  const mentions: DetectedEntity[] = [];
  let match;
  
  while ((match = mentionRegex.exec(text)) !== null) {
    mentions.push({
      type: 'mention',
      text: match[1] || '', // Ensure we have a string, even if capture group is undefined
      indices: [match.index, match.index + match[0].length],
      metadata: {
        indices: [match.index, match.index + match[0].length]
      }
    });
  }
  
  return mentions;
}

/**
 * Detect #hashtags in tweet text
 * @param text The tweet text to scan
 * @returns Array of detected hashtag entities
 */
export function detectHashtags(text: string): DetectedEntity[] {
  if (!text) return [];
  
  // Regex for Twitter hashtags - matches #hashtag
  const hashtagRegex = /#([a-zA-Z0-9_\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u00ff]+)/g;
  const hashtags: DetectedEntity[] = [];
  let match;
  
  while ((match = hashtagRegex.exec(text)) !== null) {
    hashtags.push({
      type: 'hashtag',
      text: match[1] || '', // Ensure we have a string, even if capture group is undefined
      indices: [match.index, match.index + match[0].length],
      metadata: {
        indices: [match.index, match.index + match[0].length]
      }
    });
  }
  
  return hashtags;
}

/**
 * Detect URLs in tweet text
 * @param text The tweet text to scan
 * @returns Array of detected URL entities
 */
export function detectUrls(text: string): DetectedEntity[] {
  if (!text) return [];
  
  // Regex for URLs - handles common URL patterns
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const urls: DetectedEntity[] = [];
  let match;
  
  while ((match = urlRegex.exec(text)) !== null) {
    const fullUrl = match[0];
    
    // Try to parse the URL to get hostname for display URL
    let displayUrl = fullUrl;
    try {
      const url = new URL(fullUrl);
      // Create a simplified display version (e.g., example.com/page)
      displayUrl = `${url.hostname}${url.pathname !== '/' ? url.pathname : ''}`;
      // Truncate if too long
      if (displayUrl.length > 30) {
        displayUrl = displayUrl.substring(0, 27) + '...';
      }
    } catch (error) {
      // If URL parsing fails, just use the matched text
      console.error('Error parsing URL:', error);
    }
    
    urls.push({
      type: 'url',
      text: fullUrl,
      expandedUrl: fullUrl,
      displayUrl,
      indices: [match.index, match.index + fullUrl.length],
      metadata: {
        indices: [match.index, match.index + fullUrl.length],
        expanded_url: fullUrl,
        display_url: displayUrl
      }
    });
  }
  
  return urls;
}

/**
 * Detect all supported entity types in a tweet
 * @param text The tweet text to analyze
 * @returns Combined array of all detected entities
 */
export function detectAllEntities(text: string): DetectedEntity[] {
  if (!text) return [];
  
  const mentions = detectMentions(text);
  const hashtags = detectHashtags(text);
  const urls = detectUrls(text);
  
  // Combine all detected entities and sort by position in text
  return [...mentions, ...hashtags, ...urls].sort((a, b) => {
    // Safely handle potentially undefined indices
    const aIndex = a.indices?.[0] ?? 0;
    const bIndex = b.indices?.[0] ?? 0;
    return aIndex - bIndex;
  });
}

/**
 * Check if a tweet already has proper entities for detected patterns
 * @param tweetId The tweet ID
 * @param tweetText The tweet text
 * @returns Object with missing entities and existing entities counts
 */
export async function findMissingEntities(tweetId: string, tweetText: string) {
  if (!tweetText) {
    return {
      missingEntities: [],
      existingCount: 0,
      detectedCount: 0,
      missingCount: 0
    };
  }
  
  // Get existing entities for the tweet
  const existingEntities = await prisma.tweetEntity.findMany({
    where: { tweetId }
  });
  
  // Detect all entities in the text
  const detectedEntities = detectAllEntities(tweetText);
  
  // Filter out entities that already exist
  // Consider an entity existing if there's a match of the same type at the same position
  const missingEntities = detectedEntities.filter(detected => {
    // For each detected entity, check if there's an existing one of the same type
    const exists = existingEntities.some(existing => 
      existing.type === detected.type &&
      existing.text === detected.text
    );
    
    return !exists;
  });
  
  return {
    missingEntities,
    existingCount: existingEntities.length,
    detectedCount: detectedEntities.length,
    missingCount: missingEntities.length
  };
}

/**
 * Create missing entities for a tweet in the database
 * @param tweetId The tweet ID to update
 * @param missingEntities Array of entities to create
 * @returns Object with creation results
 */
export async function createMissingEntities(tweetId: string, missingEntities: DetectedEntity[]) {
  if (!missingEntities.length) {
    return { created: 0, skipped: 0, entities: [] as any[] };
  }
  
  // Create entities in database
  const createdEntities = await Promise.all(
    missingEntities.map(async (entity) => {
      try {
        // Parse metadata safely to avoid undefined errors
        const metadata = entity.metadata || {};
        
        return await prisma.tweetEntity.create({
          data: {
            type: entity.type,
            text: entity.text,
            url: entity.type === 'url' ? entity.text : undefined,
            expandedUrl: entity.expandedUrl,
            // Only include displayUrl through metadata to avoid schema errors
            metadata: {
              ...metadata,
              display_url: entity.displayUrl
            },
            mediaKey: entity.mediaKey,
            tweetId
          }
        });
      } catch (error) {
        console.error(`Error creating entity for tweet ${tweetId}:`, error);
        return null;
      }
    })
  );
  
  const successfulCreations = createdEntities.filter(Boolean);
  
  return {
    created: successfulCreations.length,
    skipped: missingEntities.length - successfulCreations.length,
    entities: successfulCreations
  };
}

/**
 * Main function to recreate missing entities for tweets
 * @param tweetIds Optional array of specific tweet IDs to process (processes all if omitted)
 * @param options Optional configuration parameters
 * @returns Summary of entity recreation process
 */
export async function recreateMissingEntities(
  tweetIds?: string[], 
  options: { 
    dryRun?: boolean, 
    limit?: number,
    logLevel?: 'none' | 'summary' | 'verbose'
  } = {}
) {
  const { dryRun = false, limit = 100, logLevel = 'summary' } = options;
  
  // Get tweets to process
  const where = tweetIds?.length ? { id: { in: tweetIds } } : {};
  const tweets = await prisma.tweet.findMany({ 
    where,
    take: limit,
    orderBy: { createdAt: 'desc' }
  });
  
  if (logLevel !== 'none') {
    console.log(`Processing ${tweets.length} tweets${dryRun ? ' (DRY RUN)' : ''}`);
  }
  
  const results = {
    totalTweets: tweets.length,
    tweetsWithMissingEntities: 0,
    totalMissingEntities: 0,
    totalCreatedEntities: 0,
    totalSkippedEntities: 0,
    tweetsProcessed: [] as any[]
  };
  
  // Process each tweet
  for (const tweet of tweets) {
    const { missingEntities, existingCount, detectedCount, missingCount } = 
      await findMissingEntities(tweet.id, tweet.text);
    
    let creationResult = { created: 0, skipped: 0, entities: [] as any[] };
    
    if (missingEntities.length > 0) {
      results.tweetsWithMissingEntities++;
      results.totalMissingEntities += missingEntities.length;
      
      if (!dryRun) {
        creationResult = await createMissingEntities(tweet.id, missingEntities);
        results.totalCreatedEntities += creationResult.created;
        results.totalSkippedEntities += creationResult.skipped;
      }
      
      if (logLevel === 'verbose') {
        console.log(`Tweet ${tweet.id}:`);
        console.log(`  - Text: ${tweet.text.substring(0, 50)}${tweet.text.length > 50 ? '...' : ''}`);
        console.log(`  - Existing entities: ${existingCount}`);
        console.log(`  - Detected entities: ${detectedCount}`);
        console.log(`  - Missing entities: ${missingCount}`);
        console.log(`  - Created entities: ${dryRun ? '(skipped - dry run)' : creationResult.created}`);
        
        if (missingEntities.length > 0 && logLevel === 'verbose') {
          console.log('  - Missing entity details:');
          missingEntities.forEach(entity => {
            console.log(`    - Type: ${entity.type}, Text: ${entity.text}`);
          });
        }
      }
      
      results.tweetsProcessed.push({
        id: tweet.id,
        textPreview: tweet.text.substring(0, 50),
        existingEntities: existingCount,
        detectedEntities: detectedCount,
        missingEntities: missingCount,
        createdEntities: dryRun ? 0 : creationResult.created
      });
    }
  }
  
  if (logLevel !== 'none') {
    console.log('Entity recreation summary:');
    console.log(`- Total tweets processed: ${results.totalTweets}`);
    console.log(`- Tweets with missing entities: ${results.tweetsWithMissingEntities}`);
    console.log(`- Total missing entities detected: ${results.totalMissingEntities}`);
    if (!dryRun) {
      console.log(`- Total entities created: ${results.totalCreatedEntities}`);
      console.log(`- Total entities skipped due to errors: ${results.totalSkippedEntities}`);
    } else {
      console.log('- No entities created (dry run mode)');
    }
  }
  
  return results;
}

/**
 * Enhance tweet rendering with missing entity detection
 * This is a frontend utility that can be used to add entity processing
 * for tweets that are missing proper entity data
 * 
 * @param text Tweet text to process
 * @returns Detected entities that can be used for UI rendering
 */
export function enhanceTweetTextWithEntities(text: string) {
  if (!text) return { text, entities: [] };
  
  // Detect all entity types
  const detectedEntities = detectAllEntities(text);
  
  return {
    text,
    entities: detectedEntities
  };
}

/**
 * Expands a shortened URL to its full destination by following redirects
 * @param shortUrl The shortened URL to expand
 * @returns The expanded destination URL or the original if expansion fails
 */
async function expandUrl(shortUrl: string | null | undefined): Promise<string> {
  try {
    // Skip if not a URL or already expanded
    if (!shortUrl || !shortUrl.startsWith('http')) {
      return shortUrl || '';
    }
    
    // Skip expansion if it's not a shortened URL
    if (!isShortUrl(shortUrl)) {
      return shortUrl;
    }
    
    // Set a timeout since some redirects might hang
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000); // Extended timeout
    
    try {
      // Perform a HEAD request and follow redirects
      const response = await fetch(shortUrl, {
        method: 'HEAD',
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; TweetEntityResolver/1.0)'
        }
      });
      
      clearTimeout(timeoutId);
      
      // Get the final URL after all redirects
      let finalUrl = response.url;
      
      // Handle Twitter/X domain consistency
      // Replace twitter.com with x.com to ensure consistency with Twitter API responses
      // and for future-proofing as the platform has rebranded
      if (finalUrl.includes('twitter.com')) {
        finalUrl = finalUrl.replace('twitter.com', 'x.com');
      }
      
      // Clean up the URL by removing unnecessary query parameters
      try {
        const url = new URL(finalUrl);
        
        // Remove tracking parameters
        const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid'];
        trackingParams.forEach(param => {
          url.searchParams.delete(param);
        });
        
        // Rebuild the URL without tracking parameters
        finalUrl = url.toString();
      } catch (error) {
        // If URL parsing fails, keep the original expanded URL
        console.error(`Error cleaning URL ${finalUrl}:`, error);
      }
      
      return finalUrl;
    } catch (fetchError) {
      // If the HEAD request fails, try with a GET request as a fallback
      clearTimeout(timeoutId);
      
      console.warn(`HEAD request failed for ${shortUrl}, trying GET fallback:`, fetchError);
      
      const newController = new AbortController();
      const newTimeoutId = setTimeout(() => newController.abort(), 7000);
      
      try {
        const response = await fetch(shortUrl, {
          method: 'GET',
          redirect: 'follow',
          signal: newController.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; TweetEntityResolver/1.0)'
          }
        });
        
        clearTimeout(newTimeoutId);
        return response.url;
      } catch (getError) {
        clearTimeout(newTimeoutId);
        console.error(`Both HEAD and GET requests failed for ${shortUrl}:`, getError);
        return shortUrl;
      }
    }
  } catch (error) {
    console.error(`Error expanding URL ${shortUrl}:`, error);
    // Return original if expansion fails
    return shortUrl || '';
  }
}

/**
 * Finds and updates URL entities that have missing or incorrect expanded URLs
 * @param options Configuration options for the process
 * @returns Statistics about the process
 */
export async function expandShortUrls(options: {
  limit?: number;
  dryRun?: boolean;
  logLevel?: 'none' | 'summary' | 'verbose';
} = {}) {
  const { 
    limit = 100,
    dryRun = true,
    logLevel = 'summary' 
  } = options;
  
  const startTime = Date.now();
  const results = {
    totalUrlEntities: 0,
    urlsNeedingExpansion: 0,
    successfullyExpanded: 0,
    failedExpansions: 0,
    skippedExpansions: 0,
    processedEntities: [] as any[]
  };
  
  try {
    const { prisma } = await import('@/lib/db');
    
    // Find URL entities that need expansion:
    // 1. Where expandedUrl is null
    // 2. Where url is a known shortener domain and expandedUrl points to the same domain
    // 3. Where the url has patterns typical of short URLs
    const urlEntities = await prisma.tweetEntity.findMany({
      where: {
        type: 'url',
        OR: [
          { expandedUrl: null },
          // Known URL shorteners
          {
            url: { startsWith: 'https://t.co/' },
            expandedUrl: { startsWith: 'https://t.co/' }
          },
          {
            url: { startsWith: 'https://bit.ly/' },
            expandedUrl: { startsWith: 'https://bit.ly/' }
          },
          {
            url: { startsWith: 'https://buff.ly/' },
            expandedUrl: { startsWith: 'https://buff.ly/' }
          },
          {
            url: { startsWith: 'https://tinyurl.com/' },
            expandedUrl: { startsWith: 'https://tinyurl.com/' }
          },
          {
            url: { startsWith: 'https://ow.ly/' },
            expandedUrl: { startsWith: 'https://ow.ly/' }
          },
          {
            url: { startsWith: 'https://goo.gl/' },
            expandedUrl: { startsWith: 'https://goo.gl/' }
          }
          // Note: Removed the regex pattern match since Prisma doesn't support it directly
        ]
      },
      take: limit,
      orderBy: { id: 'asc' } // Ensure consistent ordering
    });
    
    results.totalUrlEntities = await prisma.tweetEntity.count({
      where: { type: 'url' }
    });
    
    results.urlsNeedingExpansion = urlEntities.length;
    
    if (logLevel !== 'none') {
      console.log(`Found ${urlEntities.length} URL entities that need expansion`);
    }
    
    // Process each URL entity
    for (const entity of urlEntities) {
      const originalUrl = entity.url || '';
      const entityInfo = {
        id: entity.id,
        url: originalUrl,
        originalExpandedUrl: entity.expandedUrl,
        tweetId: entity.tweetId
      };
      
      try {
        // Skip if we're in dry run mode
        if (dryRun) {
          if (logLevel === 'verbose') {
            console.log(`[DRY RUN] Would expand URL: ${originalUrl}`);
          }
          results.skippedExpansions++;
          results.processedEntities.push({
            ...entityInfo,
            expandedUrl: null,
            status: 'skipped',
            reason: 'dry_run'
          });
          continue;
        }
        
        // Skip if no URL
        if (!originalUrl) {
          results.skippedExpansions++;
          results.processedEntities.push({
            ...entityInfo,
            expandedUrl: null,
            status: 'skipped',
            reason: 'no_url'
          });
          continue;
        }
        
        // Expand the URL
        const expandedUrl = await expandUrl(originalUrl);
        
        // Skip if expansion didn't change anything
        if (expandedUrl === originalUrl || expandedUrl === entity.expandedUrl) {
          if (logLevel === 'verbose') {
            console.log(`Skipping URL that didn't change: ${originalUrl}`);
          }
          results.skippedExpansions++;
          results.processedEntities.push({
            ...entityInfo,
            expandedUrl,
            status: 'skipped',
            reason: 'no_change'
          });
          continue;
        }
        
        // Update the entity in the database
        await prisma.tweetEntity.update({
          where: { id: entity.id },
          data: { expandedUrl }
        });
        
        results.successfullyExpanded++;
        results.processedEntities.push({
          ...entityInfo,
          expandedUrl,
          status: 'success'
        });
        
        if (logLevel === 'verbose') {
          console.log(`Expanded URL: ${originalUrl} → ${expandedUrl}`);
        }
      } catch (error) {
        results.failedExpansions++;
        results.processedEntities.push({
          ...entityInfo,
          status: 'error',
          reason: error instanceof Error ? error.message : 'Unknown error'
        });
        
        if (logLevel !== 'none') {
          console.error(`Error processing URL entity ${entity.id}:`, error);
        }
      }
    }
    
    const processingTime = Date.now() - startTime;
    
    if (logLevel !== 'none') {
      console.log(`URL expansion processing completed in ${processingTime}ms`);
      console.log(`- Successfully expanded: ${results.successfullyExpanded}`);
      console.log(`- Failed expansions: ${results.failedExpansions}`);
      console.log(`- Skipped expansions: ${results.skippedExpansions}`);
    }
    
    return {
      ...results,
      processingTime: `${processingTime}ms`
    };
  } catch (error) {
    console.error('Error in expandShortUrls:', error);
    throw error;
  }
}

/**
 * Determines if a URL is a shortened URL (t.co, bit.ly, etc.)
 * @param url The URL to check
 * @returns True if the URL is a shortened URL
 */
function isShortUrl(url: string): boolean {
  if (!url) return false;
  
  return url.includes('t.co/') || 
         url.includes('bit.ly/') || 
         url.includes('buff.ly/') ||
         url.includes('tinyurl.com/') ||
         url.includes('ow.ly/') ||
         url.includes('goo.gl/') ||
         url.match(/https?:\/\/\w+\.\w+\/\w{5,10}$/i) !== null;
} 