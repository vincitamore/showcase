import { TwitterApi } from 'twitter-api-v2';

export function createTwitterClient() {
  if (!process.env.TWITTER_CLIENT_ID || !process.env.TWITTER_API_SECRET) {
    throw new Error('Missing Twitter credentials');
  }

  return new TwitterApi({
    clientId: process.env.TWITTER_CLIENT_ID,
    clientSecret: process.env.TWITTER_API_SECRET,
  });
}

export function getBaseUrl() {
  return process.env.NEXT_PUBLIC_BASE_URL || (
    process.env.NODE_ENV === 'production' 
      ? 'https://' + process.env.VERCEL_URL 
      : 'http://localhost:3000'
  );
} 