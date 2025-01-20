import { NextResponse } from 'next/server';
import { getOAuthUrl } from '@/lib/x-api';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    const { url, state, codeVerifier } = await getOAuthUrl();
    
    // Store state and code verifier in cookies for verification during callback
    cookies().set('x_oauth_state', state, { 
      httpOnly: true, 
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 10 // 10 minutes
    });
    
    cookies().set('x_oauth_code_verifier', codeVerifier, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 10 // 10 minutes
    });

    return NextResponse.json({ url });
  } catch (error) {
    console.error('Error generating auth URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate authentication URL' },
      { status: 500 }
    );
  }
} 