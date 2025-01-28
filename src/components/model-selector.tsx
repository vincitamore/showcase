"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { MODEL_CONFIGS } from "@/lib/chat-config"
import type { ModelConfig } from "@/lib/chat-config"

const models = [
  {
    value: "claude-3-5-sonnet-20241022",
    label: "Claude 3.5 Sonnet",
    description: "Anthropic's latest model optimized for chat"
  },
  {
    value: "claude-3-opus-20240229",
    label: "Claude 3 Opus",
    description: "Anthropic's most capable model"
  },
  {
    value: "grok-2-latest",
    label: "Grok-2",
    description: "xAI's most capable vision model"
  },
] as const

export type ModelValue = typeof models[number]["value"]

export interface ModelSelectorProps {
  value: ModelValue
  onValueChange: (value: ModelValue) => void
  className?: string
  triggerClassName?: string
}

export function ModelSelector({ 
  value, 
  onValueChange,
  className,
  triggerClassName
}: ModelSelectorProps) {
  const [open, setOpen] = React.useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-[200px] justify-between text-xs", triggerClassName)}
        >
          <span className="truncate">
            {value ? models.find((model) => model.value === value)?.label : "Select model..."}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className={cn("w-[200px] p-0", className)} 
        style={{ position: 'relative', zIndex: 99999 }}
        side="bottom" 
        sideOffset={4}
        align="start"
      >
        <Command shouldFilter>
          <CommandInput placeholder="Search models..." className="h-9" />
          <CommandList>
            <CommandEmpty>No model found.</CommandEmpty>
            <CommandGroup>
              {models.map((model) => (
                <CommandItem
                  key={model.value}
                  value={model.value}
                  onSelect={() => {
                    onValueChange(model.value)
                    setOpen(false)
                  }}
                  className="flex items-center gap-2 px-2 py-1.5 cursor-pointer aria-selected:bg-accent aria-selected:text-accent-foreground"
                >
                  <Check
                    className={cn(
                      "h-4 w-4 shrink-0",
                      value === model.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col flex-1 overflow-hidden">
                    <span className="truncate">{model.label}</span>
                    <span className="text-xs text-muted-foreground truncate">
                      {model.description}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export function ModelSelectorCompact({ 
  value, 
  onValueChange,
  className,
  triggerClassName
}: ModelSelectorProps) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className={cn("w-[180px]", className)}>
        <SelectValue placeholder="Select a model" />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(MODEL_CONFIGS).map(([id, config]: [string, ModelConfig]) => (
          <SelectItem key={id} value={id as ModelValue}>
            {config.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
} 