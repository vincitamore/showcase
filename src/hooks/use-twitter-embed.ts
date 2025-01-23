import { useEffect } from 'react'

export function useTwitterEmbed() {
  useEffect(() => {
    // Remove any existing script to prevent duplicates
    const existingScript = document.getElementById('twitter-widget')
    if (existingScript) {
      existingScript.remove()
    }

    // Add Twitter widget script
    const script = document.createElement('script')
    script.id = 'twitter-widget'
    script.src = 'https://platform.twitter.com/widgets.js'
    script.async = true
    script.charset = 'utf-8'
    document.body.appendChild(script)

    return () => {
      // Cleanup on unmount
      const script = document.getElementById('twitter-widget')
      if (script) {
        script.remove()
      }
    }
  }, [])
} 