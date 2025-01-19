"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface Card3DProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  className?: string
  containerClassName?: string
}

export function Card3D({
  children,
  className,
  containerClassName,
  ...props
}: Card3DProps) {
  const [rotateX, setRotateX] = React.useState(0)
  const [rotateY, setRotateY] = React.useState(0)

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = e.currentTarget
    const rect = card.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const centerX = rect.width / 2
    const centerY = rect.height / 2
    const rotateX = ((y - centerY) / centerY) * 10
    const rotateY = ((centerX - x) / centerX) * 10

    setRotateX(rotateX)
    setRotateY(rotateY)
  }

  const handleMouseLeave = () => {
    setRotateX(0)
    setRotateY(0)
  }

  return (
    <div
      className={cn(
        "group perspective-[1000px] relative transition-transform duration-300",
        containerClassName
      )}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      {...props}
    >
      <div
        className={cn(
          "relative h-full w-full rounded-xl transition-all duration-200 ease-out",
          "bg-gradient-to-br from-white/50 via-white/10 to-white/5 dark:from-white/10 dark:via-white/5 dark:to-transparent",
          "border border-white/20 dark:border-white/10",
          "shadow-[0_8px_16px_rgb(0_0_0/0.1)] dark:shadow-[0_8px_16px_rgb(0_0_0/0.4)]",
          "backdrop-blur-[2px]",
          "group-hover:shadow-[0_16px_32px_rgb(0_0_0/0.2)] dark:group-hover:shadow-[0_16px_32px_rgb(0_0_0/0.6)]",
          "group-hover:border-white/30 dark:group-hover:border-white/20",
          className
        )}
        style={{
          transform: `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`,
          transformStyle: "preserve-3d",
        }}
      >
        <div className="relative z-10">{children}</div>
        <div
          className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/20 via-white/10 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100 dark:from-white/10"
          style={{
            transform: "translateZ(-1px)",
          }}
        />
      </div>
    </div>
  )
} 