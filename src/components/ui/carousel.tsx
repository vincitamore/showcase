"use client"

import * as React from "react"
import { Card3D } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import useEmblaCarousel, {
  type UseEmblaCarouselType,
} from "embla-carousel-react"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"

type CarouselApi = UseEmblaCarouselType[1]
type UseCarouselParameters = Parameters<typeof useEmblaCarousel>[0]

interface CarouselProps {
  opts?: UseCarouselParameters
  orientation?: "horizontal" | "vertical"
  setApi?: (api: CarouselApi) => void
  className?: string
  children: React.ReactNode
}

export function Carousel({
  opts = { loop: true },
  orientation = "horizontal",
  setApi,
  className,
  children,
}: CarouselProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    ...opts,
    axis: orientation === "horizontal" ? "x" : "y",
  })

  const [prevBtnDisabled, setPrevBtnDisabled] = React.useState(true)
  const [nextBtnDisabled, setNextBtnDisabled] = React.useState(true)
  const [selectedIndex, setSelectedIndex] = React.useState(0)

  const scrollPrev = React.useCallback(() => emblaApi?.scrollPrev(), [emblaApi])
  const scrollNext = React.useCallback(() => emblaApi?.scrollNext(), [emblaApi])

  const onSelect = React.useCallback((api: CarouselApi) => {
    if (!api) return

    setSelectedIndex(api.selectedScrollSnap())
    setPrevBtnDisabled(!api.canScrollPrev())
    setNextBtnDisabled(!api.canScrollNext())
  }, [])

  React.useEffect(() => {
    if (!emblaApi) return

    onSelect(emblaApi)
    emblaApi.on("select", () => onSelect(emblaApi))
    emblaApi.on("reInit", () => onSelect(emblaApi))
  }, [emblaApi, onSelect])

  return (
    <div className={cn(
      "relative",
      "px-4 sm:px-8 md:px-12 lg:px-16",
      className
    )}>
      {/* Main container with rounded corners */}
      <div className="absolute inset-0 rounded-xl sm:rounded-2xl lg:rounded-[2rem] overflow-hidden">
        {/* Background layers */}
        <div className="absolute inset-0 bg-gradient-to-t from-background/0 via-background/50 to-background/0" />
        <div className="absolute inset-0 ring-1 ring-foreground/[0.03] bg-background/20 backdrop-blur-[2px]" />
        
        {/* Side navigation areas with gradients that fade to transparent */}
        <div className="absolute left-0 inset-y-0 w-8 sm:w-12 lg:w-16 bg-gradient-to-r from-background/40 to-transparent backdrop-blur-sm" />
        <div className="absolute right-0 inset-y-0 w-8 sm:w-12 lg:w-16 bg-gradient-to-l from-background/40 to-transparent backdrop-blur-sm" />
      </div>
      
      {/* Navigation buttons positioned on edges */}
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-20",
          "h-8 w-8 sm:h-10 sm:w-10 lg:h-12 lg:w-12",
          "rounded-full bg-background/20 hover:bg-background/40 backdrop-blur-sm transition-all duration-200"
        )}
        disabled={prevBtnDisabled}
        onClick={scrollPrev}
      >
        <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6" />
        <span className="sr-only">Previous slide</span>
      </Button>
      
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-20",
          "h-8 w-8 sm:h-10 sm:w-10 lg:h-12 lg:w-12",
          "rounded-full bg-background/20 hover:bg-background/40 backdrop-blur-sm transition-all duration-200"
        )}
        disabled={nextBtnDisabled}
        onClick={scrollNext}
      >
        <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6" />
        <span className="sr-only">Next slide</span>
      </Button>

      <div ref={emblaRef} className="overflow-hidden rounded-xl sm:rounded-2xl lg:rounded-[2rem] px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
        <div className={cn(
          "flex",
          orientation === "horizontal" ? "-ml-4 sm:-ml-6 lg:-ml-8" : "-mt-4 sm:-mt-6 lg:-mt-8 flex-col",
        )}>
          {React.Children.map(children, (child) => (
            <div className={cn(
              "min-w-0 flex-[0_0_auto] transition-opacity duration-300",
              orientation === "horizontal" ? "pl-4 sm:pl-6 lg:pl-8" : "pt-4 sm:pt-6 lg:pt-8",
            )}>
              {child}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
} 