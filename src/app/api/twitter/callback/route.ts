import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createTwitterClient, getBaseUrl } from '@/lib/twitter-client';

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
      throw new Error('Missing OAuth parameters');
    }
    
    if (state !== storedState) {
      throw new Error('Invalid state parameter');
    }
    
    cookieStore.delete('x_oauth_state');
    cookieStore.delete('x_oauth_code_verifier');
    
    const client = createTwitterClient();
    const baseUrl = getBaseUrl();
    
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
    console.error('OAuth callback error:', error);
    
    cookieStore.delete('x_oauth_state');
    cookieStore.delete('x_oauth_code_verifier');
    
    const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
    const response = NextResponse.redirect(
      new URL(`/error?message=${encodeURIComponent(errorMessage)}`, request.url),
      { status: 302 }
    );

    response.headers.set('Cache-Control', 'no-store, max-age=0');
    
    return response;
  }
} 