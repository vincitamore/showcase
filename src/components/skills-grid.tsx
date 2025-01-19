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
  Factory,
} from "lucide-react"

const skillCategories = [
  {
    title: "Network Engineering",
    icon: Network,
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
    icon: Server,
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
    icon: Shield,
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
    icon: Code,
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