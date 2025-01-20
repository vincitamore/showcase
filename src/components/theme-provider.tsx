"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"
import { type ThemeProviderProps } from "next-themes/dist/types"

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  // During SSR and initial client render, use a default theme
  const defaultTheme = {
    theme: 'light',
    setTheme: () => null,
    themes: ['light', 'dark', 'dim', 'system'],
    systemTheme: 'light',
    resolvedTheme: 'light',
  }

  return (
    <NextThemesProvider
      {...props}
      defaultTheme="light"
      forcedTheme={!mounted ? 'light' : undefined}
      enableSystem={mounted}
      themes={["light", "dark", "dim", "system"]}
      attribute="class"
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  )
} 