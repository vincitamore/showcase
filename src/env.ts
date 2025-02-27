import { createEnv } from '@t3-oss/env-nextjs'
import { z } from 'zod'

// Debug: Log environment variables
console.log('Environment Variables Debug:', {
  NODE_ENV: process.env.NODE_ENV,
  MONITORING_ENABLED: process.env.MONITORING_ENABLED,
  NEXT_PUBLIC_URL: process.env.NEXT_PUBLIC_URL,
})

export const env = createEnv({
  server: {
    NODE_ENV: z.enum(['development', 'test', 'production']),
    DATABASE_URL: z.string().url(),
    DIRECT_URL: z.string().url(),
    XAI_API_KEY: z.string(),
    ANTHROPIC_API_KEY: z.string(),
    CRON_SECRET: z.string(),
    DEV_SECRET: z.string().optional(),
    ALLOW_DEV_ENDPOINTS: z.coerce.boolean().default(false),
    TWITTER_API_KEY: z.string().optional(),
    TWITTER_API_SECRET: z.string().optional(),
    TWITTER_ACCESS_TOKEN: z.string().optional(),
    TWITTER_ACCESS_SECRET: z.string().optional(),
    TWITTER_USERNAME: z.string().optional(),
    MONITORING_USERNAME: z.string().min(1),
    MONITORING_PASSWORD_HASH: z.string().min(64), // SHA-256 hash
    MONITORING_AUTH_SALT: z.string().min(32),
    MONITORING_ENABLED: z.coerce.boolean().default(true),
  },
  client: {
    NEXT_PUBLIC_URL: z.string().url(),
    NEXT_PUBLIC_TWITTER_USERNAME: z.string().optional(),
    NEXT_PUBLIC_MONITORING_ENABLED: z.coerce.boolean().default(true),
    NEXT_PUBLIC_XAI_ENABLED: z.coerce.boolean().default(false),
    NEXT_PUBLIC_ANTHROPIC_ENABLED: z.coerce.boolean().default(false),
  },
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
    DIRECT_URL: process.env.DIRECT_URL,
    XAI_API_KEY: process.env.XAI_API_KEY,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    CRON_SECRET: process.env.CRON_SECRET,
    DEV_SECRET: process.env.DEV_SECRET,
    ALLOW_DEV_ENDPOINTS: process.env.ALLOW_DEV_ENDPOINTS,
    TWITTER_API_KEY: process.env.TWITTER_API_KEY,
    TWITTER_API_SECRET: process.env.TWITTER_API_SECRET,
    TWITTER_ACCESS_TOKEN: process.env.TWITTER_ACCESS_TOKEN,
    TWITTER_ACCESS_SECRET: process.env.TWITTER_ACCESS_SECRET,
    TWITTER_USERNAME: process.env.TWITTER_USERNAME,
    MONITORING_USERNAME: process.env.MONITORING_USERNAME,
    MONITORING_PASSWORD_HASH: process.env.MONITORING_PASSWORD_HASH,
    MONITORING_AUTH_SALT: process.env.MONITORING_AUTH_SALT,
    MONITORING_ENABLED: process.env.MONITORING_ENABLED,
    NEXT_PUBLIC_URL: process.env.NEXT_PUBLIC_URL,
    NEXT_PUBLIC_TWITTER_USERNAME: process.env.NEXT_PUBLIC_TWITTER_USERNAME,
    NEXT_PUBLIC_MONITORING_ENABLED: process.env.MONITORING_ENABLED,
    NEXT_PUBLIC_XAI_ENABLED: process.env.NEXT_PUBLIC_XAI_ENABLED,
    NEXT_PUBLIC_ANTHROPIC_ENABLED: process.env.NEXT_PUBLIC_ANTHROPIC_ENABLED,
  },
  skipValidation: process.env.SKIP_ENV_VALIDATION === 'true',
  emptyStringAsUndefined: true,
}) 