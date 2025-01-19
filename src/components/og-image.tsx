"use client"

export function OGImage() {
  return (
    <div className="relative flex h-[800px] w-[1600px] items-center justify-center overflow-hidden rounded-2xl bg-background">
      {/* Background gradients */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-primary/[0.07] to-transparent" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(0,0,0,0.12)_0,transparent_50%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_100%_100%,rgba(0,0,0,0.12)_0,transparent_50%)]" />

      {/* Content */}
      <div className="relative px-32 text-center">
        {/* Logo */}
        <div className="mx-auto mb-12 h-28 w-28">
          <img
            src="/favicon.ico"
            alt="Heart and Crown Logo"
            className="h-full w-full drop-shadow-lg"
          />
        </div>
        <p className="mb-8 text-2xl font-medium tracking-[0.2em] text-primary uppercase">
          QUI VINCIT, VINCIT AMORE
        </p>
        <h1 className="mb-10 bg-gradient-to-b from-foreground via-foreground/90 to-foreground/70 bg-clip-text text-[8rem] font-bold leading-[1.1] tracking-tight text-transparent">
          Fullstack Engineer
        </h1>
        <p className="mx-auto max-w-4xl text-2xl font-light leading-relaxed text-foreground/80">
          Building technology that empowers and endures
        </p>
      </div>
    </div>
  )
} 