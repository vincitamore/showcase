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
- Built with performance and accessibility in mind
- Automated deployment via GitHub Actions and Vercel

## Tech Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui
- **Runtime**: Bun
- **Animations**: CSS transforms & transitions
- **Theme Management**: next-themes
- **Email**: Nodemailer with SMTP
- **Analytics**: Vercel Analytics

## Project Structure

```
src/
├── app/              # Next.js app directory
│   ├── api/         # API routes for form handling
│   └── og/          # OpenGraph image generation
├── components/       # React components
│   ├── ui/          # shadcn/ui components
│   └── ...          # Custom components
├── hooks/           # Custom React hooks
└── lib/             # Utility functions
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

# Edit .env.local with your SMTP credentials:
SMTP_HOST=your-smtp-host
SMTP_PORT=your-smtp-port
SMTP_USER=your-smtp-username
SMTP_PASS=your-smtp-password
```

   For serverless deployment (e.g., Vercel):
   - Go to your project settings in the deployment platform
   - Add the environment variables in the Environment Variables section
   - Include all variables from `.env.local`
   - Deploy your project to apply the changes

4. Run the development server:
```bash
bun run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

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

4. **Theme & Styling**
   - Modify colors in `src/app/globals.css`
   - Adjust component styles in `src/components/ui/`
   - Update fonts and typography settings

5. **Email Setup**
   - Configure SMTP settings in `.env.local`
   - Update email templates in `src/app/api/contact/route.ts`
   - Test form submission with your email service

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
   - Modern, clean design with consistent theming
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

### In Progress
- Project filtering and sorting
- Performance optimization
- SEO enhancements

### Upcoming
- Blog section integration
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
