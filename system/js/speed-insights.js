/**
 * Vercel Speed Insights initialization
 * Loads and configures Speed Insights for the application
 */

import { injectSpeedInsights } from '../node_modules/@vercel/speed-insights/dist/index.mjs';

// Initialize Speed Insights when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSpeedInsights);
} else {
  initSpeedInsights();
}

function initSpeedInsights() {
  try {
    // Inject Speed Insights with default configuration
    injectSpeedInsights({
      debug: false, // Set to true for debugging in development
      framework: 'vanilla' // Indicate we're using vanilla JavaScript
    });
    
    console.log('[Speed Insights] Initialized successfully');
  } catch (error) {
    console.warn('[Speed Insights] Failed to initialize:', error);
  }
}
