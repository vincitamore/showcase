import { Card3D } from "@/components/ui/card"
import { SkillsGrid } from "@/components/skills-grid"
import { ExperienceTimeline } from "@/components/experience-timeline"
import { ContactForm } from "@/components/contact-form"
import { Github, Mail, Twitter } from "lucide-react"
import { ProjectsSection } from "@/components/projects-section"

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-b from-background via-background/90 to-background/80 pb-24">
      {/* Background gradients */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(0,0,0,0.12)_0,transparent_50%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_100%_100%,rgba(0,0,0,0.12)_0,transparent_50%)]" />
      
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-primary/[0.07] to-transparent" />
        
        <div className="container relative mx-auto px-4 py-32 sm:py-48">
          <div className="text-center">
            {/* Logo */}
            <div className="mx-auto mb-6 h-16 w-16">
              <img
                src="/favicon.ico"
                alt="Heart and Crown Logo"
                className="h-full w-full"
              />
            </div>
            <div className="pb-8">
              <p className="mb-4 text-sm font-medium tracking-wider text-primary uppercase">Qui vincit, vincit amore</p>
              <h1 className="inline-block bg-gradient-to-b from-foreground via-foreground/90 to-foreground/70 bg-clip-text text-5xl font-bold leading-relaxed tracking-tight text-transparent sm:text-7xl sm:leading-relaxed">
                Fullstack Engineer
              </h1>
            </div>
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
              Crafting elegant solutions with passion and precision. 
              From infrastructure to interface, building technology that empowers and endures.
            </p>
          </div>
        </div>
      </section>

      <ProjectsSection />

      {/* Skills Section */}
      <section id="skills" className="container relative mx-auto px-4 py-16 scroll-mt-16">
        <h2 className="mb-16 text-center text-3xl font-bold tracking-tight sm:text-4xl">
          Technical Expertise
        </h2>
        <div className="mb-8 mx-auto max-w-2xl text-center">
          <p className="text-lg text-muted-foreground">
            With over a decade of experience in IT and network infrastructure, 
            I bring a comprehensive skill set spanning from network engineering to modern web development.
          </p>
        </div>
        <SkillsGrid />
      </section>

      {/* Experience Section */}
      <section id="experience" className="container relative mx-auto px-4 py-16 scroll-mt-16">
        <h2 className="mb-16 text-center text-3xl font-bold tracking-tight sm:text-4xl">
          Professional Journey
        </h2>
        <div className="mb-16 mx-auto max-w-2xl text-center">
          <p className="text-lg text-muted-foreground">
            My diverse background spans technology, industrial operations, and agriculture. This unique combination 
            brings a practical, solution-oriented approach to technical challenges, grounded in real-world experience 
            and a deep understanding of various industries.
          </p>
        </div>
        <ExperienceTimeline />
        
        <div className="mt-16 mx-auto max-w-3xl text-center">
          <h3 className="mb-4 text-xl font-semibold">Why This Matters</h3>
          <p className="text-muted-foreground">
            Each stage of this journey has contributed to a comprehensive understanding of complex systems. 
            Agricultural roots taught systematic thinking and resourceful problem-solving. Industrial operations 
            developed process optimization and safety-critical decision-making. Technical roles honed network 
            engineering and security expertise. This diverse foundation enables me to bridge the gap between 
            infrastructure and innovation, delivering solutions that are both technically sophisticated and 
            practically grounded.
          </p>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="container relative mx-auto px-4 py-16 scroll-mt-16">
        <h2 className="mb-16 text-center text-3xl font-bold tracking-tight sm:text-4xl">
          Get in Touch
        </h2>
        <div className="mb-12 flex justify-center gap-6">
          <a
            href="https://github.com/vincitamore/showcase"
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            <Github className="h-6 w-6" />
            <span className="sr-only">GitHub</span>
          </a>
          <a
            href="https://x.com/vincit_amore"
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            <span className="text-2xl leading-none">𝕏</span>
            <span className="sr-only">X (Twitter)</span>
          </a>
          <a
            href="mailto:vincit_amore@amore.build"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            <Mail className="h-6 w-6" />
            <span className="sr-only">Email</span>
          </a>
        </div>
        <ContactForm />
      </section>
    </main>
  )
}
