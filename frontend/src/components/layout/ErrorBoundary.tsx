import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { ShieldAlert } from 'lucide-react';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in Map component:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="w-full h-[520px] rounded-3xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-2xl flex items-center justify-center p-6">
          <div className="text-center max-w-md px-6 py-6 bg-slate-900/95 border border-slate-800 rounded-3xl shadow-2xl backdrop-blur-md">
            <ShieldAlert className="h-10 w-10 text-rose-500 mx-auto mb-3 animate-pulse" />
            <h4 className="text-sm font-bold text-white uppercase tracking-wider text-slate-100">Map Interface Error</h4>
            <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
              The map interface encountered a runtime error:
            </p>
            <p className="text-[10px] text-rose-400 mt-2 font-mono bg-slate-950 p-3 rounded-xl text-left break-words overflow-auto max-h-32 mb-4 border border-slate-850">
              {this.state.error?.message || this.state.error?.toString() || 'Unknown runtime error'}
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider transition-colors shadow-lg cursor-pointer"
            >
              Retry Load
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
