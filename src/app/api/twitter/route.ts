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

// Initialize Twitter client with enhanced error handling
const getTwitterClient = () => {
  const config = debugTwitterConfig();
  
  if (!process.env.TWITTER_API_KEY || !process.env.TWITTER_API_SECRET) {
    const error = new Error('Twitter API credentials not configured');
    console.warn('[TWITTER ERROR] Initialization failed:', error.message, '\nConfig:', config);
    throw error;
  }

  try {
    console.warn('[TWITTER CLIENT] Initializing...');
    const client = new TwitterApi({
      appKey: process.env.TWITTER_API_KEY,
      appSecret: process.env.TWITTER_API_SECRET,
    });
    console.warn('[TWITTER CLIENT] Initialized successfully');
    return client;
  } catch (error) {
    console.warn('[TWITTER ERROR] Client initialization failed:', error);
    throw error;
  }
};

export async function GET(request: Request) {
  try {
    console.warn('[TWITTER REQUEST] Starting GET request processing');
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const username = searchParams.get('username')?.replace('@', '');

    console.warn('[TWITTER REQUEST] Params:', { action, username });

    if (!action) {
      console.warn('[TWITTER REQUEST] Missing action parameter');
      return NextResponse.json({ error: 'Action is required' }, { status: 400 });
    }

    const client = getTwitterClient();

    switch (action) {
      case 'fetch_tweets': {
        if (!username) {
          console.warn('[TWITTER REQUEST] Missing username parameter');
          return NextResponse.json({ error: 'Username is required' }, { status: 400 });
        }

        console.warn('[TWITTER REQUEST] Fetching user data for:', username);
        const user = await client.v2.userByUsername(username);
        
        if (!user.data) {
          console.warn('[TWITTER REQUEST] User not found:', username);
          return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        console.warn('[TWITTER REQUEST] Found user:', user.data.id);
        console.warn('[TWITTER REQUEST] Fetching tweets...');
        
        const tweets = await client.v2.userTimeline(user.data.id, {
          exclude: ['replies', 'retweets'],
          expansions: ['author_id', 'attachments.media_keys'],
          'tweet.fields': ['created_at', 'text', 'public_metrics'],
          'user.fields': ['profile_image_url', 'username'],
          max_results: 10,
        });

        console.warn('[TWITTER REQUEST] Tweets fetched successfully');
        return NextResponse.json(tweets.data);
      }

      default:
        console.warn('[TWITTER REQUEST] Invalid action:', action);
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    // Enhanced error logging
    console.warn('[TWITTER ERROR] Request failed:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      error: JSON.stringify(error, null, 2)
    });

    return NextResponse.json(
      { 
        error: 'Failed to process Twitter request', 
        details: error instanceof Error ? error.message : 'Unknown error',
        env: process.env.NODE_ENV
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  debugModuleResolution();
  
  try {
    const { text, accessToken } = await request.json();

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

    return NextResponse.json(tweet.data);
  } catch (error) {
    console.error('Twitter API error:', error);
    return NextResponse.json(
      { error: 'Failed to post tweet' },
      { status: 500 }
    );
  }
} 