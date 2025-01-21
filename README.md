# Portfolio Showcase

A modern, interactive portfolio site built with Next.js, TypeScript, and shadcn/ui. This project serves as both a showcase of work and a demonstration of modern web development practices.

## Features

- Modern UI with shadcn/ui components
- Theme system with Light/Dark/Dim modes
- Interactive 3D card effects with smooth animations
- Fully responsive design with mobile-first approach
- Smooth scroll navigation with section highlighting
- Dynamic image modals for project showcases
- Real-time form validation and submission
- X (Twitter) Integration with OAuth authentication and cron-based tweet fetching
- Built with performance and accessibility in mind
- Automated deployment via GitHub Actions and Vercel
- Blob storage for tweet caching and management
- Rate-limited API endpoints with fallback mechanisms

## Tech Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui
- **Runtime**: Node.js
- **Animations**: CSS transforms & transitions
- **Theme Management**: next-themes
- **Email**: Nodemailer with SMTP
- **Social**: X (Twitter) API v2
- **Analytics**: Vercel Analytics
- **Storage**: Vercel Blob Storage
- **Cron Jobs**: Vercel Cron
- **Rate Limiting**: Vercel Edge Config

## Project Structure

```
src/
├── app/              # Next.js app directory
│   ├── api/         # API routes for form handling and X auth
│   └── og/          # OpenGraph image generation
├── components/       # React components
│   ├── ui/          # shadcn/ui components
│   └── ...          # Custom components
├── hooks/           # Custom React hooks
├── lib/             # Utility functions and API clients
└── middleware.ts    # Edge middleware for auth and rate limiting
```

## Getting Started

1. Clone the repository:
```bash
git clone https://github.com/vincitamore/showcase.git
```

2. Install dependencies:
```bash
bun install
```

3. Set up environment variables:
```bash
# Copy the example environment file
cp .env.local.example .env.local

# Edit .env.local with your credentials:
# Core Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000 # Change in production
CRON_SECRET=your-cron-secret              # For authenticating cron jobs

# SMTP Configuration
SMTP_HOST=your-smtp-host
SMTP_PORT=your-smtp-port
SMTP_USER=your-smtp-username
SMTP_PASS=your-smtp-password

# X (Twitter) API Configuration
TWITTER_API_KEY=your-api-key
TWITTER_API_SECRET=your-api-secret
TWITTER_USERNAME=your-username-without-@
NEXT_PUBLIC_TWITTER_USERNAME=your-username-without-@
```

4. Configure X API Access:
   - Visit the [X Developer Portal](https://developer.twitter.com/en/portal/dashboard)
   - Create a new project and app
   - Enable OAuth 2.0 and set up authentication
   - Add your callback URL: `{NEXT_PUBLIC_APP_URL}/api/auth/x/callback`
   - Get your API key and secret
   - Configure User authentication settings:
     - Enable OAuth 2.0
     - Set App permissions to Read and Write
     - Add the callback URL
     - Request email from users (optional)

5. Run the development server:
```bash
bun run dev
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

## OpenGraph Preview

The site includes a built-in OpenGraph image preview tool at `/og`. This page allows you to:
1. Preview your social sharing card in Light/Dark/Dim modes
2. Customize the image in `src/components/og-image.tsx`
3. Take a screenshot for social media platforms

To generate your preview image:
1. Visit `http://localhost:3000/og` in development
2. Use browser dev tools to set viewport to 1200x630px (standard OG dimensions)
3. Switch between themes to check appearance
4. Use browser screenshot or a tool like [screely.com](https://www.screely.com) to capture

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
- Experience timeline
- Contact form with email integration
- Project image modals
- OpenGraph image generation
- Analytics integration
- X integration with OAuth authentication
- Blog section with post composer

### In Progress
- Project filtering and sorting
- Performance optimization
- SEO enhancements

### Upcoming
- Case studies for major projects
- Advanced image optimization
- Internationalization support

## License

MIT License

Copyright (c) 2024 Vincit Amore

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## Acknowledgments

- [shadcn/ui](https://ui.shadcn.com/) for the beautiful component system
- [Tailwind CSS](https://tailwindcss.com/) for the utility-first CSS framework
- [Next.js](https://nextjs.org/) for the React framework
- [Vercel](https://vercel.com) for hosting and analytics
- [Cursor](https://cursor.com/) for the AI-powered development environment
- GitHub Actions for automated cross-repository workflow management
