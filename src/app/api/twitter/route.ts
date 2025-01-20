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

// Initialize Twitter client with enhanced error handling
const getTwitterClient = () => {
  const envState = {
    hasApiKey: !!process.env.TWITTER_API_KEY,
    hasApiSecret: !!process.env.TWITTER_API_SECRET,
    env: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV
  };
  
  log('info', 'Initializing Twitter client', { envState });
  
  if (!process.env.TWITTER_API_KEY || !process.env.TWITTER_API_SECRET) {
    const error = new Error('Twitter API credentials not configured');
    log('error', 'Twitter client initialization failed', { 
      error: error.message,
      envState 
    });
    throw error;
  }

  try {
    return new TwitterApi({
      appKey: process.env.TWITTER_API_KEY,
      appSecret: process.env.TWITTER_API_SECRET,
    });
  } catch (error) {
    log('error', 'Twitter client creation failed', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      envState
    });
    throw error;
  }
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const username = searchParams.get('username')?.replace('@', '');

    log('info', 'Processing Twitter request', {
      action,
      username,
      url: request.url
    });

    if (!action) {
      log('error', 'Missing action parameter');
      return NextResponse.json({ error: 'Action is required' }, { status: 400 });
    }

    const client = getTwitterClient();

    switch (action) {
      case 'fetch_tweets': {
        if (!username) {
          log('error', 'Missing username parameter');
          return NextResponse.json({ error: 'Username is required' }, { status: 400 });
        }

        const user = await client.v2.userByUsername(username);
        
        if (!user.data) {
          log('error', 'User not found', { username });
          return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const tweets = await client.v2.userTimeline(user.data.id, {
          exclude: ['replies', 'retweets'],
          expansions: ['author_id', 'attachments.media_keys'],
          'tweet.fields': ['created_at', 'text', 'public_metrics'],
          'user.fields': ['profile_image_url', 'username'],
          max_results: 10,
        });

        log('info', 'Tweets fetched successfully', {
          userId: user.data.id,
          tweetCount: tweets.data.meta?.result_count || 0
        });

        return NextResponse.json(tweets.data);
      }

      default:
        log('error', 'Invalid action', { action });
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    const errorDetails = {
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : 'Unknown error',
      env: {
        node: process.env.NODE_ENV,
        vercel: process.env.VERCEL_ENV
      }
    };

    log('error', 'Twitter request failed', errorDetails);

    return NextResponse.json({
      error: 'Failed to process Twitter request',
      details: error instanceof Error ? error.message : 'Unknown error',
      env: process.env.VERCEL_ENV || process.env.NODE_ENV
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { text, accessToken } = await request.json();

    log('info', 'Processing POST request', { hasText: !!text, hasToken: !!accessToken });

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

    log('info', 'Tweet posted successfully', { tweetId: tweet.data.id });

    return NextResponse.json(tweet.data);
  } catch (error) {
    log('error', 'Failed to post tweet', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    return NextResponse.json(
      { error: 'Failed to post tweet' },
      { status: 500 }
    );
  }
} 