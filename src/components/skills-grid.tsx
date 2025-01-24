"use client"

import { Card3D } from "@/components/ui/card"
import { Carousel } from "@/components/ui/carousel"
import {
  Network,
  Server,
  Shield,
  Code,
  Cloud,
  Wifi,
  Database,
  Settings,
  Factory,
} from "lucide-react"
import { cn } from "@/lib/utils"

const skillCategories = [
  {
    title: "Network Engineering",
    icon: <Network className="h-5 w-5 text-primary" />,
    description: "Expert in enterprise and industrial networks, specializing in fiber optics, wireless solutions, and IT/OT integration.",
    highlights: [
      "Fiber Optic Networks",
      "SCADA Networks & Protocols",
      "Wireless Technologies",
      "Network Security",
      "IT/OT Integration"
    ]
  },
  {
    title: "System Administration",
    icon: <Server className="h-5 w-5 text-primary" />,
    description: "Comprehensive experience in managing enterprise systems, endpoint management, and IT service delivery.",
    highlights: [
      "Active Directory & Azure AD",
      "Windows Server Administration",
      "Unified Endpoint Management (UEM)",
      "IT Service Management & Ticketing",
      "System Monitoring & Maintenance"
    ]
  },
  {
    title: "Cybersecurity",
    icon: <Shield className="h-5 w-5 text-primary" />,
    description: "Implementation and management of security solutions to protect enterprise and industrial assets.",
    highlights: [
      "EDR/XDR Implementation",
      "Security Onion & SIEM",
      "OT/ICS Security",
      "Threat Detection & Response",
      "Security Compliance"
    ]
  },
  {
    title: "Software Development",
    icon: <Code className="h-5 w-5 text-primary" />,
    description: "Full-stack development with modern technologies, focusing on automation and enterprise solutions.",
    highlights: [
      "Enterprise Software Solutions",
      "Automation Tools",
      "TypeScript & React",
      "Python Development",
      "API Integration"
    ]
  },
  {
    title: "Cloud Services",
    icon: <Cloud className="h-5 w-5 text-primary" />,
    description: "Expert management of cloud infrastructure and Microsoft 365 services.",
    highlights: [
      "Azure Administration",
      "Office 365 Management",
      "Identity Solutions",
      "Cloud Security",
      "Service Integration"
    ]
  },
  {
    title: "Infrastructure",
    icon: <Wifi className="h-5 w-5 text-primary" />,
    description: "Extensive experience in designing and implementing critical infrastructure solutions for enterprise and industrial environments.",
    highlights: [
      "Industrial Control Systems",
      "PLC Programming & Automation",
      "Enterprise Infrastructure",
      "Redundancy Planning",
      "Automated Monitoring"
    ]
  },
  {
    title: "Database Management",
    icon: <Database className="h-5 w-5 text-primary" />,
    description: "Design and maintenance of efficient database systems with focus on security and performance.",
    highlights: [
      "SQL Server Management",
      "Data Architecture",
      "Backup Solutions",
      "Performance Tuning",
      "Data Security"
    ]
  },
  {
    title: "IT Leadership",
    icon: <Settings className="h-5 w-5 text-primary" />,
    description: "Strategic IT management with focus on innovation and efficiency.",
    highlights: [
      "Project Management",
      "Team Leadership",
      "Process Optimization",
      "Technical Training",
      "Documentation"
    ]
  }
]

const SkillsGrid = () => {
  return (
    <section id="skills" className="container relative mx-auto px-4 py-16 scroll-mt-16">
      <div className="mb-16 text-center">
        <h2 className="text-3xl font-bold mb-4">Technical Expertise</h2>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          With over a decade of experience in IT and network infrastructure, I bring a
          comprehensive skill set spanning from network engineering to modern web
          development.
        </p>
      </div>

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
        {skillCategories.map((category, index) => (
          <Card3D
            key={index}
            className={cn(
              "group cursor-pointer",
              "p-4 sm:p-5",
              "mx-4",
              "w-[calc(100vw-6rem)] sm:w-[calc(50vw-3rem)] md:w-[calc(33vw-3rem)] lg:w-[24rem]",
              "max-w-[24rem]",
              "backdrop-blur-sm bg-background/10 hover:bg-background/20 transition-all duration-300"
            )}
            containerClassName="min-h-[16rem] rounded-lg sm:rounded-xl"
          >
            <div className="flex flex-col h-full">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 rounded-lg bg-primary/5 ring-1 ring-inset ring-primary/10 group-hover:bg-primary/10 transition-all duration-300">
                  {category.icon}
                </div>
                <h3 className="text-lg sm:text-xl font-semibold">{category.title}</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
                {category.description}
              </p>
              <div className="mt-auto flex flex-wrap gap-1.5">
                {category.highlights.map((highlight, tagIndex) => (
                  <span
                    key={tagIndex}
                    className="rounded-full bg-primary/5 px-2.5 py-0.5 text-xs font-medium text-primary ring-1 ring-inset ring-primary/10 transition-colors group-hover:bg-primary/10"
                  >
                    {highlight}
                  </span>
                ))}
              </div>
            </div>
          </Card3D>
        ))}
      </Carousel>
    </section>
  )
}

export default SkillsGrid 