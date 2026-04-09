import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-4">
          <div className="bg-surface-container-lowest p-10 rounded-xl shadow-[0_12px_32px_rgba(25,28,29,0.04)] max-w-md w-full text-center border-t-4 border-error">
            <span className="material-symbols-outlined text-4xl text-error mb-4">error</span>
            <h1 className="text-xl font-bold text-on-surface mb-2">Ha ocurrido un error</h1>
            <p className="text-on-surface-variant text-sm mb-6">
              Lo sentimos, ha ocurrido un problema inesperado. Por favor, intenta recargar la página.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-primary text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
            >
              Recargar página
            </button>
            {this.state.error && (
              <div className="mt-6 p-4 bg-error-container text-on-error-container text-xs rounded text-left overflow-auto max-h-32">
                {this.state.error.message}
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children as React.ReactNode;
  }
}
