import posthog from 'posthog-js';

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY || '';
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';

export const initPostHog = () => {
  if (!POSTHOG_KEY) {
    console.warn('PostHog key not configured - analytics disabled');
    return;
  }

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    capture_pageview: false, // We'll track views manually for SPA
    capture_pageleave: true,
    autocapture: true, // Auto-capture clicks, form submissions
    session_recording: {
      maskAllInputs: false,
      maskInputOptions: {
        password: true,
      },
    },
  });
};

// View tracking - call when ViewState changes
export const trackView = (viewName: string, properties?: Record<string, any>) => {
  if (!POSTHOG_KEY) return;
  
  posthog.capture('$pageview', {
    $current_url: `/${viewName.toLowerCase()}`,
    view: viewName,
    ...properties,
  });
};

// Event tracking - call for user actions
export const trackEvent = (eventName: string, properties?: Record<string, any>) => {
  if (!POSTHOG_KEY) return;
  
  posthog.capture(eventName, properties);
};

// User identification (for future use when you add accounts)
export const identifyUser = (userId: string, traits?: Record<string, any>) => {
  if (!POSTHOG_KEY) return;
  
  posthog.identify(userId, traits);
};

// Reset user (for logout)
export const resetUser = () => {
  if (!POSTHOG_KEY) return;
  
  posthog.reset();
};

export { posthog };


