import { createEnv } from '@t3-oss/env-nextjs'
import { z } from 'zod'

export const env = createEnv({
  server: {
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    DATABASE_URL: z.string().url(),
    DIRECT_URL: z.string().url(),
    XAI_API_KEY: z.string(),
    ANTHROPIC_API_KEY: z.string(),
    CRON_SECRET: z.string(),
    TWITTER_API_KEY: z.string().optional(),
    TWITTER_API_SECRET: z.string().optional(),
    TWITTER_ACCESS_TOKEN: z.string().optional(),
    TWITTER_ACCESS_SECRET: z.string().optional(),
    TWITTER_USERNAME: z.string().optional(),
    MONITORING_USERNAME: z.string(),
    MONITORING_PASSWORD_HASH: z.string(),
    MONITORING_AUTH_SALT: z.string(),
    MONITORING_ENABLED: z.boolean().default(false),
  },
  client: {
    NEXT_PUBLIC_URL: z.string().url(),
    NEXT_PUBLIC_TWITTER_USERNAME: z.string().optional(),
    NEXT_PUBLIC_MONITORING_ENABLED: z.boolean().default(false),
  },
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
    DIRECT_URL: process.env.DIRECT_URL,
    XAI_API_KEY: process.env.XAI_API_KEY,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    CRON_SECRET: process.env.CRON_SECRET,
    TWITTER_API_KEY: process.env.TWITTER_API_KEY,
    TWITTER_API_SECRET: process.env.TWITTER_API_SECRET,
    TWITTER_ACCESS_TOKEN: process.env.TWITTER_ACCESS_TOKEN,
    TWITTER_ACCESS_SECRET: process.env.TWITTER_ACCESS_SECRET,
    TWITTER_USERNAME: process.env.TWITTER_USERNAME,
    NEXT_PUBLIC_URL: process.env.NEXT_PUBLIC_URL,
    NEXT_PUBLIC_TWITTER_USERNAME: process.env.NEXT_PUBLIC_TWITTER_USERNAME,
    MONITORING_USERNAME: process.env.MONITORING_USERNAME,
    MONITORING_PASSWORD_HASH: process.env.MONITORING_PASSWORD_HASH,
    MONITORING_AUTH_SALT: process.env.MONITORING_AUTH_SALT,
    MONITORING_ENABLED: process.env.MONITORING_ENABLED === 'true',
    NEXT_PUBLIC_MONITORING_ENABLED: process.env.MONITORING_ENABLED === 'true',
  },
}) 