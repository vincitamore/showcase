"use client"

import * as React from "react"
import Image from "next/legacy/image"
import { Dialog, DialogContent, DialogOverlay } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { ErrorBoundary } from "@/components/error-boundary"
import { AlertCircle } from "lucide-react"

interface ImageModalProps {
  src: string
  alt: string
  className?: string
}

function BaseImageModal({ src, alt, className }: ImageModalProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [imageError, setImageError] = React.useState(false)

  const handleImageError = () => {
    console.error('[Image Modal] Failed to load image:', { src })
    setImageError(true)
  }

  if (imageError) {
    return (
      <div className={cn(
        "flex flex-col items-center justify-center p-4 space-y-2 rounded-lg border bg-muted/50",
        className
      )}>
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="text-sm text-muted-foreground">Failed to load image</p>
      </div>
    )
  }

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
            onError={handleImageError}
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
              onError={handleImageError}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function ImageModal(props: ImageModalProps) {
  return (
    <ErrorBoundary
      fallback={
        <div className={cn(
          "flex flex-col items-center justify-center p-4 space-y-2 rounded-lg border bg-muted/50",
          props.className
        )}>
          <AlertCircle className="h-8 w-8 text-destructive" />
          <p className="text-sm text-muted-foreground">
            Something went wrong displaying the image
          </p>
        </div>
      }
    >
      <BaseImageModal {...props} />
    </ErrorBoundary>
  )
} 