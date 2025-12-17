import React from 'react';
import { AlertTriangle } from 'lucide-react';
import Button from './Button';
import { trackEvent } from '../services/posthog';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    if (import.meta.env.PROD) {
      // Track error in production
      trackEvent('error_boundary_caught', {
        error: error.message,
        stack: error.stack?.substring(0, 500),
      });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-red-50 flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            <AlertTriangle className="w-16 h-16 text-red-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-red-600 mb-2">Oops! Something went wrong</h2>
            <p className="text-zinc-600 mb-6">
              We encountered an unexpected error. Please refresh the page to continue.
            </p>
            <Button
              onClick={() => window.location.reload()}
              variant="primary"
              size="lg"
            >
              Refresh Page
            </Button>
            {!import.meta.env.PROD && this.state.error && (
              <details className="mt-4 text-left">
                <summary className="cursor-pointer text-sm text-zinc-500">Error details</summary>
                <pre className="mt-2 text-xs bg-zinc-100 p-4 rounded overflow-auto">
                  {this.state.error.toString()}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}


