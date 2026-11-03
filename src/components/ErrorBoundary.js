import { Component } from 'react';

/**
 * React Error Boundary — catches crashes in any descendant component
 * (e.g. "null is not iterable" from transient bad state / stale bundle)
 * and shows a friendly fallback UI with Reload button instead of
 * white-screening the whole app and showing <noscript> content.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary] Component crashed:', error, info);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    if (typeof window !== 'undefined') {
      // Hard reload to flush any stale webpack hot-reload bundle caches.
      // location.reload(true) is deprecated but still widely supported;
      // fall back to location.href reset to bust cache.
      try {
        window.location.reload();
      } catch {
        window.location.href = window.location.pathname;
      }
    }
  };

  handleDismiss = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      const msg = this.state.error?.message || String(this.state.error || 'Unknown error');
      return (
        <div
          style={{
            maxWidth: 640,
            margin: '40px auto',
            padding: '28px 32px',
            borderRadius: 16,
            border: '2px solid #e74c3c',
            background:
              'linear-gradient(180deg, #fff5f5 0%, #ffffff 60%)',
            boxShadow: '0 8px 32px rgba(231, 76, 60, 0.15)',
            fontFamily:
              '"Segoe UI", Roboto, system-ui, -apple-system, sans-serif',
          }}
        >
          <div style={{ fontSize: 36, marginBottom: 8 }}>⚠️</div>
          <h2
            style={{
              color: '#922b21',
              marginTop: 0,
              marginBottom: 8,
              fontSize: 22,
            }}
          >
            Something went wrong in this page
          </h2>
          <p style={{ color: '#566573', margin: '0 0 16px', fontSize: 14 }}>
            A component ran into an error. Your login session and data are still safe.
            Reload the page to try again — this typically resolves cached stale bundle
            code from the dev server after a source-file edit.
          </p>
          <div
            style={{
              padding: '10px 14px',
              background: '#fdecea',
              borderRadius: 10,
              marginBottom: 18,
              fontSize: 13,
              color: '#7b241c',
              border: '1px solid #f5c6cb',
              fontFamily:
                'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
              wordBreak: 'break-word',
            }}
          >
            <strong>Error:</strong> {msg}
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              onClick={this.handleReload}
              style={{
                padding: '10px 20px',
                background: '#e74c3c',
                color: '#fff',
                border: 'none',
                borderRadius: 10,
                fontWeight: 600,
                fontSize: 14,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(231,76,60,0.3)',
              }}
            >
              🔄 Reload Page
            </button>
            <button
              onClick={this.handleDismiss}
              style={{
                padding: '10px 20px',
                background: '#fff',
                color: '#2c3e50',
                border: '1px solid #d5dbdb',
                borderRadius: 10,
                fontWeight: 500,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              Dismiss (try continue)
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
