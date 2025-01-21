import { prisma } from '@/lib/db'
import { env } from '@/env'

const RATE_LIMIT_WINDOW = 60 * 60 * 1000 // 1 hour in milliseconds
const MAX_REQUESTS = env.NODE_ENV === 'production' ? 20 : 100

export async function checkRateLimit(ipAddress: string): Promise<boolean> {
  const now = new Date()
  const resetAt = new Date(now.getTime() + RATE_LIMIT_WINDOW)

  try {
    const rateLimit = await prisma.rateLimit.upsert({
      where: { ipAddress },
      create: {
        id: `${ipAddress}-${now.getTime()}`,
        ipAddress,
        hits: 1,
        resetAt,
      },
      update: {
        hits: {
          increment: 1,
        },
      },
    })

    // If the rate limit has expired, reset it
    if (now > rateLimit.resetAt) {
      await prisma.rateLimit.update({
        where: { ipAddress },
        data: {
          hits: 1,
          resetAt,
        },
      })
      return true
    }

    // Check if the rate limit has been exceeded
    return rateLimit.hits <= MAX_REQUESTS
  } catch (error) {
    console.error('Rate limit check failed:', error)
    // In case of error, allow the request but log the error
    return true
  }
}

export async function getRateLimitInfo(ipAddress: string) {
  try {
    const rateLimit = await prisma.rateLimit.findUnique({
      where: { ipAddress },
    })

    if (!rateLimit) {
      return {
        remaining: MAX_REQUESTS,
        reset: new Date(Date.now() + RATE_LIMIT_WINDOW),
      }
    }

    return {
      remaining: Math.max(0, MAX_REQUESTS - rateLimit.hits),
      reset: rateLimit.resetAt,
    }
  } catch (error) {
    console.error('Failed to get rate limit info:', error)
    return {
      remaining: MAX_REQUESTS,
      reset: new Date(Date.now() + RATE_LIMIT_WINDOW),
    }
  }
} 