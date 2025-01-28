import { z } from "zod"

// Server-side environment variables
const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url(),
  
  // AI Configuration
  XAI_API_KEY: z.string().min(1).optional(),
  XAI_MODEL_ID: z.string().default("grok-2-latest"),
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  ANTHROPIC_MODEL_ID: z.string().default("claude-3-sonnet-20240229"),
  
  // Rate Limiting
  RATE_LIMIT_MAX: z.number().min(1).default(100),
  RATE_LIMIT_WINDOW: z.number().min(1).default(60000), // 1 minute in ms
  RATE_LIMIT_TOKEN_MAX: z.number().min(1).default(200000), // Max tokens per window
  
  // Security
  CRON_SECRET: z.string().min(1),
  
  // Twitter Integration
  TWITTER_API_KEY: z.string().min(1).optional(),
  TWITTER_API_SECRET: z.string().min(1).optional(),
  TWITTER_ACCESS_TOKEN: z.string().min(1).optional(),
  TWITTER_ACCESS_SECRET: z.string().min(1).optional(),
  TWITTER_USERNAME: z.string().min(1).optional(),
  
  // Monitoring
  MONITORING_ENABLED: z.boolean().default(false),
  ERROR_TRACKING_DSN: z.string().url().optional(),
  PERFORMANCE_MONITORING_URL: z.string().url().optional(),
}).refine(
  (data) => {
    // Only enforce required variables on the server in production
    if (typeof window === "undefined" && data.NODE_ENV === "production") {
      const hasDatabase = !!(data.DATABASE_URL && data.DIRECT_URL);
      const hasAIConfig = !!(data.XAI_API_KEY || data.ANTHROPIC_API_KEY);
      const hasSecurity = !!data.CRON_SECRET;
      
      return hasDatabase && hasAIConfig && hasSecurity;
    }
    return true;
  },
  {
    message: "Required environment variables missing in production server environment"
  }
);

// Client-side environment variables
const clientSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_TWITTER_USERNAME: z.string().min(1).optional(),
  NEXT_PUBLIC_MONITORING_ENABLED: z.boolean().default(false),
});

// Process env object with all variables
const processEnv = {
  NODE_ENV: process.env.NODE_ENV,
  DATABASE_URL: process.env.DATABASE_URL,
  DIRECT_URL: process.env.DIRECT_URL,
  
  // AI Configuration
  XAI_API_KEY: process.env.XAI_API_KEY,
  XAI_MODEL_ID: process.env.XAI_MODEL_ID,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  ANTHROPIC_MODEL_ID: process.env.ANTHROPIC_MODEL_ID,
  
  // Rate Limiting
  RATE_LIMIT_MAX: process.env.RATE_LIMIT_MAX ? parseInt(process.env.RATE_LIMIT_MAX) : undefined,
  RATE_LIMIT_WINDOW: process.env.RATE_LIMIT_WINDOW ? parseInt(process.env.RATE_LIMIT_WINDOW) : undefined,
  RATE_LIMIT_TOKEN_MAX: process.env.RATE_LIMIT_TOKEN_MAX ? parseInt(process.env.RATE_LIMIT_TOKEN_MAX) : undefined,
  
  // Security
  CRON_SECRET: process.env.CRON_SECRET,
  
  // Twitter Integration
  TWITTER_API_KEY: process.env.TWITTER_API_KEY,
  TWITTER_API_SECRET: process.env.TWITTER_API_SECRET,
  TWITTER_ACCESS_TOKEN: process.env.TWITTER_ACCESS_TOKEN,
  TWITTER_ACCESS_SECRET: process.env.TWITTER_ACCESS_SECRET,
  TWITTER_USERNAME: process.env.TWITTER_USERNAME,
  
  // Monitoring
  MONITORING_ENABLED: process.env.MONITORING_ENABLED === "true",
  ERROR_TRACKING_DSN: process.env.ERROR_TRACKING_DSN,
  PERFORMANCE_MONITORING_URL: process.env.PERFORMANCE_MONITORING_URL,
  
  // Public Variables
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_TWITTER_USERNAME: process.env.NEXT_PUBLIC_TWITTER_USERNAME,
  NEXT_PUBLIC_MONITORING_ENABLED: process.env.NEXT_PUBLIC_MONITORING_ENABLED === "true",
} as const;

// Create validated env object
const serverEnv = serverSchema.parse(processEnv);
const clientEnv = clientSchema.parse(processEnv);

export const env = {
  ...serverEnv,
  ...clientEnv,
} as const; 