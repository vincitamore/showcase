"use client"

import { useTheme } from "@/hooks/use-theme"
import { Card3D } from "@/components/ui/card"

export default function OGPage() {
  const { theme } = useTheme()

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card3D className="w-full max-w-[1200px] aspect-[1.91/1] p-8">
        <div className="flex h-full flex-col items-center justify-center text-center">
          <div className="mb-6 h-24 w-24">
            <img
              src="/favicon.ico"
              alt="Heart and Crown Logo"
              className="h-full w-full"
            />
          </div>
          <h1 className="mb-4 text-4xl font-bold">
            Fullstack Engineer
          </h1>
          <p className="text-xl text-muted-foreground">
            Crafting elegant solutions with passion and precision
          </p>
        </div>
      </Card3D>
    </div>
  )
} 