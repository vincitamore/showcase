"use client"

import { motion } from "framer-motion"
import { useInView } from "framer-motion"
import { useRef } from "react"
import { Card3D } from "@/components/ui/card"
import { Network, Wrench, Tractor, Building2, Fuel, HardHat } from "lucide-react"
import { cn } from "@/lib/utils"

interface TimelineItem {
  title: string
  company: string
  period: string
  description: string
  highlights: string[]
  icon?: React.ReactNode
}

const timelineData: TimelineItem[] = [
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
    icon: <Wrench className="h-6 w-6" />
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
    icon: <Network className="h-6 w-6" />
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
    icon: <Fuel className="h-6 w-6" />
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
    icon: <Building2 className="h-6 w-6" />
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
    icon: <HardHat className="h-6 w-6" />
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
    icon: <Tractor className="h-6 w-6" />
  }
]

function TimelineCard({ title, company, period, description, highlights, icon, index }: TimelineItem & { index: number }) {
  const cardRef = useRef(null)
  const isInView = useInView(cardRef, { 
    once: false,
    amount: 0.3,
    margin: "-50px 0px"
  })

  const isEven = index % 2 === 0

  return (
    <div className="relative mb-8 sm:mb-12">
      {/* Center dot */}
      <motion.div
        initial={{ scale: 0 }}
        animate={isInView ? { scale: 1 } : { scale: 0 }}
        transition={{ 
          duration: 0.6,
          delay: index * 0.2,
          ease: "easeOut"
        }}
        className={cn(
          "absolute w-3 h-3 sm:w-4 sm:h-4 rounded-full",
          "bg-background/60 backdrop-blur-[1px]",
          "ring-1 ring-primary/20",
          "before:absolute before:inset-[2px] before:rounded-full before:bg-primary/10 before:backdrop-blur-sm",
          "after:absolute after:inset-[-4px] after:rounded-full after:bg-primary/5 after:blur-[2px]",
          "left-0 sm:left-1/2 top-6 sm:top-8",
          "sm:-translate-x-1/2",
          !isEven && "sm:-ml-4",
          "z-10"
        )}
      />
      
      {/* Timeline line */}
      <motion.div
        initial={{ height: 0 }}
        animate={isInView ? { height: "calc(100% + 1rem)" } : { height: 0 }}
        transition={{ 
          duration: 0.8,
          delay: index * 0.2,
          ease: "easeOut"
        }}
        className={cn(
          "absolute left-[6px] sm:left-1/2 top-8 sm:top-10 -translate-x-1/2",
          "w-[1px] bg-gradient-to-b from-primary/20 via-primary/10 to-transparent",
          "before:absolute before:inset-0 before:-left-[1px] before:w-[3px] before:bg-primary/5 before:blur-[2px]"
        )}
      />

      {/* Card container */}
      <div className={cn(
        "relative",
        "pl-8 sm:pl-0",
        "w-full sm:w-[calc(50%-2rem)]",
        isEven 
          ? "sm:ml-[calc(50%+1rem)]" 
          : "sm:mr-[calc(50%+1rem)]",
        "max-w-xl"
      )}>
        <motion.div
          ref={cardRef}
          initial={{ 
            opacity: 0,
            scale: 0.9,
            x: isEven ? 20 : -20
          }}
          animate={isInView ? {
            opacity: 1,
            scale: 1,
            x: 0,
            transition: {
              type: "spring",
              stiffness: 50,
              damping: 15,
              delay: index * 0.2
            }
          } : {
            opacity: 0,
            scale: 0.9,
            x: isEven ? 20 : -20
          }}
        >
          <Card3D 
            className="w-full p-3 sm:p-4 backdrop-blur-sm bg-background/20"
            containerClassName="transition-transform duration-300 hover:scale-[1.02] rounded-lg sm:rounded-xl"
          >
            <div className="flex flex-col gap-2 sm:gap-3">
              <div className="flex items-start justify-between flex-col sm:flex-row gap-1 sm:gap-2">
                <div className={cn(
                  "w-full sm:w-auto",
                  !isEven && "sm:text-right"
                )}>
                  <h3 className={cn(
                    "text-base sm:text-lg font-semibold flex items-center gap-2",
                    !isEven && "sm:flex-row-reverse sm:justify-end"
                  )}>
                    {icon}
                    {title}
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground">{company}</p>
                </div>
                <span className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">{period}</span>
              </div>
              <p className={cn(
                "text-xs sm:text-sm text-muted-foreground/90 leading-relaxed",
                !isEven && "sm:text-right"
              )}>{description}</p>
              <ul className={cn(
                "space-y-1",
                !isEven && "sm:text-right"
              )}>
                {highlights.map((highlight, idx) => (
                  <li 
                    key={idx} 
                    className={cn(
                      "text-xs sm:text-sm text-muted-foreground/80",
                      isEven 
                        ? "before:mr-2 before:content-['•']" 
                        : "sm:after:ml-2 sm:after:content-['•'] before:sm:content-none before:mr-2 before:content-['•']"
                    )}
                  >
                    {highlight}
                  </li>
                ))}
              </ul>
            </div>
          </Card3D>
        </motion.div>
      </div>
    </div>
  )
}

export function ProfessionalJourney() {
  return (
    <div className="space-y-12">
      <div className="text-center space-y-3 sm:space-y-4 px-4">
        <h2 className="text-2xl sm:text-3xl font-bold">Professional Journey</h2>
        <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto">
          My diverse background spans technology, industrial operations, and agriculture. 
          This unique combination brings a practical, solution-oriented approach to technical challenges, 
          grounded in real-world experience and a deep understanding of various industries.
        </p>
      </div>
      <div className="relative px-4">
        {timelineData.map((item: TimelineItem, index: number) => (
          <TimelineCard key={index} {...item} index={index} />
        ))}
      </div>
    </div>
  )
}