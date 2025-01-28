import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { TwitterApi } from 'twitter-api-v2';
import { APIError, handleAPIError } from '@/lib/api-error';
import { logger, withLogging } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function handleTwitterAuth(request: Request): Promise<Response> {
  const cookieStore = cookies();
  
  try {
    // Check Twitter OAuth configuration
    if (!process.env.TWITTER_CLIENT_ID || !process.env.TWITTER_CLIENT_SECRET) {
      logger.error('Twitter OAuth configuration missing', {
        step: 'config-check',
        hasClientId: !!process.env.TWITTER_CLIENT_ID,
        hasClientSecret: !!process.env.TWITTER_CLIENT_SECRET
      });
      throw new APIError(
        'Twitter OAuth credentials not configured',
        500,
        'TWITTER_CONFIG_ERROR'
      );
    }

    // Determine base URL for callback
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || (
      process.env.NODE_ENV === 'production' 
        ? 'https://' + process.env.VERCEL_URL 
        : 'http://localhost:3000'
    );

    logger.info('Initializing Twitter OAuth', {
      step: 'init',
      baseUrl,
      environment: process.env.NODE_ENV
    });

    const client = new TwitterApi({
      clientId: process.env.TWITTER_CLIENT_ID,
      clientSecret: process.env.TWITTER_CLIENT_SECRET,
    });

    try {
      logger.info('Generating OAuth URL', {
        step: 'generate-url',
        callbackUrl: `${baseUrl}/api/twitter/callback`
      });

      const { url, state, codeVerifier } = client.generateOAuth2AuthLink(
        `${baseUrl}/api/twitter/callback`,
        { scope: ['tweet.read', 'tweet.write', 'users.read'] }
      );
      
      logger.debug('Setting OAuth cookies', {
        step: 'set-cookies',
        hasState: !!state,
        hasCodeVerifier: !!codeVerifier,
        secure: process.env.NODE_ENV === 'production'
      });

      // Set OAuth state cookie
      cookieStore.set('x_oauth_state', state, { 
        httpOnly: true, 
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 10,
        path: '/'
      });
      
      // Set code verifier cookie
      cookieStore.set('x_oauth_code_verifier', codeVerifier, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 10,
        path: '/'
      });

      logger.info('OAuth URL generated successfully', {
        step: 'complete',
        hasUrl: !!url
      });

      return NextResponse.json({ url });
    } catch (error) {
      logger.error('Failed to generate OAuth URL', {
        step: 'generate-url-error',
        error,
        baseUrl
      });
      throw new APIError(
        `Failed to generate Twitter authentication URL: ${error instanceof Error ? error.message : 'Unknown error'}. Base URL: ${baseUrl}`,
        500,
        'TWITTER_AUTH_ERROR'
      );
    }
  } catch (error) {
    logger.error('Twitter auth request failed', {
      step: 'error',
      error
    });
    return handleAPIError(error);
  }
}

export const GET = withLogging(handleTwitterAuth, 'api/twitter/auth'); 