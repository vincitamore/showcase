import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createTwitterClient, getBaseUrl } from '@/lib/twitter-client';
import { APIError, handleAPIError } from '@/lib/api-error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const cookieStore = cookies();
  
  try {
    const { searchParams } = new URL(request.url);
    const state = searchParams.get('state');
    const code = searchParams.get('code');
    
    const storedState = cookieStore.get('x_oauth_state')?.value;
    const codeVerifier = cookieStore.get('x_oauth_code_verifier')?.value;
    
    if (!state || !code || !storedState || !codeVerifier) {
      throw new APIError(
        'Missing OAuth parameters',
        400,
        'MISSING_OAUTH_PARAMS'
      );
    }
    
    if (state !== storedState) {
      throw new APIError(
        'Invalid OAuth state parameter',
        400,
        'INVALID_OAUTH_STATE'
      );
    }
    
    // Clean up OAuth cookies regardless of outcome
    cookieStore.delete('x_oauth_state');
    cookieStore.delete('x_oauth_code_verifier');
    
    const client = createTwitterClient();
    const baseUrl = getBaseUrl();
    
    try {
      const { accessToken, refreshToken } = await client.loginWithOAuth2({
        code,
        codeVerifier,
        redirectUri: `${baseUrl}/api/twitter/callback`,
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
      
      const response = NextResponse.redirect(new URL('/blog', request.url), {
        status: 302,
      });

      response.headers.set('Cache-Control', 'no-store, max-age=0');
      
      return response;
    } catch (error) {
      throw new APIError(
        `Twitter OAuth login failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500,
        'TWITTER_LOGIN_ERROR'
      );
    }
  } catch (error) {
    // Clean up OAuth cookies on error
    cookieStore.delete('x_oauth_state');
    cookieStore.delete('x_oauth_code_verifier');
    
    // For OAuth errors, redirect to error page instead of returning JSON
    const errorMessage = error instanceof APIError 
      ? error.message
      : 'Authentication failed';
      
    const response = NextResponse.redirect(
      new URL(`/error?message=${encodeURIComponent(errorMessage)}`, request.url),
      { status: 302 }
    );

    response.headers.set('Cache-Control', 'no-store, max-age=0');
    
    return response;
  }
} 