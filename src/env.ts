import { z } from "zod"

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url(),
  XAI_API_KEY: z.string().min(1),
  CRON_SECRET: z.string().min(1),
  TWITTER_API_KEY: z.string().min(1),
  TWITTER_API_SECRET: z.string().min(1),
  TWITTER_ACCESS_TOKEN: z.string().min(1),
  TWITTER_ACCESS_SECRET: z.string().min(1),
  TWITTER_USERNAME: z.string().min(1),
  NEXT_PUBLIC_URL: z.string().url(),
  NEXT_PUBLIC_TWITTER_USERNAME: z.string().min(1),
})

const processEnv = {
  NODE_ENV: process.env.NODE_ENV,
  DATABASE_URL: process.env.DATABASE_URL,
  DIRECT_URL: process.env.DIRECT_URL,
  XAI_API_KEY: process.env.XAI_API_KEY,
  CRON_SECRET: process.env.CRON_SECRET,
  TWITTER_API_KEY: process.env.TWITTER_API_KEY,
  TWITTER_API_SECRET: process.env.TWITTER_API_SECRET,
  TWITTER_ACCESS_TOKEN: process.env.TWITTER_ACCESS_TOKEN,
  TWITTER_ACCESS_SECRET: process.env.TWITTER_ACCESS_SECRET,
  TWITTER_USERNAME: process.env.TWITTER_USERNAME,
  NEXT_PUBLIC_URL: process.env.NEXT_PUBLIC_URL,
  NEXT_PUBLIC_TWITTER_USERNAME: process.env.NEXT_PUBLIC_TWITTER_USERNAME
} as const

export const env = envSchema.parse(processEnv) 