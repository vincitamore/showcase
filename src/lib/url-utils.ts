/**
 * Client-safe utility functions for URL handling
 * This file is separated from tweet-utils.ts to avoid importing Prisma in client components
 */

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