"use client"

import { Card3D } from "@/components/ui/card"
import { Wrench, HardHat, Tractor, Building2, Fuel, Network } from "lucide-react"

const experiences = [
  {
    title: "IT/OT Specialist",
    company: "Municipal Utilities",
    period: "2021 - Present",
    description: "Lead enterprise IT operations while managing IT/OT integration initiatives. Responsible for maintaining corporate networks, systems, and security infrastructure alongside SCADA networks and industrial control systems. Drive modernization efforts across both IT and OT environments.",
    highlights: [
      "Manage enterprise IT infrastructure and systems",
      "Maintain corporate networks and security",
      "Implement IT/OT integration solutions",
      "Support SCADA and PLC systems",
      "Drive technology modernization initiatives"
    ],
    icon: Wrench
  },
  {
    title: "Internet Technician",
    company: "ISP Services",
    period: "2014 - 2021",
    description: "Specialized in network infrastructure and customer solutions.",
    highlights: [
      "Installed and maintained fiber optic, cable, and wireless networks",
      "Provided technical solutions for residential and commercial clients",
      "Managed complex network troubleshooting and optimization",
      "Implemented and maintained network security measures",
      "Trained and mentored new technicians"
    ],
    icon: Network
  },
  {
    title: "Regulatory Compliance Technician",
    company: "Fuel Systems Service",
    period: "2013 - 2014",
    description: "Conducted technical inspections and maintenance of underground fuel systems across multiple states.",
    highlights: [
      "Performed complex regulatory testing procedures",
      "Installed and maintained cathodic protection systems",
      "Managed detailed compliance documentation",
      "Troubleshot sophisticated monitoring systems"
    ],
    icon: Fuel
  },
  {
    title: "Construction Specialist",
    company: "Various Projects",
    period: "2012 - 2013",
    description: "Contributed to diverse construction projects from residential to marine infrastructure.",
    highlights: [
      "Built custom homes and specialized structures",
      "Constructed marine infrastructure (docks, seawalls)",
      "Managed material logistics and project timelines",
      "Coordinated with multiple trade specialists"
    ],
    icon: Building2
  },
  {
    title: "Heavy Equipment Operator",
    company: "Rock Quarry Operations",
    period: "2009 - 2012",
    description: "Operated and maintained heavy machinery in a high-precision industrial environment.",
    highlights: [
      "Managed complex industrial processes",
      "Maintained quality control standards",
      "Performed equipment maintenance and repairs",
      "Optimized operational efficiency"
    ],
    icon: HardHat
  },
  {
    title: "Agricultural Operations",
    company: "Family Farm",
    period: "2005 - Present",
    description: "Integral part of a family-operated corn and soybean farm, developing foundational skills in problem-solving and systems management.",
    highlights: [
      "Managed complex agricultural systems",
      "Maintained and repaired diverse equipment",
      "Implemented precision farming technologies",
      "Developed sustainable operation practices"
    ],
    icon: Tractor
  }
]

const ExperienceTimeline = () => {
  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-0 top-0 h-full w-px bg-border md:left-1/2" />
      
      {experiences.map((experience, index) => {
        const Icon = experience.icon
        return (
          <div key={index} className={`relative mb-8 md:mb-12 ${index % 2 === 0 ? "md:text-right" : ""}`}>
            {/* Timeline dot */}
            <div className="absolute left-0 top-3 h-3 w-3 rounded-full border border-primary bg-background md:left-1/2 md:-translate-x-[6px]" />
            
            {/* Content */}
            <div className={`ml-8 md:ml-0 ${
              index % 2 === 0 
                ? "md:mr-[calc(50%+16px)]" 
                : "md:ml-[calc(50%+16px)]"
            }`}>
              <Card3D className="p-6">
                <div className={`flex items-center gap-3 md:gap-4 ${index % 2 === 0 ? "md:flex-row-reverse" : ""}`}>
                  <Icon className="h-6 w-6 shrink-0 text-primary" />
                  <div className={`flex-1 ${index % 2 === 0 ? "md:text-right" : ""}`}>
                    <h3 className="font-semibold">{experience.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {experience.company} • {experience.period}
                    </p>
                  </div>
                </div>
                <p className={`mt-3 text-muted-foreground ${index % 2 === 0 ? "md:text-right" : ""}`}>
                  {experience.description}
                </p>
                <ul className={`mt-4 space-y-2 ${index % 2 === 0 ? "md:text-right" : "text-left"}`}>
                  {experience.highlights.map((highlight, highlightIndex) => (
                    <li 
                      key={highlightIndex}
                      className={`text-sm ${index % 2 === 0 ? "md:before:hidden md:after:ml-2 md:after:content-['•'] md:after:text-primary" : "before:mr-2 before:content-['•'] before:text-primary"}`}
                    >
                      {highlight}
                    </li>
                  ))}
                </ul>
              </Card3D>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default ExperienceTimeline; 