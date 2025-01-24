"use client"

import { useState } from "react"
import { Card3D } from "@/components/ui/card"
import { ImageModal } from "@/components/image-modal"
import { ProjectDetailsModal } from "@/components/project-details-modal"
import { Carousel } from "@/components/ui/carousel"
import { cn } from "@/lib/utils"

const projects = [
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
        className="w-full max-w-[90rem] mx-auto pb-4" 
        opts={{ 
          loop: true, 
          align: "center",
          containScroll: "trimSnaps",
          dragFree: false
        }}
        classNames={{
          viewport: "overflow-visible",
          prevNextButton: "bg-transparent hover:bg-transparent static",
          prevButton: "-left-4",
          nextButton: "-right-4",
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
                <button
                  onClick={() => setSelectedProject(project)}
                  className="inline-flex items-center text-xs sm:text-sm font-medium text-primary transition-colors hover:text-primary/80"
                >
                  Learn more <span className="ml-1 transition-transform group-hover:translate-x-0.5">→</span>
                </button>
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