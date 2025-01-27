import * as React from "react"
import { motion } from "framer-motion"

export function TypingIndicator() {
  return (
    <div className="flex items-center gap-1">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="h-1 w-1 rounded-full bg-current opacity-60"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.6, 1, 0.6]
          }}
          transition={{
            duration: 0.6,
            repeat: Infinity,
            delay: i * 0.2
          }}
        />
      ))}
    </div>
  )
} 