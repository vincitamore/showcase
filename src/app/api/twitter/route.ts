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
  // Log environment state
  const envState = {
    hasApiKey: !!process.env.TWITTER_API_KEY,
    hasApiSecret: !!process.env.TWITTER_API_SECRET,
    env: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV
  };
  
  if (!process.env.TWITTER_API_KEY || !process.env.TWITTER_API_SECRET) {
    const error = new Error('Twitter API credentials not configured');
    // Use error level for important issues
    console.error('Twitter client initialization failed:', { 
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
    console.error('Twitter client creation failed:', { 
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

    // Log request details
    console.log('Processing Twitter request:', {
      action,
      username,
      url: request.url
    });

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 });
    }

    const client = getTwitterClient();

    switch (action) {
      case 'fetch_tweets': {
        if (!username) {
          return NextResponse.json({ error: 'Username is required' }, { status: 400 });
        }

        const user = await client.v2.userByUsername(username);
        
        if (!user.data) {
          console.error('Twitter user not found:', { username });
          return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const tweets = await client.v2.userTimeline(user.data.id, {
          exclude: ['replies', 'retweets'],
          expansions: ['author_id', 'attachments.media_keys'],
          'tweet.fields': ['created_at', 'text', 'public_metrics'],
          'user.fields': ['profile_image_url', 'username'],
          max_results: 10,
        });

        // Log success
        console.log('Tweets fetched successfully:', {
          userId: user.data.id,
          tweetCount: tweets.data.meta?.result_count || 0
        });

        return NextResponse.json(tweets.data);
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    // Log the full error details
    console.error('Twitter request failed:', {
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : 'Unknown error',
      env: {
        node: process.env.NODE_ENV,
        vercel: process.env.VERCEL_ENV
      }
    });

    // Return a structured error response
    return NextResponse.json({
      error: 'Failed to process Twitter request',
      details: error instanceof Error ? error.message : 'Unknown error',
      env: process.env.VERCEL_ENV || process.env.NODE_ENV
    }, { status: 500 });
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