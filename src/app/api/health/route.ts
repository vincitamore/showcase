import { NextResponse } from 'next/server'

export async function GET() {
  console.log('[Health] API request received');
  return NextResponse.json({ status: 'ok', timestamp: new Date().toISOString() })
}

export async function POST() {
  console.log('[Health] POST request received');
  return NextResponse.json({ status: 'ok', timestamp: new Date().toISOString() })
} 