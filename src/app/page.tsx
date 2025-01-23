import { Card3D } from "@/components/ui/card"
import dynamic from 'next/dynamic';
import { Github, Mail } from "lucide-react"
import { NavWrapper } from "@/components/nav-wrapper"
import { motion } from 'framer-motion';

const AnimatedChatInput = dynamic(() => import('@/components/animated-chat-input').then(mod => mod.AnimatedChatInput), {
  loading: () => <div className="w-full max-w-3xl mx-auto opacity-0" />,
  ssr: false
});

const GrokTagline = dynamic(() => import('@/components/grok-tagline').then(mod => mod.GrokTagline), {
  loading: () => <div className="mt-2 opacity-0" />,
  ssr: false
});

const ContactForm = dynamic(() => import('@/components/contact-form'), {
  loading: () => <div>Loading...</div>,
  ssr: false
});

const BlogSection = dynamic(() => import('@/components/blog-section'), {
  loading: () => <div>Loading...</div>
});

const ProjectsSection = dynamic(() => import('@/components/projects-section'), {
  loading: () => <div>Loading...</div>
});

const SkillsGrid = dynamic(() => import('@/components/skills-grid'), {
  loading: () => <div>Loading...</div>
});

const ProfessionalJourney = dynamic(() => import('@/components/professional-journey').then(mod => mod.ProfessionalJourney), {
  loading: () => <div>Loading...</div>
});

export default function Home() {
  return (
    <>
      <NavWrapper />
      <main className="flex-1 relative min-h-screen overflow-hidden bg-gradient-to-b from-background via-background/90 to-background/80 pb-24">
        {/* Background gradients */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(0,0,0,0.12)_0,transparent_50%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_100%_100%,rgba(0,0,0,0.12)_0,transparent_50%)]" />
        
        {/* Hero Section */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-primary/[0.07] to-transparent" />
          
          <div className="container relative mx-auto px-4 py-16 sm:py-24">
            <div className="text-center">
              {/* Logo */}
              <div className="mx-auto mb-6 h-14 w-14">
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
              
              {/* Chat Input */}
              <div className="mt-16">
                <AnimatedChatInput />
                <GrokTagline />
              </div>
            </div>
          </div>
        </section>

        {/* Projects Section */}
        <ProjectsSection />

        {/* Skills Section */}
        <section id="skills" className="container relative mx-auto px-4 py-8 scroll-mt-16">
          <SkillsGrid />
        </section>

        {/* Experience Section */}
        <section id="experience" className="container relative mx-auto px-4 py-8 scroll-mt-16">
          <ProfessionalJourney />
          
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

        {/* Blog Section */}
        <section id="blog" className="container relative mx-auto px-4 py-16 scroll-mt-16">
          <h2 className="mb-16 text-center text-3xl font-bold tracking-tight sm:text-4xl">
            Latest Thoughts
          </h2>
          <BlogSection />
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
              href={`https://x.com/${process.env.NEXT_PUBLIC_TWITTER_USERNAME}`}
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
              <Mail className="h-6 w-4" />
              <span className="sr-only">Email</span>
            </a>
          </div>
          <ContactForm />
        </section>
      </main>
    </>
  )
}
