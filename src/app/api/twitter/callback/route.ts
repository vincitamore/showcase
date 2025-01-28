import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createTwitterClient, getBaseUrl } from '@/lib/twitter-client';
import { APIError, handleAPIError } from '@/lib/api-error';
import { logger, withLogging } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function handleTwitterCallback(request: Request): Promise<Response> {
  const cookieStore = cookies();
  
  try {
    const { searchParams } = new URL(request.url);
    const state = searchParams.get('state');
    const code = searchParams.get('code');
    
    const storedState = cookieStore.get('x_oauth_state')?.value;
    const codeVerifier = cookieStore.get('x_oauth_code_verifier')?.value;
    
    logger.info('Processing OAuth callback', {
      step: 'validate-params',
      hasState: !!state,
      hasCode: !!code,
      hasStoredState: !!storedState,
      hasCodeVerifier: !!codeVerifier
    });
    
    if (!state || !code || !storedState || !codeVerifier) {
      logger.warn('Missing OAuth parameters', {
        step: 'validation',
        missingState: !state,
        missingCode: !code,
        missingStoredState: !storedState,
        missingCodeVerifier: !codeVerifier
      });
      throw new APIError(
        'Missing OAuth parameters',
        400,
        'MISSING_OAUTH_PARAMS'
      );
    }
    
    if (state !== storedState) {
      logger.warn('Invalid OAuth state', {
        step: 'validation',
        expectedState: storedState,
        receivedState: state
      });
      throw new APIError(
        'Invalid OAuth state parameter',
        400,
        'INVALID_OAUTH_STATE'
      );
    }
    
    logger.debug('Cleaning up OAuth cookies', {
      step: 'cleanup-cookies'
    });
    
    // Clean up OAuth cookies regardless of outcome
    cookieStore.delete('x_oauth_state');
    cookieStore.delete('x_oauth_code_verifier');
    
    const client = createTwitterClient();
    const baseUrl = getBaseUrl();
    
    try {
      logger.info('Exchanging OAuth code for tokens', {
        step: 'token-exchange',
        redirectUri: `${baseUrl}/api/twitter/callback`
      });

      const { accessToken, refreshToken } = await client.loginWithOAuth2({
        code,
        codeVerifier,
        redirectUri: `${baseUrl}/api/twitter/callback`,
      });
      
      logger.debug('Setting auth cookies', {
        step: 'set-cookies',
        hasAccessToken: !!accessToken,
        hasRefreshToken: !!refreshToken,
        secure: process.env.NODE_ENV === 'production'
      });
      
      cookieStore.set('x_access_token', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7,
        path: '/'
      });
      
      if (refreshToken) {
        cookieStore.set('x_refresh_token', refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 30,
          path: '/'
        });
      }
      
      logger.info('Authentication successful', {
        step: 'complete',
        redirectTo: '/blog'
      });
      
      const response = NextResponse.redirect(new URL('/blog', request.url), {
        status: 302,
      });

      response.headers.set('Cache-Control', 'no-store, max-age=0');
      
      return response;
    } catch (error) {
      logger.error('Twitter OAuth login failed', {
        step: 'token-exchange-error',
        error
      });
      throw new APIError(
        `Twitter OAuth login failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500,
        'TWITTER_LOGIN_ERROR'
      );
    }
  } catch (error) {
    logger.error('OAuth callback failed', {
      step: 'error',
      error
    });

    // Clean up OAuth cookies on error
    cookieStore.delete('x_oauth_state');
    cookieStore.delete('x_oauth_code_verifier');
    
    // For OAuth errors, redirect to error page instead of returning JSON
    const errorMessage = error instanceof APIError 
      ? error.message
      : 'Authentication failed';
      
    logger.info('Redirecting to error page', {
      step: 'error-redirect',
      errorMessage
    });

    const response = NextResponse.redirect(
      new URL(`/error?message=${encodeURIComponent(errorMessage)}`, request.url),
      { status: 302 }
    );

    response.headers.set('Cache-Control', 'no-store, max-age=0');
    
    return response;
  }
}

export const GET = withLogging(handleTwitterCallback, 'api/twitter/callback'); 