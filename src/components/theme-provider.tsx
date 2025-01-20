"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"
import type { ThemeProviderProps } from "next-themes/dist/types"

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
    // Initialize theme from localStorage or default to system
    const savedTheme = localStorage.getItem('theme') || 'system'
    document.documentElement.classList.add(savedTheme)
  }, [])

  if (!mounted) {
    return (
      <NextThemesProvider
        attribute="class"
        defaultTheme="system"
        value={{
          light: "light",
          dark: "dark",
          dim: "dim",
          system: "system"
        }}
        enableSystem
        disableTransitionOnChange
        {...props}
      >
        {children}
      </NextThemesProvider>
    )
  }

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      value={{
        light: "light",
        dark: "dark",
        dim: "dim",
        system: "system"
      }}
      enableSystem
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  )
} 