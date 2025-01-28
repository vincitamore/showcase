"use client"

import * as React from "react"
import { motion } from 'framer-motion'
import { ModelSelector, type ModelValue } from "@/components/model-selector"

interface ModelSwitcherProps {
  selectedModel: ModelValue
  onModelChange: (value: ModelValue) => void
  variant?: 'tagline' | 'header' | 'default'
}

export function ModelSwitcher({ 
  selectedModel, 
  onModelChange,
  variant = "default"
}: ModelSwitcherProps) {
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
      <ModelSelector
        value={selectedModel}
        onValueChange={onModelChange}
      />
    </motion.div>
  )
} 