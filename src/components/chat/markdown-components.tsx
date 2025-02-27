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
  p: ({ node, children, ...props }) => {
    if (typeof children === 'string') {
      const lines = children.split('\n').filter(line => line.trim() !== '');
      
      if (lines.length > 1) {
        return (
          <p className="mb-2 last:mb-0" {...props}>
            {lines.map((line, i) => (
              <React.Fragment key={i}>
                {i > 0 && <br />}
                {line}
              </React.Fragment>
            ))}
          </p>
        );
      }
    }
    
    return <p className="mb-2 last:mb-0" {...props}>{children}</p>
  },
  pre: ({ node, children, ...props }) => (
    <pre 
      className="mb-2 overflow-x-auto max-w-full rounded bg-primary/10 p-2 font-mono text-sm" 
      style={{ WebkitOverflowScrolling: 'touch' }}
      {...props}
    >
      {children}
    </pre>
  ),
  code: ({ node, inline, className, children, ...props }: CodeBlockProps) => {
    if (inline) {
      return (
        <code
          className={cn(
            "rounded bg-primary/10 px-1 py-0.5 font-mono text-sm",
            className
          )}
          {...props}
        >
          {children}
        </code>
      )
    }
    
    return (
      <code
        className={cn(
          "block font-mono text-sm",
          className
        )}
        {...props}
      >
        {children}
      </code>
    )
  },
  ul: ({ node, children, ...props }) => (
    <ul className="mb-2 list-disc pl-4 last:mb-0 nested-list" {...props}>{children}</ul>
  ),
  ol: ({ node, children, ...props }) => (
    <ol className="mb-2 list-decimal pl-4 last:mb-0 nested-list" {...props}>{children}</ol>
  ),
  li: ({ node, children, ...props }) => {
    // Check if this list item contains a nested list or block element
    let hasBlockElement = false;
    let hasNestedList = false;
    let hasNestedListMarker = false;
    
    // Examine children to determine content type
    React.Children.forEach(children, child => {
      // Check for block elements in string content
      if (typeof child === 'string') {
        if (child.includes('![') || child.includes('|')) {
          hasBlockElement = true;
        }
        
        // Check for patterns that might indicate a nested list item not properly parsed
        if (/^\s*-\s/.test(child) || /^\s*\d+\.\s/.test(child)) {
          hasNestedListMarker = true;
          console.log("Found potential nested list marker in content:", child);
        }
      }
      
      // Check for nested list components
      if (React.isValidElement(child) && 
         (child.type === 'ul' || child.type === 'ol')) {
        hasNestedList = true;
      }
    });
    
    // Special handling for list items with block elements
    if (hasBlockElement) {
      return (
        <li className="mb-2 last:mb-0 marker:text-foreground" {...props}>
          {React.Children.map(children, child => {
            if (typeof child === 'string') {
              const parts = child.split(/(!\[.*?\]\(.*?\))/).filter(Boolean);
              
              if (parts.length > 1) {
                return parts.map((part, index) => {
                  if (part.startsWith('![')) {
                    return <div key={index} className="mt-2">{part}</div>;
                  }
                  return <span key={index}>{part}</span>;
                });
              }
            }
            return child;
          })}
        </li>
      );
    }
    
    // Special handling for list items with nested lists
    if (hasNestedList) {
      return (
        <li className="mb-2 marker:text-foreground list-with-nested" {...props}>
          {React.Children.map(children, child => {
            // Add spacing before nested lists
            if (React.isValidElement(child) && 
               (child.type === 'ul' || child.type === 'ol')) {
              return <div className="mt-1 nested-list-container">{child}</div>;
            }
            return child;
          })}
        </li>
      );
    }
    
    // Handle potential nested list items that were not properly nested
    if (hasNestedListMarker) {
      return (
        <li className="mb-1 last:mb-0 marker:text-foreground" {...props}>
          {React.Children.map(children, child => {
            if (typeof child === 'string') {
              const match = child.match(/^(\s*)(-|\d+\.)\s+(.*)/);
              if (match) {
                const [_, indent, marker, content] = match;
                const listType = marker && marker.includes('.') ? 'ol' : 'ul';
                
                return (
                  <>
                    {listType === 'ul' ? (
                      <ul className="mt-1 pl-4">
                        <li>{content}</li>
                      </ul>
                    ) : (
                      <ol className="mt-1 pl-4">
                        <li>{content}</li>
                      </ol>
                    )}
                  </>
                );
              }
            }
            return child;
          })}
        </li>
      );
    }
    
    // Default rendering for simple list items
    return <li className="mb-1 last:mb-0 marker:text-foreground" {...props}>{children}</li>;
  },
  h3: ({ node, children, ...props }) => (
    <h3 className="mb-2 text-lg font-semibold last:mb-0" {...props}>{children}</h3>
  ),
  h4: ({ node, children, ...props }) => (
    <h4 className="mb-2 text-base font-semibold last:mb-0" {...props}>{children}</h4>
  ),
  em: ({ node, children }) => (
    <em className="italic">{children}</em>
  ),
  strong: ({ node, children }) => (
    <strong className="font-semibold">{children}</strong>
  ),
  img: ({ node, src, alt, ...props }: MarkdownImageProps) => (
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
  blockquote: ({ node, children, ...props }) => (
    <blockquote 
      className="pl-4 border-l-2 border-primary/30 italic text-muted-foreground mb-2 last:mb-0 py-1"
      {...props}
    >
      {children}
    </blockquote>
  ),
  table: ({ node, children, ...props }) => (
    <div className="mb-4 overflow-x-auto max-w-full last:mb-0 rounded border border-border/20">
      <table className="min-w-[250px] w-full border-collapse text-sm" {...props}>
        {children}
      </table>
    </div>
  ),
  thead: ({ node, children, ...props }) => (
    <thead className="bg-primary/10 border-b border-border/30" {...props}>
      {children}
    </thead>
  ),
  tbody: ({ node, children, ...props }) => (
    <tbody className="divide-y divide-border/20" {...props}>
      {children}
    </tbody>
  ),
  tr: ({ node, children, ...props }) => (
    <tr className="hover:bg-muted/30" {...props}>
      {children}
    </tr>
  ),
  th: ({ node, children, ...props }) => (
    <th className="border-r border-border/20 last:border-0 p-2 font-medium text-left" {...props}>
      {children}
    </th>
  ),
  td: ({ node, children, ...props }) => (
    <td className="border-r border-border/20 last:border-0 p-2" {...props}>
      {children}
    </td>
  ),
  hr: ({ node, ...props }) => (
    <hr className="my-6 border-t-2 border-border/60 w-full" {...props} />
  ),
  del: ({ node, children }) => (
    <del className="line-through text-muted-foreground">{children}</del>
  ),
  a: ({ node, href, children, ...props }) => (
    <a 
      href={href} 
      target="_blank" 
      rel="noopener noreferrer"
      className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
      {...props}
    >
      {children}
    </a>
  ),
  h1: ({ node, children, ...props }) => (
    <h1 className="mb-4 text-2xl font-bold last:mb-0" {...props}>{children}</h1>
  ),
  h2: ({ node, children, ...props }) => (
    <h2 className="mb-3 text-xl font-semibold last:mb-0" {...props}>{children}</h2>
  ),
} 