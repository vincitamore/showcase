import { z } from "zod"

// Server-side environment variables
const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url(),
  XAI_API_KEY: z.string().min(1).optional(),
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  CRON_SECRET: z.string().min(1),
  TWITTER_API_KEY: z.string().min(1).optional(),
  TWITTER_API_SECRET: z.string().min(1).optional(),
  TWITTER_ACCESS_TOKEN: z.string().min(1).optional(),
  TWITTER_ACCESS_SECRET: z.string().min(1).optional(),
  TWITTER_USERNAME: z.string().min(1).optional(),
});

// Client-side environment variables
const clientEnvSchema = z.object({
  NEXT_PUBLIC_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_TWITTER_USERNAME: z.string().min(1).optional(),
});

// Combined schema that's different for server and client
const envSchema = typeof window === "undefined" 
  ? serverEnvSchema.merge(clientEnvSchema)
  : clientEnvSchema;

const processEnv = {
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
  NEXT_PUBLIC_TWITTER_USERNAME: process.env.NEXT_PUBLIC_TWITTER_USERNAME
} as const;

// Only validate what's needed based on environment
const env = envSchema.parse(
  typeof window === "undefined"
    ? processEnv // Server-side: validate all env vars
    : {          // Client-side: only validate NEXT_PUBLIC_ vars
        NEXT_PUBLIC_URL: processEnv.NEXT_PUBLIC_URL,
        NEXT_PUBLIC_TWITTER_USERNAME: processEnv.NEXT_PUBLIC_TWITTER_USERNAME,
      }
);

export { env } 