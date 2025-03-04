"use client"

import { useState } from "react"
import { Card3D } from "@/components/ui/card"
import { ImageModal } from "@/components/image-modal"
import { ProjectDetailsModal } from "@/components/project-details-modal"
import { Carousel } from "@/components/ui/carousel"
import { cn } from "@/lib/utils"

const projects = [
  {
    title: "Modern Portfolio Showcase",
    description: "A cutting-edge, open source portfolio platform built with Next.js 14, featuring AI-powered chat, comprehensive monitoring suite, Twitter integration, and interactive 3D components. Demonstrates modern web development practices with a focus on performance, monitoring, and user experience.",
    tags: [
      "Next.js 14",
      "TypeScript",
      "Tailwind CSS",
      "Shadcn UI",
      "PostgreSQL",
      "xAI",
      "Anthropic",
      "Chart.js",
      "SSE"
    ],
    highlights: [
      "Real-time monitoring dashboard with SSE updates",
      "Performance metrics and structured logging system",
      "AI-powered chat with xAI and Anthropic integrations",
      "Real-time Twitter feed with OAuth and caching",
      "Interactive 3D card effects and animations",
      "Theme system with Light/Dark/Dim modes",
      "Responsive design with mobile-first approach",
      "PostgreSQL database with Prisma ORM",
      "Completely open source on GitHub"
    ],
    images: [
      "/images/projects/portfolio/home-dark.png",
      "/images/projects/portfolio/chat-system.png",
      "/images/projects/portfolio/blog-section.png",
      "/images/projects/portfolio/projects-grid.png"
    ],
    link: "https://github.com/vincitamore/showcase"
  },
  {
    title: "Municipal Outage Management Suite",
    description: "An enterprise-grade system for real-time utility outage tracking and response coordination. Streamlines emergency response with interactive mapping and crew management capabilities.",
    tags: [
      "Next.js 14",
      "TypeScript",
      "Tailwind CSS",
      "Microsoft OAuth",
      "Prisma",
      "Google Maps"
    ],
    highlights: [
      "Real-time outage visualization and heatmaps",
      "Automated crew dispatch and tracking",
      "Field-optimized mobile interface",
      "Advanced analytics and reporting system"
    ],
    images: [
      "/images/projects/outage-system/dashboard.png",
      "/images/projects/outage-system/active-reports.png"
    ],
    link: "#"
  },
  {
    title: "Agricultural Operations Platform",
    description: "A modern farm management solution that streamlines agricultural operations through intuitive field tracking, expense management, and inventory control systems.",
    tags: [
      "Next.js 14",
      "React",
      "Tailwind CSS",
      "PostgreSQL",
      "Prisma",
      "NextAuth.js"
    ],
    highlights: [
      "Real-time farm metrics dashboard",
      "Integrated field and expense tracking",
      "Smart inventory management system",
      "Comprehensive reporting suite",
      "Role-based access control",
      "Field-ready mobile interface"
    ],
    images: [
      "/images/projects/farm-system/dashboard-overview.png",
      "/images/projects/farm-system/field-management.png"
    ],
    link: "#"
  },
  {
    title: "AI-Powered PDF Scanner App",
    description: "A sophisticated document processing solution that combines cutting-edge AI technology with a modern, responsive user interface to streamline invoice management and requisition form generation. This full-stack application leverages machine learning for intelligent document analysis while providing an intuitive user experience.",
    tags: [
      "Next.js 15",
      "React 19",
      "TypeScript",
      "Tailwind CSS",
      "FastAPI",
      "Ollama",
      "Python",
      "Machine Learning",
      "PDF.js",
      "Asynchronous Processing",
      "Shadcn UI",
      "Radix UI"
    ],
    highlights: [
      "Locally run AI architecture (llama3.2-vision) with zero cloud dependencies",
      "Adaptive text recognition for inconsistently formatted documents",
      "90% reduction in invoice processing time",
      "Intelligent error recovery with fallback extraction methods",
      "Multi-document batch processing with smart data consolidation",
      "Side-by-side PDF comparison with real-time validation",
      "Automatic recalculation of financial data with integrity checks",
      "Sophisticated multi-stage processing pipeline with 98% accuracy"
    ],
    images: [
      "/images/projects/pdf-scanner/dashboard-view.png",
      "/images/projects/pdf-scanner/document-extraction.png",
      "/images/projects/pdf-scanner/form-editor.png",
      "/images/projects/pdf-scanner/generated-form.png"
    ],
    link: "#"
  }
]

const ProjectsSection = () => {
  const [selectedProject, setSelectedProject] = useState<typeof projects[0] | null>(null)

  return (
    <section id="projects" className="container relative mx-auto px-4 py-16 scroll-mt-16">
      <h2 className="mb-16 text-center text-3xl font-bold tracking-tight sm:text-4xl">
        Featured Projects
      </h2>
      <Carousel 
        className={cn(
          "w-full overflow-visible mx-auto pb-4",
          "overflow-visible [&_.embla__button]:bg-transparent [&_.embla__button]:hover:bg-transparent [&_.embla__button]:static",
          "[&_.embla__button--prev]:-left-4",
          "[&_.embla__button--next]:-right-4"
        )}
        opts={{ 
          loop: true, 
          align: "center",
          containScroll: "trimSnaps",
          dragFree: false
        }}
      >
        {projects.map((project, index) => (
          <Card3D
            key={index}
            className={cn(
              "group cursor-pointer",
              "p-4 sm:p-5",
              "mx-4",
              "w-[calc(100vw-6rem)] sm:w-[calc(75vw-4rem)] md:w-[calc(66vw-4rem)] lg:w-[42rem]",
              "max-w-[42rem]",
              "backdrop-blur-sm bg-background/10 hover:bg-background/20 transition-all duration-300"
            )}
            containerClassName="min-h-[16rem] sm:min-h-[18rem] rounded-lg sm:rounded-xl"
          >
            <div className="flex h-full flex-col justify-between">
              <div>
                <h3 className="mb-2 text-lg sm:text-xl font-semibold tracking-tight">{project.title}</h3>
                <p className="mb-3 text-sm text-muted-foreground leading-relaxed">{project.description}</p>
                {project.highlights && (
                  <ul className="mb-3 space-y-1">
                    {project.highlights.map((highlight, highlightIndex) => (
                      <li 
                        key={highlightIndex}
                        className="text-xs sm:text-sm text-muted-foreground/90 before:mr-2 before:content-['•'] before:text-primary"
                      >
                        {highlight}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {project.tags.map((tag, tagIndex) => (
                    <span
                      key={tagIndex}
                      className="rounded-full bg-primary/5 px-2 py-0.5 text-xs font-medium text-primary ring-1 ring-inset ring-primary/10 transition-colors group-hover:bg-primary/10"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                {project.images && (
                  <div className="mb-3 grid gap-2 grid-cols-2">
                    {project.images.map((image, imageIndex) => (
                      <ImageModal
                        key={imageIndex}
                        src={image}
                        alt={`${project.title} screenshot ${imageIndex + 1}`}
                        className="aspect-video rounded-md sm:rounded-lg ring-1 ring-foreground/5 transition-all duration-300 group-hover:ring-foreground/10"
                      />
                    ))}
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setSelectedProject(project)}
                    className="inline-flex items-center text-xs sm:text-sm font-medium text-primary transition-colors hover:text-primary/80"
                  >
                    Learn more <span className="ml-1 transition-transform group-hover:translate-x-0.5">→</span>
                  </button>
                  {project.link && project.link.includes('github.com') && (
                    <a
                      href={project.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-1 text-xs sm:text-sm font-medium text-primary bg-primary/5 hover:bg-primary/10 rounded-full ring-1 ring-primary/10 transition-all duration-300"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                      </svg>
                      View on GitHub
                    </a>
                  )}
                </div>
              </div>
            </div>
          </Card3D>
        ))}
      </Carousel>

      {selectedProject && (
        <ProjectDetailsModal
          project={selectedProject}
          open={!!selectedProject}
          onOpenChange={(open) => !open && setSelectedProject(null)}
        />
      )}
    </section>
  )
}

export default ProjectsSection 