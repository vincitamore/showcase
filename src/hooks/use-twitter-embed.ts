import { useEffect, useCallback } from 'react'

// Extend the Window interface to include our custom property
declare global {
  interface Window {
    recentlyReloaded?: boolean;
    twitterReloadTimeout?: any;
  }
}

export function useTwitterEmbed() {
  // Function to load Twitter widgets
  const loadTwitterWidgets = useCallback(() => {
    if (typeof window !== 'undefined' && (window as any).twttr) {
      try {
        console.log('[Twitter Embed] Manually triggering widget loading');
        (window as any).twttr.widgets.load();
        
        // Also try to find and process any unprocessed tweets
        setTimeout(() => {
          const unprocessedTweets = document.querySelectorAll('.twitter-tweet:not([data-twitter-extracted-i])');
          if (unprocessedTweets.length > 0) {
            console.log(`[Twitter Embed] Found ${unprocessedTweets.length} unprocessed tweets, forcing reload`);
            (window as any).twttr.widgets.load();
            
            // Hide loading indicators
            document.querySelectorAll('.tweet-embed-loading').forEach(el => {
              el.classList.add('hidden');
            });
          } else {
            console.log('[Twitter Embed] No unprocessed tweets found after initial load');
          }
        }, 1000);
      } catch (error) {
        console.error('[Twitter Embed] Error loading Twitter widgets:', error);
      }
    } else {
      console.warn('[Twitter Embed] Twitter widget script not loaded yet');
    }
  }, []);

  // Function to force reload widgets with more aggressive approach
  const forceWidgetReload = useCallback(() => {
    if (typeof window !== 'undefined' && (window as any).twttr) {
      try {
        console.log('[Twitter Embed] Forcing widget reload');
        (window as any).twttr.widgets.load();
        
        // Check for unprocessed tweets
        setTimeout(() => {
          // Use a more specific selector to avoid false positives
          const unprocessed = document.querySelectorAll('.twitter-tweet:not([data-twitter-extracted-i]):not(.twitter-tweet-rendered)');
          if (unprocessed.length > 0) {
            console.log(`[Twitter Embed] Found ${unprocessed.length} unprocessed tweets after forced reload`);
            // Try one more time
            (window as any).twttr.widgets.load();
          }
        }, 500);
      } catch (error) {
        console.error('[Twitter Embed] Error during forced widget reload:', error);
      }
    }
  }, []);

  useEffect(() => {
    console.log('[Twitter Embed] Initializing Twitter embed hook');
    
    // Remove any existing script to prevent duplicates
    const existingScript = document.getElementById('twitter-widget')
    if (existingScript) {
      console.log('[Twitter Embed] Removing existing Twitter widget script');
      existingScript.remove()
    }

    // Add Twitter widget script with improved attributes
    const script = document.createElement('script')
    script.id = 'twitter-widget'
    script.src = 'https://platform.twitter.com/widgets.js'
    script.async = true
    script.crossOrigin = 'anonymous' // Add crossOrigin attribute
    script.charset = 'utf-8'
    
    // Add error handling
    script.onerror = (error) => {
      console.error('[Twitter Embed] Error loading Twitter widget script:', error);
      
      // Try loading again with a different approach after a delay
      setTimeout(() => {
        console.log('[Twitter Embed] Retrying script load with different approach');
        const retryScript = document.createElement('script');
        retryScript.id = 'twitter-widget-retry';
        retryScript.src = 'https://platform.twitter.com/widgets.js';
        retryScript.async = true;
        document.body.appendChild(retryScript);
      }, 2000);
    };
    
    document.body.appendChild(script)

    // Set up a callback for when the script loads
    script.onload = () => {
      console.log('[Twitter Embed] Twitter widget script loaded');
      
      // Add a small delay to ensure the script is fully initialized
      setTimeout(() => {
        try {
          if ((window as any).twttr && (window as any).twttr.widgets) {
            console.log('[Twitter Embed] Initializing Twitter widgets');
            (window as any).twttr.widgets.load();
            
            // Add event listeners for widget rendering
            (window as any).twttr.events.bind('rendered', function(event: any) {
              console.log('[Twitter Embed] Tweet rendered:', event);
              
              // Hide loading indicators
              document.querySelectorAll('.tweet-embed-loading').forEach(el => {
                el.classList.add('hidden');
              });
            });
            
            // Force a second load after a delay to catch any missed embeds
            setTimeout(() => {
              console.log('[Twitter Embed] Forcing second widget load');
              (window as any).twttr.widgets.load();
            }, 1000);
          } else {
            console.warn('[Twitter Embed] Twitter widget object not available after script load');
          }
        } catch (error) {
          console.error('[Twitter Embed] Error configuring Twitter widgets:', error);
        }
      }, 100);
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

    // Set up a fallback timer to check for unprocessed tweets
    const fallbackTimer = setInterval(() => {
      // Use a more specific selector to avoid false positives
      const unprocessedTweets = document.querySelectorAll('.twitter-tweet:not([data-twitter-extracted-i]):not(.twitter-tweet-rendered)');
      
      // Only reload if we have actual unprocessed tweets and haven't reloaded recently
      if (unprocessedTweets.length > 0 && !window.recentlyReloaded) {
        console.log(`[Twitter Embed] Fallback timer found ${unprocessedTweets.length} unprocessed tweets`);
        
        // Set a flag to prevent multiple reloads in quick succession
        window.recentlyReloaded = true;
        forceWidgetReload();
        
        // Reset the flag after a reasonable delay
        setTimeout(() => {
          window.recentlyReloaded = false;
        }, 10000); // Wait 10 seconds before allowing another reload
      }
    }, 15000); // Check every 15 seconds instead of 5

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
      
      // Clear the fallback timer
      clearInterval(fallbackTimer);
    }
  }, [loadTwitterWidgets, forceWidgetReload])

  return { loadTwitterWidgets, forceWidgetReload };
} 