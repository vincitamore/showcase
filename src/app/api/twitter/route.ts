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
  console.log('[TWITTER DEBUG] Environment check:');
  console.log('[TWITTER DEBUG] TWITTER_API_KEY exists:', !!process.env.TWITTER_API_KEY);
  console.log('[TWITTER DEBUG] TWITTER_API_SECRET exists:', !!process.env.TWITTER_API_SECRET);
  console.log('[TWITTER DEBUG] TWITTER_USERNAME exists:', !!process.env.TWITTER_USERNAME);
  console.log('[TWITTER DEBUG] NEXT_PUBLIC_TWITTER_USERNAME exists:', !!process.env.NEXT_PUBLIC_TWITTER_USERNAME);
  
  // Log masked versions of keys for verification
  if (process.env.TWITTER_API_KEY) {
    const maskedKey = `${process.env.TWITTER_API_KEY.slice(0, 4)}...${process.env.TWITTER_API_KEY.slice(-4)}`;
    console.log('[TWITTER DEBUG] API Key format:', maskedKey);
  }
}

// Initialize Twitter client with enhanced error handling
const getTwitterClient = () => {
  debugTwitterConfig();
  
  if (!process.env.TWITTER_API_KEY || !process.env.TWITTER_API_SECRET) {
    console.error('[TWITTER ERROR] Missing required environment variables');
    throw new Error('Twitter API credentials not configured');
  }

  try {
    console.log('[TWITTER DEBUG] Initializing Twitter client...');
    const client = new TwitterApi({
      appKey: process.env.TWITTER_API_KEY,
      appSecret: process.env.TWITTER_API_SECRET,
    });
    console.log('[TWITTER DEBUG] Twitter client initialized successfully');
    return client;
  } catch (error) {
    console.error('[TWITTER ERROR] Failed to initialize Twitter client:', error);
    throw error;
  }
};

export async function GET(request: Request) {
  debugModuleResolution();
  
  try {
    console.log('[TWITTER DEBUG] Processing GET request...');
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const username = searchParams.get('username')?.replace('@', '');

    console.log('[TWITTER DEBUG] Request params:', { action, username });

    if (!action) {
      console.log('[TWITTER DEBUG] Missing action parameter');
      return NextResponse.json({ error: 'Action is required' }, { status: 400 });
    }

    const client = getTwitterClient();

    switch (action) {
      case 'fetch_tweets': {
        if (!username) {
          console.log('[TWITTER DEBUG] Missing username parameter');
          return NextResponse.json({ error: 'Username is required' }, { status: 400 });
        }

        console.log('[TWITTER DEBUG] Fetching user data for:', username);
        const user = await client.v2.userByUsername(username);
        
        if (!user.data) {
          console.log('[TWITTER DEBUG] User not found:', username);
          return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        console.log('[TWITTER DEBUG] Found user:', user.data.id);
        console.log('[TWITTER DEBUG] Fetching tweets...');
        
        const tweets = await client.v2.userTimeline(user.data.id, {
          exclude: ['replies', 'retweets'],
          expansions: ['author_id', 'attachments.media_keys'],
          'tweet.fields': ['created_at', 'text', 'public_metrics'],
          'user.fields': ['profile_image_url', 'username'],
          max_results: 10,
        });

        console.log('[TWITTER DEBUG] Fetched tweets:', tweets.data);
        return NextResponse.json(tweets.data);
      }

      default:
        console.log('[TWITTER DEBUG] Invalid action:', action);
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('[TWITTER ERROR] Request failed:', error);
    // Log the full error object for debugging
    console.error('[TWITTER ERROR] Full error:', JSON.stringify(error, null, 2));
    return NextResponse.json(
      { error: 'Failed to process Twitter request', details: error instanceof Error ? error.message : 'Unknown error' },
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