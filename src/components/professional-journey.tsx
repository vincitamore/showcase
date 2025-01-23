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
  date: string
  description: string
  highlights: string[]
  icon?: React.ReactNode
}

const timelineData: TimelineItem[] = [
  {
    title: "IT/OT Specialist",
    company: "Municipal Utilities",
    date: "2021 - Present",
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
    title: "Industrial Automation",
    company: "Manufacturing Plant",
    date: "2019 - 2021",
    description: "Specialized in industrial automation and control systems, focusing on the integration of modern technology with traditional manufacturing processes.",
    highlights: [
      "Implemented automated production systems",
      "Optimized manufacturing processes",
      "Maintained industrial control systems",
      "Developed safety protocols",
      "Trained operators on new systems"
    ],
    icon: <Building2 className="h-6 w-6" />
  },
  {
    title: "Internet Technician",
    company: "ISP Services",
    date: "2014 - 2021",
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
    title: "Plant Operations",
    company: "Energy Sector",
    date: "2012 - 2014",
    description: "Managed critical systems in power generation facilities, ensuring reliable operation and maintenance of essential infrastructure.",
    highlights: [
      "Operated power generation systems",
      "Monitored environmental controls",
      "Performed preventive maintenance",
      "Implemented safety procedures",
      "Coordinated with maintenance teams"
    ],
    icon: <Fuel className="h-6 w-6" />
  },
  {
    title: "Construction Technology",
    company: "Construction Firm",
    date: "2010 - 2012",
    description: "Integrated technology solutions in construction projects, improving efficiency and safety in building operations.",
    highlights: [
      "Implemented digital construction tools",
      "Managed project technology systems",
      "Coordinated with contractors",
      "Developed safety protocols",
      "Trained staff on new technologies"
    ],
    icon: <HardHat className="h-6 w-6" />
  },
  {
    title: "Agricultural Operations",
    company: "Family Farm",
    date: "2005 - Present",
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

function TimelineCard({ title, company, date, description, highlights, icon, index }: TimelineItem & { index: number }) {
  const cardRef = useRef(null)
  const isInView = useInView(cardRef, { 
    once: false,
    amount: 0.4,
    margin: "-100px 0px"
  })

  const isEven = index % 2 === 0

  return (
    <div className="relative mb-16">
      {/* Center dot */}
      <motion.div
        initial={{ scale: 0 }}
        animate={isInView ? { scale: 1 } : { scale: 0 }}
        transition={{ 
          duration: 0.6,
          delay: index * 0.3,
          ease: "easeOut"
        }}
        className={cn(
          "absolute top-8 w-4 h-4 rounded-full",
          "bg-background/60 backdrop-blur-[1px]",
          "ring-1 ring-primary/20",
          "before:absolute before:inset-[2px] before:rounded-full before:bg-primary/10 before:backdrop-blur-sm",
          "after:absolute after:inset-[-4px] after:rounded-full after:bg-primary/5 after:blur-[2px]",
          isEven 
            ? "left-1/2 -translate-x-1/2" 
            : "left-1/2 -translate-x-1/2 -ml-4",
          "z-10"
        )}
      />
      
      {/* Timeline line */}
      <motion.div
        initial={{ height: 0 }}
        animate={isInView ? { height: "calc(100% + 2rem)" } : { height: 0 }}
        transition={{ 
          duration: 0.8,
          delay: index * 0.3,
          ease: "easeOut"
        }}
        className={cn(
          "absolute left-1/2 top-10 -translate-x-1/2",
          "w-[1px] bg-gradient-to-b from-primary/20 via-primary/10 to-transparent",
          "before:absolute before:inset-0 before:-left-[1px] before:w-[3px] before:bg-primary/5 before:blur-[2px]"
        )}
      />

      {/* Card container */}
      <div className={`relative ${isEven ? "ml-[calc(50%+2rem)]" : "mr-[calc(50%+2rem)]"} max-w-[calc(50%-3rem)]`}>
        <motion.div
          ref={cardRef}
          initial={{ 
            opacity: 0,
            scale: 0.7,
            x: isEven ? -20 : 20,
            transformOrigin: isEven ? "left center" : "right center"
          }}
          animate={isInView ? {
            opacity: 1,
            scale: 1,
            x: 0,
            transition: {
              type: "spring",
              stiffness: 45,
              damping: 15,
              delay: index * 0.3
            }
          } : {
            opacity: 0,
            scale: 0.7,
            x: isEven ? -20 : 20,
            transition: {
              duration: 0.4,
              ease: "easeIn"
            }
          }}
        >
          <Card3D 
            className="w-full p-6 backdrop-blur-sm bg-background/20"
            containerClassName="transition-transform duration-300 hover:scale-[1.02]"
          >
            <div className="flex flex-col gap-3">
              <div className={`flex items-start ${isEven ? "" : "flex-row-reverse"} justify-between`}>
                <div className={isEven ? "" : "text-right"}>
                  <h3 className={`text-lg font-semibold flex items-center gap-2 ${isEven ? "" : "flex-row-reverse justify-end"}`}>
                    {icon}
                    {title}
                  </h3>
                  <p className="text-sm text-muted-foreground">{company}</p>
                </div>
                <span className="text-sm text-muted-foreground whitespace-nowrap">{date}</span>
              </div>
              <p className={`text-muted-foreground ${isEven ? "" : "text-right"}`}>{description}</p>
              <ul className={`space-y-1 ${isEven ? "" : "text-right"}`}>
                {highlights.map((highlight, idx) => (
                  <li key={idx} className={`text-sm text-muted-foreground ${isEven ? "before:mr-2 before:content-['•']" : "after:ml-2 after:content-['•']"}`}>
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
    <div className="space-y-16">
      <div className="text-center space-y-4">
        <h2 className="text-3xl font-bold">Professional Journey</h2>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          My diverse background spans technology, industrial operations, and agriculture. 
          This unique combination brings a practical, solution-oriented approach to technical challenges, 
          grounded in real-world experience and a deep understanding of various industries.
        </p>
      </div>
      <div className="relative">
        {timelineData.map((item: TimelineItem, index: number) => (
          <TimelineCard key={index} {...item} index={index} />
        ))}
      </div>
    </div>
  )
} 