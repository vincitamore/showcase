"use client"

import { OGImage } from "@/components/og-image"
import { Button } from "@/components/ui/button"
import { useTheme } from "next-themes"

export default function OGPreviewPage() {
  const { theme, setTheme } = useTheme()

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 p-4">
      <div className="flex gap-4">
        <Button 
          variant={theme === 'light' ? 'default' : 'outline'} 
          onClick={() => setTheme('light')}
        >
          Light
        </Button>
        <Button 
          variant={theme === 'dim' ? 'default' : 'outline'} 
          onClick={() => setTheme('dim')}
        >
          Dim
        </Button>
        <Button 
          variant={theme === 'dark' ? 'default' : 'outline'} 
          onClick={() => setTheme('dark')}
        >
          Dark
        </Button>
      </div>

      <div className="scale-[0.35] origin-top sm:scale-[0.45] lg:scale-[0.55]">
        <OGImage />
      </div>

      <p className="text-center text-sm text-muted-foreground">
        Preview scaled down. Use browser screenshot tools or a service like{" "}
        <a 
          href="https://www.screely.com/" 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          screely.com
        </a>{" "}
        to capture this image at full size.
      </p>
    </div>
  )
} 