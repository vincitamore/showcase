"use client"

import * as React from "react"
import { Menu, Moon, Sun, Monitor, Laptop } from "lucide-react"
import { useSmoothScroll } from "@/hooks/use-smooth-scroll"
import { useRouter } from "next/navigation"
import Cookies from "js-cookie"
import { useTheme } from "@/hooks/use-theme"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet"

const navigation = [
  { name: "Projects", href: "#projects" },
  { name: "Skills", href: "#skills" },
  { name: "Experience", href: "#experience" },
  { name: "Contact", href: "#contact" },
]

function ThemeToggle() {
  const [mounted, setMounted] = React.useState(false)
  const [theme, setThemeState] = React.useState<string>("system")
  const { setTheme } = useTheme()

  const debug = (message: string) => {
    console.log(`[ThemeToggle] ${message}`)
  }

  React.useEffect(() => {
    try {
      debug("Component mounted")
      setMounted(true)
      
      // Get initial theme from localStorage or default to system
      const savedTheme = localStorage.getItem('theme') || 'system'
      debug(`Initial theme from localStorage: ${savedTheme}`)
      setThemeState(savedTheme)
    } catch (err) {
      console.error("[ThemeToggle] Error in useEffect:", err)
    }
  }, [])

  const handleThemeChange = (newTheme: string) => {
    try {
      debug(`Setting new theme: ${newTheme}`)
      
      // Update state and localStorage
      setThemeState(newTheme)
      setTheme(newTheme)
      localStorage.setItem('theme', newTheme)
      
      debug(`Theme updated successfully to: ${newTheme}`)
    } catch (err) {
      console.error("[ThemeToggle] Error setting theme:", err)
    }
  }

  // Show loading state
  if (!mounted) {
    return (
      <Button variant="ghost" size="icon">
        <Sun className="h-5 w-5" />
        <span className="sr-only">Loading theme</span>
      </Button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0 dim:-rotate-90 dim:scale-0" />
          <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100 dim:rotate-0 dim:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem 
          onClick={() => handleThemeChange("light")} 
          className={theme === "light" ? "bg-accent" : ""}
        >
          <Sun className="mr-2 h-4 w-4" />
          Light
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => handleThemeChange("dim")} 
          className={theme === "dim" ? "bg-accent" : ""}
        >
          <Laptop className="mr-2 h-4 w-4" />
          Dim
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => handleThemeChange("dark")} 
          className={theme === "dark" ? "bg-accent" : ""}
        >
          <Moon className="mr-2 h-4 w-4" />
          Dark
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function NavBar() {
  const [isOpen, setIsOpen] = React.useState(false)
  const { scrollToSection } = useSmoothScroll()

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    scrollToSection(e)
    setIsOpen(false)
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center">
        <div className="mr-4 flex flex-1 items-center">
          <a className="mr-6 flex items-center space-x-2" href="/">
            <span className="font-bold">Portfolio</span>
          </a>
          {/* Desktop Navigation */}
          <nav className="hidden items-center space-x-6 text-sm font-medium md:flex">
            {navigation.map((item) => (
              <a
                key={item.name}
                className="transition-colors hover:text-foreground/80"
                href={item.href}
                onClick={handleClick}
              >
                {item.name}
              </a>
            ))}
          </nav>
        </div>

        <div className="flex items-center space-x-4">
          <ThemeToggle />

          {/* Mobile Navigation */}
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px]">
              <nav className="flex flex-col space-y-4">
                {navigation.map((item) => (
                  <a
                    key={item.name}
                    href={item.href}
                    className="text-lg font-medium transition-colors hover:text-foreground/80"
                    onClick={handleClick}
                  >
                    {item.name}
                  </a>
                ))}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
} 