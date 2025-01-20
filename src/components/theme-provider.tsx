"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"
import { type ThemeProviderProps } from "next-themes/dist/types"

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      value={{
        light: "light",
        dark: "dark",
        dim: "dim",
        system: "system"
      }}
      themes={["light", "dark", "dim", "system"]}
      forcedTheme={!mounted ? "system" : undefined}
      {...props}
    >
      {children}
    </NextThemesProvider>
  )
} 