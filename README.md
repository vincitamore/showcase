# Portfolio Showcase

A modern, interactive portfolio site built with Next.js, TypeScript, and shadcn/ui. This project serves as both a showcase of work and a demonstration of modern web development practices.

## Features

- Modern UI with shadcn/ui components and Radix primitives
- Theme system with Light/Dark/Dim modes
- Interactive 3D card effects with smooth animations
- Fully responsive design with mobile-first approach
- Smooth scroll navigation with section highlighting
- Dynamic project details modal with image galleries
- Professional journey timeline with animations
- Real-time form validation and submission
- X (Twitter) Integration with OAuth2 authentication
- Advanced AI chat interface powered by:
  - xAI Grok-2
  - Anthropic Claude 3.5 (Sonnet, Haiku)
  - Anthropic Claude 3 Opus
  - Features:
    - Streaming responses
    - Model switching
    - Message actions and reactions
    - Quote functionality
    - Export options
    - Markdown rendering with syntax highlighting
    - Image understanding (Claude models)(*coming soon*)
- Built with performance and accessibility in mind.
- Automated deployment via GitHub Actions
- PostgreSQL database with optimized queries
- Rate-limited API endpoints with fallback mechanisms
- Temporary image storage with automatic cleanup
- Advanced API Infrastructure:
  - Comprehensive structured logging across all routes
  - Centralized error handling with detailed context
  - Rate limiting with database-backed tracking
  - Health monitoring with service checks
  - Performance tracking and metrics
  - Type-safe route implementations
  - Secure file handling with automatic cleanup

## Tech Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **UI Components**: 
  - shadcn/ui with Radix primitives
  - Tailwind CSS for styling
  - Framer Motion for animations
- **AI Integration**: 
  - xAI SDK with Grok-2
  - Anthropic SDK with Claude models
  - AI SDK for streaming responses
- **State Management**:
  - React Server Components
  - URL state with nuqs
- **Authentication**: Next-Auth with OAuth2
- **Email**: Nodemailer with SMTP
- **Social**: Twitter API v2
- **Media**: Sharp for image optimization
- **Development**:
  - ESLint for code quality
  - Prettier for formatting
  - TypeScript for type safety
- **Analytics**: Vercel Analytics
- **Cron Jobs**: Vercel Cron
- **Rate Limiting**: Database-backed with Prisma
- **Monitoring & Logging**:
  - Real-time performance dashboard with:
    - API request metrics and response times
    - Route performance analysis
    - Database query monitoring
    - External service tracking
    - Memory usage statistics
    - Log level distribution
  - Structured logging with metadata
  - Performance metrics tracking
  - Service health monitoring
  - Error tracking and reporting
  - Rate limit monitoring
  - Secure authentication for monitoring access

## Project Structure

```
src/
├── app/                    # Next.js app directory
│   ├── api/               # API routes with structured logging
│   │   ├── chat/         # Chat system endpoints
│   │   ├── twitter/      # Twitter integration endpoints
│   │   ├── images/       # Image handling endpoints
│   │   ├── monitoring/   # Monitoring system endpoints
│   │   │   ├── auth/     # Authentication endpoints
│   │   │   ├── logs/     # Log retrieval endpoints
│   │   │   └── metrics/  # Performance metrics endpoints
│   │   ├── health/       # Health check endpoint
│   │   └── contact/      # Contact form endpoint
│   ├── monitoring/       # Monitoring dashboard pages
│   │   ├── components/   # Monitoring-specific components
│   │   │   └── metrics/  # Individual metric visualizations
│   │   ├── login/        # Monitoring auth pages
│   │   └── logs/         # Log viewer pages
│   ├── (auth)/           # Authentication related pages
│   └── (main)/           # Main application pages
├── components/            # React components
│   ├── ui/               # shadcn/ui components
│   ├── chat/             # Chat interface components
│   ├── monitoring/       # Shared monitoring components
│   │   ├── metrics/      # Metric visualization components
│   │   └── logs/        # Log viewing components
│   └── ...               # Feature-specific components
├── hooks/                # Custom React hooks
├── lib/                  # Utility functions and configs
│   ├── chat-config.ts    # Chat system configuration
│   ├── utils.ts          # General utilities
│   ├── logger.ts         # Structured logging utility
│   ├── api-error.ts      # API error handling
│   ├── rate-limit.ts     # Rate limiting implementation
│   ├── metrics.ts        # Metrics collection utilities
│   ├── chart-config.ts   # Chart.js configuration
│   └── ...               # Other utilities
├── middleware/           # Edge middleware
│   ├── auth.ts           # Authentication middleware
│   ├── monitoring-auth.ts # Monitoring auth middleware
│   └── ...               # Other middleware
├── types/                # TypeScript type definitions
├── scripts/              # Utility scripts
│   ├── rotate-logs.ts    # Log rotation script
│   ├── clear-logs.ts     # Log cleanup script
│   └── generate-monitoring-hash.ts # Auth setup script
└── env.ts               # Environment variable validation
```

Key directories and their purposes:

- `app/`: Next.js App Router pages and API routes
  - `api/monitoring/`: Monitoring system API endpoints
  - `monitoring/`: Monitoring dashboard pages and components
- `components/`: Reusable React components
  - `ui/`: shadcn/ui component library
  - `monitoring/`: Monitoring-specific components
  - Feature-specific components (blog, projects, etc.)
- `lib/`: Utility functions and configurations
  - `logger.ts`: Structured logging system
  - `metrics.ts`: Performance metrics collection
  - `chart-config.ts`: Chart.js configuration
- `middleware/`: Edge middleware for auth and routing
- `scripts/`: Utility scripts for maintenance tasks
- `types/`: TypeScript type definitions

## Getting Started

1. Clone the repository:
```bash
git clone https://github.com/vincitamore/showcase.git
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
# Copy the example environment file
cp .env.local.example .env.local

# Edit .env.local with your credentials:
# Core Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000 # Change in production

# Database Configuration
DATABASE_URL=your-postgres-url           # Main connection string
DIRECT_URL=your-direct-db-url           # For Prisma direct access

# AI Configuration
XAI_API_KEY=your-xai-api-key            # For Grok-2 chat functionality
XAI_MODEL_ID=grok-2-latest              # Model identifier
ANTHROPIC_API_KEY=your-anthropic-key    # For Claude models
ANTHROPIC_MODEL_ID=claude-3-sonnet      # Default model

# SMTP Configuration
SMTP_HOST=your-smtp-host
SMTP_PORT=your-smtp-port
SMTP_USER=your-smtp-username
SMTP_PASS=your-smtp-password

# X (Twitter) API Configuration
TWITTER_API_KEY=your-api-key
TWITTER_API_SECRET=your-api-secret
TWITTER_CLIENT_ID=your-oauth2-client-id
TWITTER_USERNAME=your-username-without-@
NEXT_PUBLIC_TWITTER_USERNAME=your-username-without-@

# Rate Limiting Configuration
RATE_LIMIT_MAX=100                      # Max requests per window
RATE_LIMIT_WINDOW=3600                  # Window size in seconds

# Monitoring Configuration
MONITORING_ENABLED=true                 # Enable performance monitoring
MONITORING_USERNAME=your-username       # Dashboard access username
MONITORING_PASSWORD_HASH=your-hash      # SHA-256 hash of password
MONITORING_AUTH_SALT=your-salt         # Salt for password hashing
```

4. Initialize the database:
```bash
npx prisma generate
npx prisma db push
```

5. Run the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Customization Guide

1. **Personal Information**
   - Update `src/app/page.tsx` with your title, motto, and bio
   - Modify contact links in the footer with your social media
   - Replace favicon and OpenGraph images in `public/`

2. **Projects Section**
   - Edit `src/components/projects-section.tsx` to add your projects
   - Place project images in `public/images/projects/`
   - Update project descriptions, links, and technologies used

3. **Skills & Experience**
   - Customize skill categories in `src/components/skills-grid.tsx`
   - Update your professional timeline in `src/components/experience-timeline.tsx`
   - Adjust skill icons and descriptions to match your expertise

4. **Blog Section**
   - Configure X API credentials in `.env.local`
   - Customize the tweet display in `src/components/blog-section.tsx`
   - Adjust authentication settings in X Developer Portal
   - Modify post composer styling and behavior

5. **Theme & Styling**
   - Modify colors in `src/app/globals.css`
   - Adjust component styles in `src/components/ui/`
   - Update fonts and typography settings

6. **Email Setup**
   - Configure SMTP settings in `.env.local`
   - Update email templates in `src/app/api/contact/route.ts`
   - Test form submission with your email service

## Chat System Features

The site includes an advanced AI-powered chat system with multi-model support:

1. **Model Integration**
   - xAI Grok-2 for general queries
   - Claude 3.5 Sonnet for balanced performance
   - Claude 3.5 Haiku for fast responses
   - Claude 3 Opus for complex tasks
   - Per-model history tracking
   - Provider-specific optimizations

2. **Interactive Interface**
   - Animated chat input with typewriter effect
   - Real-time streaming responses
   - Model switching capability
   - Message actions and reactions
   - Quote and export functionality
   - Markdown rendering with syntax highlighting
   - Image understanding (Claude models)

3. **Performance**
   - Streaming responses for fast interaction
   - Optimized database queries
   - Proper error boundaries
   - Fallback mechanisms

4. **Security**
   - Rate limiting per IP
   - Input validation
   - Secure environment variable handling
   - Production-ready middleware

## Blog Section Features

The blog section integrates with X (formerly Twitter) to provide:

1. **Authentication**
   - Secure OAuth 2.0 authentication flow
   - Session management with httpOnly cookies
   - Automatic token refresh handling
   - CSRF protection with state verification

2. **Content Display**
   - Real-time tweet fetching
   - Engagement metrics (likes, replies, retweets)
   - Formatted timestamps
   - Responsive card layout

3. **Post Composer**
   - Authenticated posting to X
   - Real-time validation
   - Loading states and error handling
   - Success notifications

4. **Security**
   - Server-side token management
   - Protected API endpoints
   - Secure cookie handling
   - Rate limiting and validation

## Monitoring Dashboard

The application includes a comprehensive monitoring suite with real-time metrics:

1. **Real-time Metrics**
   - API request tracking with response times
   - Route performance analysis with success/error rates
   - Database query monitoring with performance stats
   - External service call tracking
   - Memory usage statistics
   - Log level distribution analytics

2. **Security**
   - Password-protected dashboard access
   - Secure cookie-based authentication
   - Environment-based access control
   - Rate limiting on auth endpoints

3. **Features**
   - Real-time data updates via SSE
   - Interactive charts and graphs
   - Filterable log viewer
   - Performance trend analysis
   - Error rate monitoring
   - Resource usage tracking

4. **Implementation**
   - Server-sent events for live updates
   - Prisma query event tracking
   - Structured logging system
   - Metric aggregation and analysis
   - Chart.js for data visualization
   - Responsive dashboard layout


## API Features

1. **Error Handling**
   - Centralized error handling system
   - Type-safe error responses
   - Detailed error context
   - Fallback mechanisms
   - Rate limit protection

2. **Logging System**
   - Structured logging with metadata
   - Request/response cycle tracking
   - Operation step tracking
   - Performance metrics collection
   - Error context enrichment

3. **Security**
   - Rate limiting per route
   - Input validation
   - Secure file handling
   - Cookie security
   - CSRF protection

4. **Monitoring**
   - Health check endpoint
   - Service status tracking
   - Performance metrics
   - Error rate monitoring
   - Resource usage tracking

---

## Project Goals

1. **Visual Appeal**
   - Modern, clean designs with consistent theming
   - Smooth animations and transitions
   - Interactive elements that enhance UX
   - Responsive image modals and galleries

2. **Technical Excellence**
   - Clean, maintainable code with TypeScript
   - Server-side email handling with rate limiting
   - Optimal performance and accessibility
   - SEO optimization with metadata

3. **Showcase Sections**
   - Interactive project cards with image galleries
   - Skills visualization with 3D effects
   - Professional experience timeline
   - Contact form with real-time validation

4. **Responsive Design**
   - Mobile-first approach
   - Seamless experience across all devices
   - Adaptive navigation with mobile menu
   - Optimized images and animations
   
## Development Roadmap

### Completed
- Project setup with Next.js and TypeScript
- Implementation of shadcn/ui components
- Theme system with Light/Dark/Dim modes
- Responsive navigation with mobile menu
- 3D card components with hover effects
- Smooth scroll behavior
- Skills section with interactive grid
- Professional journey timeline
- Contact form with email integration
- Project details modal with image galleries
- X integration with OAuth2 authentication
- Blog section with post composer
- xAI Grok-2 chat integration with:
  - Streaming responses
  - Animated typewriter input
  - Model switching
  - Markdown rendering
- Turso database setup
- Edge middleware for auth and rate limiting
- Blob storage integration
- Error handling and monitoring:
  - Centralized API error handling
  - Error boundaries for all components
  - Structured logging implementation
  - Rate limiting with database tracking
  - Health check endpoint with monitoring
  - Performance metric collection
  - Type-safe route implementations
- API Improvements:
  - Enhanced Twitter integration
  - Secure image handling
  - Contact form validation
  - Health monitoring system
  - Cron job management
  - Database-backed rate limiting

### In Progress
- Performance monitoring:
  - Request duration tracking
  - Memory usage monitoring
  - Database query timing
  - External service latency
- Resource usage tracking:
  - Memory consumption
  - CPU utilization
  - Database connection pool
  - Rate limit status
- Error tracking:
  - Error rates by route
  - Error types distribution
  - Response time degradation
  - Failed requests tracking

### Upcoming
- Monitoring dashboard:
  - Request metrics visualization
  - Error rate tracking
  - Performance metrics display
  - Rate limit status
- Enhanced logging features:
  - Log aggregation
  - Performance analysis
  - Error pattern detection
  - Automated alerts
- Advanced chat features:
  - Multi-model support
  - Chat history management
  - Export functionality
- Enhanced blog features:
  - Rich text editor
  - Media embedding
  - Draft system
- Internationalization support
- Advanced image optimization
- Case studies for major projects

---

## Acknowledgments

- [shadcn/ui](https://ui.shadcn.com/) for the beautiful component system
- [Tailwind CSS](https://tailwindcss.com/) for the utility-first CSS framework
- [Next.js](https://nextjs.org/) for the React framework
- [Vercel](https://vercel.com) for hosting and analytics
- [Cursor](https://cursor.com/) for the AI-powered development environment
- GitHub Actions for automated cross-repository workflow management

## License

MIT License

Copyright (c) 2024 Vincit Amore

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
