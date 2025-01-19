"use client"

import * as React from "react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { ImageModal } from "@/components/image-modal"

interface ProjectDetailsModalProps {
  project: {
    title: string
    description: string
    tags: string[]
    highlights?: string[]
    images?: string[]
    link: string
  }
  open: boolean
  onOpenChange: (open: boolean) => void
}

const getTechnicalDetails = (title: string) => {
  if (title === "Municipal Outage Management Suite") {
    return {
      overview: "This enterprise solution leverages modern web technologies with a focus on real-time data processing and geospatial integration.",
      details: [
        "Built with TypeScript and Next.js 14 for type-safe, full-stack development",
        "Real-time WebSocket integration for live outage updates and crew tracking",
        "Complex geospatial data handling with Google Maps API integration",
        "Enterprise authentication using Microsoft OAuth and role-based access control",
        "Optimized for high-concurrency during emergency situations"
      ]
    }
  }
  return {
    overview: "This platform demonstrates modern agricultural technology integration with a focus on data management and offline capabilities.",
    details: [
      "Next.js 14 app router with server components for optimal performance",
      "PostgreSQL with Prisma for complex relational data modeling",
      "Progressive Web App features for offline field operation support",
      "Secure multi-tenant architecture with NextAuth.js",
      "Advanced caching strategies for rural area optimization"
    ]
  }
}

export function ProjectDetailsModal({ project, open, onOpenChange }: ProjectDetailsModalProps) {
  const technicalDetails = getTechnicalDetails(project.title)
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-[90vw] overflow-y-auto p-0 md:max-w-[80vw]">
        <div className="relative flex min-h-[90vh] flex-col bg-background">
          {/* Content */}
          <div className="flex-1 p-6 md:p-10">
            <div className="mx-auto max-w-4xl">
              {/* Header */}
              <div className="mb-8">
                <h2 className="mb-4 text-3xl font-bold">{project.title}</h2>
                <div className="mb-6 flex flex-wrap gap-2">
                  {project.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="rounded-full bg-primary/[0.08] px-3 py-1 text-sm font-medium text-primary"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <p className="text-lg text-muted-foreground">{project.description}</p>
              </div>

              {/* Screenshots */}
              {project.images && (
                <div className="mb-8">
                  <h3 className="mb-4 text-xl font-semibold">Screenshots</h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    {project.images.map((image, index) => (
                      <ImageModal
                        key={index}
                        src={image}
                        alt={`${project.title} screenshot ${index + 1}`}
                        className="aspect-video"
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Key Features */}
              {project.highlights && (
                <div className="mb-8">
                  <h3 className="mb-4 text-xl font-semibold">Key Features</h3>
                  <ul className="grid gap-3 md:grid-cols-2">
                    {project.highlights.map((highlight, index) => (
                      <li
                        key={index}
                        className="flex items-start space-x-2"
                      >
                        <span className="mt-1 block h-2 w-2 shrink-0 rounded-full bg-primary" />
                        <span>{highlight}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Technical Details */}
              <div>
                <h3 className="mb-4 text-xl font-semibold">Technical Overview</h3>
                <div className="prose prose-gray dark:prose-invert">
                  <p>{technicalDetails.overview}</p>
                  <ul>
                    {technicalDetails.details.map((detail, index) => (
                      <li key={index}>{detail}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
} 