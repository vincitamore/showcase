import { PrismaClient } from '@prisma/client'
import { env } from '@/env'

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined
}

const prismaClientSingleton = () => {
  return new PrismaClient({
    log: ['error', 'warn']
  })
}

export const prisma = globalThis.prisma ?? prismaClientSingleton()

if (env.NODE_ENV !== 'production') {
  globalThis.prisma = prisma
}

export type { PrismaClient } from '@prisma/client' 