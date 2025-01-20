"use client"

import * as React from "react"
import Image from "next/legacy/image"
import { Dialog, DialogContent, DialogOverlay } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

interface ImageModalProps {
  src: string
  alt: string
  className?: string
}

export function ImageModal({ src, alt, className }: ImageModalProps) {
  const [isOpen, setIsOpen] = React.useState(false)

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          "group/image relative w-full cursor-zoom-in overflow-hidden rounded-lg bg-muted transition-all hover:shadow-xl",
          className
        )}
      >
        <div className="absolute inset-0 z-10 bg-black/0 transition-colors group-hover/image:bg-black/10" />
        <div className="relative aspect-video">
          <Image
            src={src}
            alt={alt}
            layout="fill"
            objectFit="cover"
            className="transition-transform duration-500 group-hover/image:scale-105"
          />
        </div>
      </button>

      <Dialog modal open={isOpen} onOpenChange={setIsOpen}>
        <DialogOverlay className="bg-black/80" />
        <DialogContent className="max-w-[90vw] border-none bg-transparent p-0 shadow-none">
          <div className="relative aspect-[16/9] w-full overflow-hidden rounded-lg bg-muted shadow-2xl">
            <Image
              src={src}
              alt={alt}
              layout="fill"
              objectFit="contain"
              priority
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
} 