import * as React from "react"
import { cn } from "@/lib/utils"
import type { Components } from "react-markdown"

interface MarkdownImageProps {
  src?: string
  alt?: string
  [key: string]: any
}

interface CodeBlockProps {
  inline?: boolean
  className?: string
  children?: React.ReactNode
  [key: string]: any
}

export const markdownComponents: Components = {
  p: ({ children, ...props }) => {
    if (typeof children === 'string') {
      const lines = children.split(/\n+/).filter(Boolean)
      return (
        <>
          {lines.map((line, i) => (
            <p key={i} className="mb-2 last:mb-0" {...props}>
              {line}
            </p>
          ))}
        </>
      )
    }
    return <p className="mb-2 last:mb-0" {...props}>{children}</p>
  },
  code: ({ inline, className, children, ...props }: CodeBlockProps) => (
    <code
      className={cn(
        "rounded bg-primary/10 px-1 py-0.5 font-mono text-sm",
        inline ? "inline" : "block p-2",
        className
      )}
      {...props}
    >
      {children}
    </code>
  ),
  ul: ({ children, ...props }) => (
    <ul className="mb-2 list-disc pl-4 last:mb-0" {...props}>{children}</ul>
  ),
  ol: ({ children, ...props }) => (
    <ol className="mb-2 list-decimal pl-4 last:mb-0" {...props}>{children}</ol>
  ),
  li: ({ children, ...props }) => (
    <li className="mb-1 last:mb-0 marker:text-foreground" {...props}>{children}</li>
  ),
  h3: ({ children, ...props }) => (
    <h3 className="mb-2 text-lg font-semibold last:mb-0" {...props}>{children}</h3>
  ),
  h4: ({ children, ...props }) => (
    <h4 className="mb-2 text-base font-semibold last:mb-0" {...props}>{children}</h4>
  ),
  em: ({ children }) => (
    <em className="italic">{children}</em>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold">{children}</strong>
  ),
  img: ({ src, alt, ...props }: MarkdownImageProps) => (
    <div className="relative w-full max-w-[300px] my-4">
      <img 
        src={src} 
        alt={alt || 'Chat image'} 
        className="rounded-lg w-full h-auto object-contain"
        loading="lazy"
        onError={(e) => {
          console.error('[Chat Client] Image failed to load:', e)
          e.currentTarget.alt = 'Failed to load image'
        }}
        {...props}
      />
    </div>
  ),
} 