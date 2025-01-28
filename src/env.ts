import { z } from "zod"

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url().optional(),
  DIRECT_URL: z.string().url().optional(),
  XAI_API_KEY: z.string().min(1).optional(),
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  CRON_SECRET: z.string().min(1).optional(),
  TWITTER_API_KEY: z.string().min(1).optional(),
  TWITTER_API_SECRET: z.string().min(1).optional(),
  TWITTER_ACCESS_TOKEN: z.string().min(1).optional(),
  TWITTER_ACCESS_SECRET: z.string().min(1).optional(),
  TWITTER_USERNAME: z.string().min(1).optional(),
  NEXT_PUBLIC_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_TWITTER_USERNAME: z.string().min(1).optional(),
}).refine(
  (data) => {
    // In production, require certain variables
    if (data.NODE_ENV === "production") {
      console.log('[ENV Validation] Checking required environment variables:', {
        hasDatabase: !!data.DATABASE_URL,
        hasDirect: !!data.DIRECT_URL,
        hasXAI: !!data.XAI_API_KEY,
        hasAnthropic: !!data.ANTHROPIC_API_KEY,
        hasCron: !!data.CRON_SECRET,
        nodeEnv: data.NODE_ENV
      });
      
      const isValid = !!(data.DATABASE_URL && data.DIRECT_URL && 
        (data.XAI_API_KEY || data.ANTHROPIC_API_KEY) && data.CRON_SECRET);
      
      if (!isValid) {
        console.error('[ENV Validation] Missing required environment variables:', {
          missingDatabase: !data.DATABASE_URL,
          missingDirect: !data.DIRECT_URL,
          missingBothAI: !data.XAI_API_KEY && !data.ANTHROPIC_API_KEY,
          missingCron: !data.CRON_SECRET
        });
      }
      
      return isValid;
    }
    return true;
  },
  {
    message: "Required environment variables missing in production"
  }
)

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
} as const

// Add debug logging for process.env values
console.log('[ENV Debug] Environment variables present:', {
  NODE_ENV: !!process.env.NODE_ENV,
  DATABASE_URL: !!process.env.DATABASE_URL,
  DIRECT_URL: !!process.env.DIRECT_URL,
  XAI_API_KEY: !!process.env.XAI_API_KEY,
  ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
  CRON_SECRET: !!process.env.CRON_SECRET,
});

export const env = envSchema.parse(processEnv) 