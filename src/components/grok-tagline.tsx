"use client"

import { motion } from 'framer-motion'

export function GrokTagline() {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5, duration: 0.3 }}
      className="mt-2 flex items-center justify-center gap-1.5 text-xs text-muted-foreground/80"
    >
      <span>Powered by</span>
      <img src="/grok-home-logo.svg" alt="Grok AI" className="hidden h-3 dark:block" />
      <img src="/grok-home-logo-dark.svg" alt="Grok AI" className="h-3 dark:hidden" />
    </motion.div>
  )
} 