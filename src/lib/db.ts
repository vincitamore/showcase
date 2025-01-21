import { PrismaClient } from '@prisma/client'
import { env } from '@/env'

declare global {
  var prisma: PrismaClient | undefined
}

export const prisma = globalThis.prisma || new PrismaClient()

if (env.NODE_ENV !== 'production') {
  globalThis.prisma = prisma
}

export type { 
  ChatSession,
  Message,
  SystemPrompt,
  RateLimit,
} from '@prisma/client' 