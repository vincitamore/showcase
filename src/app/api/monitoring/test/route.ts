import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  try {
    // Make a test database query
    const result = await prisma.log.count()

    // Make another query to ensure we have multiple data points
    const recentLogs = await prisma.log.findMany({
      take: 5,
      orderBy: {
        timestamp: 'desc'
      }
    })

    return NextResponse.json({ 
      success: true,
      totalLogs: result,
      recentLogs: recentLogs.length
    })
  } catch (error) {
    console.error('Test query failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
} 