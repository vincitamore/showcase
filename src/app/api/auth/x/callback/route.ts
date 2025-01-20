import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getReadOnlyClient } from '@/lib/x-api';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const state = searchParams.get('state');
    const code = searchParams.get('code');
    
    const storedState = cookies().get('x_oauth_state')?.value;
    const codeVerifier = cookies().get('x_oauth_code_verifier')?.value;

    if (!state || !code || !storedState || !codeVerifier) {
      return NextResponse.redirect(new URL('/auth-error', request.url));
    }

    if (state !== storedState) {
      return NextResponse.redirect(new URL('/auth-error?error=invalid_state', request.url));
    }

    const client = getReadOnlyClient();
    const { accessToken, refreshToken } = await client.loginWithOAuth2({
      code,
      codeVerifier,
      redirectUri: process.env.NEXT_PUBLIC_APP_URL + '/api/auth/x/callback'
    });

    // Clear the OAuth cookies
    cookies().delete('x_oauth_state');
    cookies().delete('x_oauth_code_verifier');

    // Set the access token in an httpOnly cookie
    cookies().set('x_access_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7 // 1 week
    });

    if (refreshToken) {
      cookies().set('x_refresh_token', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30 // 30 days
      });
    }

    // Redirect back to the blog section
    return NextResponse.redirect(new URL('/#blog', request.url));
  } catch (error) {
    console.error('Error handling OAuth callback:', error);
    return NextResponse.redirect(new URL('/auth-error', request.url));
  }
} 