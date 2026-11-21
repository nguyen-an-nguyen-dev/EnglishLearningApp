import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string | null;
}

/**
 * Last-resort UI boundary. A broken render should not leave the whole app as a
 * blank page; the learner gets a reload action and the error is logged once.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, message: null };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : 'Unknown UI error',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('React render error:', error.message, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div role="alert" style={{ maxWidth: 520, margin: '80px auto', padding: 24, fontFamily: 'system-ui' }}>
        <h1 style={{ fontSize: 22, marginBottom: 8 }}>Trang này gặp lỗi</h1>
        <p style={{ color: '#555', lineHeight: 1.6 }}>
          Dữ liệu học tập của bạn vẫn an toàn. Hãy tải lại trang để tiếp tục.
        </p>
        <button type="button" onClick={() => window.location.reload()} style={{ marginTop: 12, padding: '10px 16px' }}>
          Tải lại trang
        </button>
      </div>
    );
  }
}
