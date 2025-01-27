"use client"

import { motion } from 'framer-motion'
import { ModelSelector, type ModelValue } from "@/components/model-selector"

interface GrokTaglineProps {
  selectedModel: ModelValue
  onModelChange: (value: ModelValue) => void
}

export function GrokTagline({ selectedModel, onModelChange }: GrokTaglineProps) {
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