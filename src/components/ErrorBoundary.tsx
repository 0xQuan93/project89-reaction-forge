import { Component, type ReactNode, type ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary component to catch and handle React errors gracefully.
 * Particularly useful for catching Three.js/WebGL rendering errors.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error);
    console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="error-boundary-fallback" style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          padding: '2rem',
          background: 'rgba(8, 10, 17, 0.95)',
          color: '#e6f3ff',
          textAlign: 'center',
          borderRadius: '16px',
          border: '1px solid rgba(255, 68, 68, 0.3)',
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
          <h2 style={{ 
            margin: '0 0 0.5rem 0', 
            color: '#ff4444',
            fontSize: '1.5rem' 
          }}>
            Something went wrong
          </h2>
          <p style={{ 
            margin: '0 0 1.5rem 0', 
            color: 'rgba(230, 243, 255, 0.7)',
            maxWidth: '400px'
          }}>
            {this.state.error?.message || 'An unexpected error occurred while rendering the 3D scene.'}
          </p>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button
              onClick={this.handleRetry}
              style={{
                padding: '0.75rem 1.5rem',
                background: 'linear-gradient(135deg, #00ffd6 0%, #00a896 100%)',
                color: '#05060d',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Try Again
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '0.75rem 1.5rem',
                background: 'rgba(17, 21, 32, 0.8)',
                color: '#e6f3ff',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

