import { NextResponse } from 'next/server';
import { TwitterApi } from 'twitter-api-v2';
import fs from 'fs';
import path from 'path';

// Debug helper for runtime
const debugModuleResolution = () => {
  try {
    const baseDir = process.cwd();
    console.log('[RUNTIME DEBUG] Current working directory:', baseDir);
    
    // Check node_modules
    const nodeModulesPath = path.join(baseDir, 'node_modules');
    console.log('[RUNTIME DEBUG] node_modules exists:', fs.existsSync(nodeModulesPath));
    
    // Check styled-jsx
    const styledJsxPath = path.join(nodeModulesPath, 'styled-jsx');
    console.log('[RUNTIME DEBUG] styled-jsx exists:', fs.existsSync(styledJsxPath));
    
    if (fs.existsSync(styledJsxPath)) {
      console.log('[RUNTIME DEBUG] styled-jsx contents:', fs.readdirSync(styledJsxPath));
      
      // Check package.json
      const packageJsonPath = path.join(styledJsxPath, 'package.json');
      console.log('[RUNTIME DEBUG] package.json exists:', fs.existsSync(packageJsonPath));
    }
    
    // Log module paths
    console.log('[RUNTIME DEBUG] Module paths:', module.paths);
  } catch (error) {
    console.error('[RUNTIME DEBUG] Error:', error);
  }
}

// Enhanced debug helper for Twitter API configuration
const debugTwitterConfig = () => {
  console.warn('[TWITTER CONFIG] Starting environment check...');
  const config = {
    TWITTER_API_KEY: !!process.env.TWITTER_API_KEY,
    TWITTER_API_SECRET: !!process.env.TWITTER_API_SECRET,
    TWITTER_USERNAME: !!process.env.TWITTER_USERNAME,
    NEXT_PUBLIC_TWITTER_USERNAME: !!process.env.NEXT_PUBLIC_TWITTER_USERNAME,
    NODE_ENV: process.env.NODE_ENV
  };
  
  console.warn('[TWITTER CONFIG] Environment variables:', config);
  
  if (process.env.TWITTER_API_KEY) {
    const maskedKey = `${process.env.TWITTER_API_KEY.slice(0, 4)}...${process.env.TWITTER_API_KEY.slice(-4)}`;
    console.warn('[TWITTER CONFIG] API Key format:', maskedKey);
  }
  
  return config;
}

// Simple logging helper that works in Vercel
function log(level: 'info' | 'error', message: string, data?: any) {
  const timestamp = new Date().toISOString();
  const logData = {
    timestamp,
    level,
    message,
    ...data,
    // Add request ID or other context if available
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
  };

  // Force log to stderr for Vercel
  console.error(JSON.stringify(logData));
}

// Initialize Twitter client with basic error handling
const getTwitterClient = () => {
  console.log('Twitter API Config:', {
    hasKey: !!process.env.TWITTER_API_KEY,
    hasSecret: !!process.env.TWITTER_API_SECRET,
    env: process.env.NODE_ENV
  });

  if (!process.env.TWITTER_API_KEY || !process.env.TWITTER_API_SECRET) {
    console.error('Missing Twitter credentials');
    throw new Error('Twitter API credentials not configured');
  }

  return new TwitterApi({
    appKey: process.env.TWITTER_API_KEY,
    appSecret: process.env.TWITTER_API_SECRET,
  });
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const username = searchParams.get('username')?.replace('@', '');

    console.log('Twitter API Request:', { action, username });

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 });
    }

    const client = getTwitterClient();

    switch (action) {
      case 'fetch_tweets': {
        if (!username) {
          return NextResponse.json({ error: 'Username is required' }, { status: 400 });
        }

        console.log(`Fetching user data for: ${username}`);
        const user = await client.v2.userByUsername(username);
        
        if (!user.data) {
          console.error('User not found:', username);
          return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        console.log(`Fetching tweets for user ID: ${user.data.id}`);
        const tweets = await client.v2.userTimeline(user.data.id, {
          exclude: ['replies', 'retweets'],
          expansions: ['author_id', 'attachments.media_keys'],
          'tweet.fields': ['created_at', 'text', 'public_metrics'],
          'user.fields': ['profile_image_url', 'username'],
          max_results: 10,
        });

        console.log('Tweets fetched:', tweets.data.meta);
        return NextResponse.json(tweets.data);
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    // Log the full error with all available details
    console.error('Twitter API Error:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      name: error instanceof Error ? error.name : 'Unknown',
      stack: error instanceof Error ? error.stack : undefined,
      raw: error // Log the raw error object
    });

    return NextResponse.json({
      error: 'Failed to process Twitter request',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { text, accessToken } = await request.json();
    console.log('Processing tweet post:', { hasText: !!text, hasToken: !!accessToken });

    if (!text?.trim()) {
      return NextResponse.json({ error: 'Tweet text is required' }, { status: 400 });
    }

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const client = new TwitterApi(accessToken);
    const tweet = await client.v2.tweet(text);
    console.log('Tweet posted:', tweet.data.id);

    return NextResponse.json(tweet.data);
  } catch (error) {
    console.error('Tweet post error:', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: 'Failed to post tweet' },
      { status: 500 }
    );
  }
} 