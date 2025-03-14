# Codebase Summary

## Project Overview
This is a Next.js application that appears to be a personal showcase/portfolio site with multiple features including:
- Chat functionality (using AI models including Anthropic models)
- Twitter/X integration with enhanced caching and rate limiting
- Monitoring dashboard
- Blog section
- Projects section
- Image processing capabilities
- Scheduled tasks via cron jobs

## Tech Stack

### Core Technologies
- **Framework**: Next.js 14 with both App Router (primary) and Pages Router (legacy)
- **Language**: TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **UI Components**: Radix UI, Shadcn UI
- **Styling**: Tailwind CSS
- **AI Integration**: Anthropic and XAI APIs
- **Authentication**: NextAuth.js
- **Scheduled Tasks**: Vercel Cron Jobs

### Notable Dependencies
- Various Radix UI components (`@radix-ui/react-*`)
- Chart.js for data visualization
- Framer Motion for animations
- TanStack Table and Virtual for data display
- Twitter API integration (twitter-api-v2) with advanced caching and filtering

## Project Structure

### Key Directories
- `/src/app`: Main Next.js App Router routes and pages
- `/src/pages`: Legacy Pages Router (minimal usage - only `_document.tsx` and `_error.tsx`)
- `/src/components`: UI components (organized by feature)
  - `/src/components/ui`: Shadcn UI components
  - `/src/components/chat`: Chat-related components
  - `/src/components/monitoring`: Monitoring dashboard components
  - `/src/components/logs`: Logging components
- `/src/lib`: Utilities, services, and configuration
  - `/src/lib/server`: Server-specific utilities
  - Key files: `x-api.ts`, `tweet-storage.ts`, `tweet-utils.ts`, `url-utils.ts` (Twitter integration)
- `/src/middleware`: Request processing and authentication
  - `monitoring-auth.ts`: Authentication for monitoring dashboard
  - `cron.ts`: Cron job authentication middleware
  - `auth.ts`: General authentication middleware
- `/src/hooks`: Custom React hooks
- `/src/types`: TypeScript type definitions
- `/prisma`: Database schema and migrations

### API Routes
- `/api/auth`: Authentication endpoints
- `/api/chat`: Chat functionality endpoints
- `/api/twitter`: Twitter integration
- `/api/monitoring`: System monitoring
- `/api/cron`: Scheduled tasks
  - `/api/cron/fetch-tweets`: Regular tweet fetching
  - `/api/cron/rotate-logs`: Log maintenance
  - `/api/cron/expand-urls`: URL expansion for tweets
  - `/api/cron/recreate-entities`: Tweet entity management
- `/api/dev`: Development utilities
  - `/api/dev/reset-rate-limits`: Reset API rate limits
  - `/api/dev/test-cron`: Test cron job execution
- `/api/images` and `/api/upload`: Image processing

## Database Schema
The Prisma schema defines several models:
- `ChatSession`: Chat conversations
- `Message`: Individual chat messages
- `SystemPrompt`: AI system prompts with versioning
- `RateLimit`: Rate limiting for API endpoints
- Twitter-related models: `Tweet`, `TweetEntity`, `TweetCache`, `TwitterRateLimit`
- `TempImage`: Temporary storage for image data
- `Log` and `DatabaseMetric`: System monitoring data

## Recent Enhancements

### Twitter/X Integration
- Enhanced caching mechanism with selective tweet storage
- Relevance scoring for tech-related tweets
- Automatic URL expansion for embedded links
- Rate limit tracking and management
- Entity extraction and processing

### Scheduled Tasks
- Implemented cron functionality for regular maintenance
- Tweet fetching with intelligent filtering
- Log rotation for improved performance
- URL expansion for tweet entities
- Tweet entity management and optimization

### Development Tools
- Added developer endpoints for testing and maintenance
- Rate limit reset functionality
- Cron job testing utilities

## Peculiarities and Important Notes

### Hybrid Routing Pattern
- The application uses both App Router (primary) and Pages Router (minimal)
- Most functionality is in the App Router structure
- Basic document configuration is still handled in `/src/pages/_document.tsx`

### Middleware Configuration
- The main middleware (`src/middleware.ts`) is configured to specifically handle monitoring routes
- Additional middleware modules exist for cron jobs and authentication
- Middleware is applied to specific path patterns:
  - `/monitoring/:path*`
  - `/api/monitoring/:path*`
  - `/api/cron/:path*`

### Next.js Configuration
- Remote image sources are configured for Twitter images
- Experimental scroll restoration is enabled
- Use these settings when adding new image domains or experimental features

### Environment Variables
- Strictly typed using `@t3-oss/env-nextjs` and Zod
- Various keys required for AI services and Twitter API
- Monitoring authentication credentials
- Feature flags for enabling/disabling AI services and monitoring
- CRON_SECRET for securing scheduled tasks

### Authentication
- Custom authentication middleware for the monitoring dashboard
- Secured routes with proper authentication checks
- Token-based authentication for cron jobs

### Performance Monitoring
- Custom logging system with detailed metrics
- Database performance tracking
- Rate limiting implementation

### Rate Limiting
- Enhanced rate limiting for API endpoints to prevent abuse
- Twitter API rate limit tracking to avoid exceeding quotas
- Configurable limits per endpoint

### AI Integration
- Support for multiple AI models (Anthropic, XAI)
- Feature flags to enable/disable specific models
- Integration with AI SDK for advanced model features

### Image Processing
- Temporary image storage with expiration
- Image upload endpoints
- Next.js Image component configuration for external sources

### Twitter Integration
- Comprehensive Twitter API integration with advanced caching
- Tech relevance scoring for tweets
- URL expansion and entity extraction
- Rate limit tracking for Twitter API
- Selective tweet storage based on relevance

### Monitoring Dashboard
- Protected by authentication
- Visualizes performance metrics and logs
- Database metrics tracking

## Development Guidelines

1. **Environment Setup**
   - Ensure all necessary environment variables are set (see `.env.local.example`)
   - PostgreSQL database connection required
   - Set CRON_SECRET for scheduled tasks

2. **Database**
   - Run Prisma migrations before starting development
   - Use `prisma generate` to update the Prisma client after schema changes

3. **API Development**
   - Follow the established pattern for API routes
   - Implement proper error handling and rate limiting
   - Use the custom logger for consistent logging

4. **UI Components**
   - Follow the existing component structure
   - Use Shadcn UI and Radix UI for consistency
   - Style with Tailwind CSS

5. **Performance Considerations**
   - Monitor API performance with the built-in tools
   - Be mindful of database query performance
   - Consider caching strategies for external API calls

6. **Security**
   - Never expose API keys in client-side code
   - Use proper authentication for protected routes
   - Validate all user inputs
   - Protect cron job endpoints with proper authentication

7. **TypeScript Best Practices**
   - Use TypeScript for all code; prefer interfaces over types
   - Create proper type definitions in `/src/types`
   - Ensure proper type checking for all functions and components

8. **Component Structure**
   - Follow the established pattern for each component:
     - Exported component first
     - Subcomponents
     - Helper functions
     - Static content
     - TypeScript interfaces/types

9. **Folder Structure**
   - Use lowercase with dashes for directories (e.g., `components/auth-wizard`)
   - Group related components in feature-specific directories
   - Keep utility functions in appropriate `/lib` subdirectories

10. **Code Style**
    - Use functional and declarative programming patterns
    - Prefer iteration and modularization over code duplication
    - Use descriptive variable names with auxiliary verbs (e.g., isLoading, hasError)

11. **Scheduled Tasks**
    - Secure cron endpoints with proper authentication
    - Log execution details for debugging
    - Implement proper error handling for asynchronous operations 