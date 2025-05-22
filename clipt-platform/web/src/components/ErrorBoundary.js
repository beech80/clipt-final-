import React, { Component } from 'react';

/**
 * ErrorBoundary Component
 * Catches JavaScript errors anywhere in its child component tree,
 * logs those errors, and displays a fallback UI instead of crashing the whole app.
 * 
 * This component can be used at multiple levels in the component tree to
 * provide more granular error handling and recovery.
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
      lastErrorTimestamp: null,
      errorHistory: [],
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render shows the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Get current time for timestamp
    const now = new Date();
    
    // Update state with error details
    this.setState(prevState => {
      // Create new error entry
      const newError = {
        timestamp: now,
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
      };
      
      // Keep history limited to last 10 errors to prevent memory issues
      const updatedHistory = [...prevState.errorHistory, newError].slice(-10);
      
      return {
        error,
        errorInfo,
        errorCount: prevState.errorCount + 1,
        lastErrorTimestamp: now,
        errorHistory: updatedHistory,
      };
    });
    
    // Log the error to an error reporting service
    this.logErrorToService(error, errorInfo);
  }

  logErrorToService(error, errorInfo) {
    // In production, you would send this to your error reporting service
    // e.g., Sentry, LogRocket, etc.
    console.error('Error caught by ErrorBoundary:', error);
    console.error('Component stack trace:', errorInfo.componentStack);
    
    // Example of how you might log to a service:
    // if (process.env.NODE_ENV === 'production') {
    //   Sentry.captureException(error, { extra: { componentStack: errorInfo.componentStack } });
    // }
  }

  handleReload = () => {
    // Attempt to recover by reloading the component
    this.setState({ 
      hasError: false,
      error: null,
      errorInfo: null,
    });
  }

  handleFullReload = () => {
    // Hard reload the page
    window.location.reload();
  }

  renderErrorDetails() {
    const { error, errorInfo, errorCount, lastErrorTimestamp } = this.state;
    
    // Only show detailed error information in non-production environments
    if (process.env.NODE_ENV === 'production') {
      return null;
    }
    
    return (
      <div className="error-details">
        <h3>Error Details</h3>
        <p><strong>Message:</strong> {error && error.message}</p>
        <p><strong>Count:</strong> This is error #{errorCount} since the app loaded</p>
        <p><strong>Time:</strong> {lastErrorTimestamp && lastErrorTimestamp.toLocaleTimeString()}</p>
        
        <details>
          <summary>Stack Trace</summary>
          <pre>{error && error.stack}</pre>
        </details>
        
        <details>
          <summary>Component Stack</summary>
          <pre>{errorInfo && errorInfo.componentStack}</pre>
        </details>
      </div>
    );
  }

  render() {
    const { hasError } = this.state;
    const { fallback, children, name } = this.props;
    
    if (hasError) {
      // If a custom fallback is provided, use it
      if (fallback) {
        return React.cloneElement(fallback, { 
          onReload: this.handleReload, 
          onFullReload: this.handleFullReload 
        });
      }
      
      // Otherwise, use the default fallback UI
      return (
        <div className="error-boundary-fallback" style={{
          padding: '20px',
          margin: '20px',
          borderRadius: '8px',
          backgroundColor: '#fff8f8',
          border: '1px solid #ffcdd2',
          color: '#d32f2f'
        }}>
          <h2>Something went wrong {name ? `in ${name}` : ''}</h2>
          <p>We've encountered an unexpected error. Our team has been notified.</p>
          
          <div className="error-actions" style={{ marginTop: '20px' }}>
            <button 
              onClick={this.handleReload}
              style={{
                padding: '10px 15px',
                backgroundColor: '#f44336',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                marginRight: '10px',
                cursor: 'pointer'
              }}
            >
              Try Again
            </button>
            <button 
              onClick={this.handleFullReload}
              style={{
                padding: '10px 15px',
                backgroundColor: '#757575',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Reload Page
            </button>
          </div>
          
          {this.renderErrorDetails()}
        </div>
      );
    }
    
    // If there's no error, render children normally
    return children;
  }
}

export default ErrorBoundary;
