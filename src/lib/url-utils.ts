/**
 * Client-safe utility functions for URL handling
 * This file is separated from tweet-utils.ts to avoid importing Prisma in client components
 */

/**
 * Interface for detected tweet entity
 */
export interface DetectedEntity {
  type: 'mention' | 'hashtag' | 'url';
  text: string; 
  indices: number[];
  expandedUrl?: string;
  displayUrl?: string;
  mediaKey?: string;
  metadata?: Record<string, any>;
}

/**
 * Determines if a URL is a shortened URL (t.co, bit.ly, etc.)
 * @param url The URL to check
 * @returns True if the URL is a shortened URL
 */
export function isShortUrl(url: string): boolean {
  if (!url) return false;
  
  return url.includes('t.co/') || 
         url.includes('bit.ly/') || 
         url.includes('buff.ly/') ||
         url.includes('tinyurl.com/') ||
         url.includes('ow.ly/') ||
         url.includes('goo.gl/') ||
         url.match(/https?:\/\/\w+\.\w+\/\w{5,10}$/i) !== null;
}

/**
 * Formats a URL for display, removing unnecessary parts
 * @param url The URL to format
 * @returns Formatted URL for display
 */
export function formatDisplayUrl(url: string): string {
  if (!url) return '';
  
  try {
    const urlObj = new URL(url);
    // Create a simplified display version (e.g., example.com/page)
    let displayUrl = `${urlObj.hostname}${urlObj.pathname !== '/' ? urlObj.pathname : ''}`;
    // Truncate if too long
    if (displayUrl.length > 30) {
      displayUrl = displayUrl.substring(0, 27) + '...';
    }
    return displayUrl;
  } catch (error) {
    // If URL parsing fails, return the original
    return url;
  }
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