"use client"

import * as React from "react"
import { motion } from 'framer-motion'
import { MODEL_CONFIGS } from "@/lib/chat-config"
import { ModelSelector, ModelSelectorCompact } from "./model-selector"
import type { ModelValue } from "./model-selector"

interface ModelSwitcherProps {
  selectedModel: ModelValue
  onModelChange: (model: ModelValue) => void
  variant?: 'default' | 'header' | 'tagline' | 'compact'
}

export function ModelSwitcher({ selectedModel, onModelChange, variant = 'default' }: ModelSwitcherProps) {
  const selectedConfig = MODEL_CONFIGS[selectedModel]

  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-1.5 text-sm">
        <span className="text-muted-foreground">Model:</span>
        <ModelSelectorCompact
          value={selectedModel}
          onValueChange={onModelChange}
          className="h-7 px-2 text-sm font-medium"
          triggerClassName="w-[140px] justify-between gap-1"
        />
      </div>
    )
  }

  if (variant === 'header') {
    return (
      <div className="flex items-center gap-2 px-2">
        <span className="text-sm text-muted-foreground">Model:</span>
        <div className="relative" style={{ isolation: 'isolate', zIndex: 99999 }}>
          <ModelSelector 
            value={selectedModel}
            onValueChange={onModelChange}
          />
        </div>
      </div>
    )
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5, duration: 0.3 }}
      className="mt-2 flex items-center justify-center gap-1.5 text-xs text-muted-foreground/80"
    >
      <span>Powered by</span>
      <ModelSelectorCompact
        value={selectedModel}
        onValueChange={onModelChange}
        className="h-6 px-2 text-xs font-medium"
        triggerClassName="w-[140px] justify-between gap-1 border-0 bg-transparent hover:bg-accent/50"
      />
    </motion.div>
  )
} 