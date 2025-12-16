import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { initPostHog } from './services/posthog';
import { ErrorBoundary } from './components/ErrorBoundary';

// Initialize PostHog analytics
initPostHog();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
