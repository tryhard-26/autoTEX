import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('AutoTEX ErrorBoundary caught an unhandled error:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#121316] text-neutral-200 p-6 font-mono select-text">
          <div className="max-w-2xl w-full bg-[#181920] border border-rose-500/40 rounded-lg p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertTriangle size={24} />
              <h1 className="text-sm font-semibold uppercase tracking-wider">
                Application Error in AutoTEX
              </h1>
            </div>

            <p className="text-xs text-neutral-400 leading-relaxed">
              A runtime component error occurred. The full error details are displayed below for debugging:
            </p>

            <div className="bg-[#101115] border border-[#262833] rounded p-3 text-xs text-rose-300 overflow-x-auto whitespace-pre-wrap max-h-48 font-mono">
              {this.state.error?.toString()}
            </div>

            {this.state.errorInfo && (
              <details className="text-[11px] text-neutral-400">
                <summary className="cursor-pointer hover:text-neutral-200 mb-1">
                  Component Stack Trace
                </summary>
                <div className="bg-[#101115] border border-[#262833] rounded p-2 text-neutral-400 overflow-x-auto whitespace-pre-wrap max-h-36">
                  {this.state.errorInfo.componentStack}
                </div>
              </details>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={async () => {
                  const details = `AutoTEX Application Error:\n${this.state.error?.toString()}\n\nStack:\n${this.state.errorInfo?.componentStack || ''}`;
                  await navigator?.clipboard?.writeText(details).catch(() => {});
                  alert('Error details copied to clipboard');
                }}
                className="px-3 py-1.5 rounded bg-[#222430] hover:bg-[#2c2f3e] text-neutral-300 text-xs font-medium flex items-center gap-1.5 transition-colors border border-[#2b2e3d]"
              >
                <span>Copy Error Details</span>
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium flex items-center gap-1.5 transition-colors"
              >
                <RefreshCw size={12} />
                <span>Reload Page</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
