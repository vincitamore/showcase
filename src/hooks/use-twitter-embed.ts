import { useEffect, useCallback } from 'react'

export function useTwitterEmbed() {
  // Function to load Twitter widgets
  const loadTwitterWidgets = useCallback(() => {
    if (typeof window !== 'undefined' && (window as any).twttr) {
      (window as any).twttr.widgets.load();
      console.log('[Twitter Embed] Manually triggered widget loading');
    } else {
      console.warn('[Twitter Embed] Twitter widget script not loaded yet');
    }
  }, []);

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

    // Set up a callback for when the script loads
    script.onload = () => {
      console.log('[Twitter Embed] Twitter widget script loaded');
      
      // Give a small delay for the DOM to settle before loading widgets
      setTimeout(() => {
        loadTwitterWidgets();
      }, 500);
    };

    // Set up a mutation observer to detect when tweets are added to the DOM
    const observer = new MutationObserver((mutations) => {
      let shouldReload = false;
      
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node instanceof HTMLElement) {
              // Check if the added node contains a Twitter embed
              if (
                node.querySelector('.twitter-tweet') || 
                node.classList.contains('twitter-tweet')
              ) {
                shouldReload = true;
              }
            }
          });
        }
      });
      
      if (shouldReload) {
        // Debounce the reload to avoid multiple rapid calls
        if ((window as any).twitterReloadTimeout) {
          clearTimeout((window as any).twitterReloadTimeout);
        }
        
        (window as any).twitterReloadTimeout = setTimeout(() => {
          console.log('[Twitter Embed] Detected new Twitter embeds, reloading widgets');
          loadTwitterWidgets();
        }, 300);
      }
    });
    
    // Start observing the document
    observer.observe(document.body, { 
      childList: true, 
      subtree: true 
    });

    return () => {
      // Cleanup on unmount
      const script = document.getElementById('twitter-widget')
      if (script) {
        script.remove()
      }
      
      // Disconnect the observer
      observer.disconnect();
      
      // Clear any pending timeouts
      if ((window as any).twitterReloadTimeout) {
        clearTimeout((window as any).twitterReloadTimeout);
      }
    }
  }, [loadTwitterWidgets])

  return { loadTwitterWidgets };
} 