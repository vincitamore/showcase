"use client"

import { Card3D } from "@/components/ui/card"
import {
  Network,
  Server,
  Shield,
  Code,
  Cloud,
  Wifi,
  Database,
  Settings,
} from "lucide-react"

const skillCategories = [
  {
    title: "Network Engineering",
    icon: Network,
    description: "Expert in enterprise network infrastructure, specializing in fiber optics and wireless solutions.",
    highlights: [
      "Fiber Optic Networks",
      "Network Infrastructure",
      "Wireless Technologies",
      "Network Security",
      "Performance Optimization"
    ]
  },
  {
    title: "System Administration",
    icon: Server,
    description: "Comprehensive management of enterprise systems, focusing on Active Directory and cloud integration.",
    highlights: [
      "Active Directory",
      "Azure AD Integration",
      "Windows Server",
      "Linux Systems",
      "Infrastructure Monitoring"
    ]
  },
  {
    title: "Cybersecurity",
    icon: Shield,
    description: "Implementation of robust security solutions with Security Onion and enterprise-grade protection.",
    highlights: [
      "Security Onion Suite",
      "Threat Detection",
      "Access Management",
      "Security Policies",
      "Network Protection"
    ]
  },
  {
    title: "Software Development",
    icon: Code,
    description: "Full-stack development with modern technologies, creating efficient and scalable solutions.",
    highlights: [
      "TypeScript & React",
      "Next.js Applications",
      "Python Development",
      "API Integration",
      "Database Design"
    ]
  },
  {
    title: "Cloud Services",
    icon: Cloud,
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
    icon: Wifi,
    description: "Extensive experience in designing and implementing enterprise-grade network infrastructure.",
    highlights: [
      "Network Architecture",
      "Infrastructure Planning",
      "Performance Optimization",
      "Scalable Solutions",
      "Disaster Recovery"
    ]
  },
  {
    title: "Database Management",
    icon: Database,
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
    icon: Settings,
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

export function SkillsGrid() {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {skillCategories.map((category, index) => {
        const Icon = category.icon
        return (
          <Card3D
            key={index}
            className="group p-6"
            containerClassName="min-h-[280px]"
          >
            <div className="flex h-full flex-col">
              <div className="mb-4 flex items-center gap-3">
                <Icon className="h-6 w-6 text-primary" />
                <h3 className="text-xl font-semibold">{category.title}</h3>
              </div>
              <p className="mb-4 text-sm text-muted-foreground">
                {category.description}
              </p>
              <div className="mt-auto flex flex-wrap gap-2">
                {category.highlights.map((skill, skillIndex) => (
                  <span
                    key={skillIndex}
                    className="inline-flex items-center rounded-md bg-primary/[0.08] px-2 py-1 text-xs font-medium text-primary ring-1 ring-inset ring-primary/10 transition-colors group-hover:bg-primary/[0.12] dark:bg-primary/[0.04] dark:group-hover:bg-primary/[0.08]"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          </Card3D>
        )
      })}
    </div>
  )
} 