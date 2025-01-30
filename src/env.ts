import { z } from "zod"

// Server-side environment variables
const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url().optional(),
  DIRECT_URL: z.string().url().optional(),
  
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
  CRON_SECRET: z.string().min(1).optional(),
  
  // Monitoring Auth
  MONITORING_USERNAME: z.string().min(1).optional(),
  MONITORING_PASSWORD_HASH: z.string().min(64).optional(), // SHA-256 hash
  MONITORING_AUTH_SALT: z.string().min(1).optional(),
  
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
}).superRefine((data, ctx) => {
  // Only enforce required variables on the server in production
  if (typeof window === "undefined" && data.NODE_ENV === "production") {
    if (!data.DATABASE_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "DATABASE_URL is required in production",
        path: ["DATABASE_URL"]
      });
    }
    if (!data.DIRECT_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "DIRECT_URL is required in production",
        path: ["DIRECT_URL"]
      });
    }
    if (!data.CRON_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "CRON_SECRET is required in production",
        path: ["CRON_SECRET"]
      });
    }
    if (!data.XAI_API_KEY && !data.ANTHROPIC_API_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Either XAI_API_KEY or ANTHROPIC_API_KEY is required in production",
        path: ["XAI_API_KEY"]
      });
    }
    // Require monitoring auth in production if monitoring is enabled
    if (data.MONITORING_ENABLED) {
      if (!data.MONITORING_USERNAME) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "MONITORING_USERNAME is required when monitoring is enabled in production",
          path: ["MONITORING_USERNAME"]
        });
      }
      if (!data.MONITORING_PASSWORD_HASH) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "MONITORING_PASSWORD_HASH is required when monitoring is enabled in production",
          path: ["MONITORING_PASSWORD_HASH"]
        });
      }
      if (!data.MONITORING_AUTH_SALT) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "MONITORING_AUTH_SALT is required when monitoring is enabled in production",
          path: ["MONITORING_AUTH_SALT"]
        });
      }
    }
  }
});

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
  
  // Monitoring Auth
  MONITORING_USERNAME: process.env.MONITORING_USERNAME,
  MONITORING_PASSWORD_HASH: process.env.MONITORING_PASSWORD_HASH,
  MONITORING_AUTH_SALT: process.env.MONITORING_AUTH_SALT,
  
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