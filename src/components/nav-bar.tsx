"use client"

import * as React from "react"
import { Menu, Moon, Sun, Monitor, Laptop } from "lucide-react"
import { useTheme } from "next-themes"
import { useSmoothScroll } from "@/hooks/use-smooth-scroll"

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

export function NavBar() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)
  const [isOpen, setIsOpen] = React.useState(false)
  const { scrollToSection } = useSmoothScroll()

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    scrollToSection(e)
    setIsOpen(false)
  }

  // During SSR and initial mount, show default icons
  if (!mounted) {
    return (
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center">
          <div className="mr-4 flex flex-1 items-center">
            <a className="mr-6 flex items-center space-x-2" href="/">
              <span className="font-bold">Portfolio</span>
            </a>
          </div>
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="icon">
              <Sun className="h-5 w-5" />
              <span className="sr-only">Toggle theme</span>
            </Button>
          </div>
        </div>
      </header>
    )
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
                onClick={() => setTheme("light")} 
                className={theme === "light" ? "bg-accent" : ""}
                data-theme="light"
              >
                <Sun className="mr-2 h-4 w-4" />
                Light
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => setTheme("dim")} 
                className={theme === "dim" ? "bg-accent" : ""}
                data-theme="dim"
              >
                <Laptop className="mr-2 h-4 w-4" />
                Dim
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => setTheme("dark")} 
                className={theme === "dark" ? "bg-accent" : ""}
                data-theme="dark"
              >
                <Moon className="mr-2 h-4 w-4" />
                Dark
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => setTheme("system")} 
                className={theme === "system" ? "bg-accent" : ""}
                data-theme="system"
              >
                <Monitor className="mr-2 h-4 w-4" />
                System
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

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