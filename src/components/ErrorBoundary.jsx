import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('React ErrorBoundary caught an unhandled error:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#1A1917] text-[#F4F1EA] flex items-center justify-center p-6 font-mono">
          <div className="bg-[#24221F] border-2 border-[#D94E28] max-w-xl w-full p-6 shadow-[8px_8px_0px_0px_rgba(217,78,40,0.5)] space-y-4">
            <div className="flex items-center gap-3 text-[#D94E28]">
              <AlertTriangle className="w-8 h-8 shrink-0 animate-bounce" />
              <div>
                <h1 className="text-base font-bold uppercase tracking-wider text-white">
                  Rendering Safety Guard Activated
                </h1>
                <p className="text-xs text-[#A09B8E]">
                  A UI component encountered an issue, but your SQLite data is safe.
                </p>
              </div>
            </div>

            <div className="bg-[#121110] border border-[#3D3A35] p-3 rounded text-xs text-[#F87171] overflow-x-auto max-h-40">
              {this.state.error?.toString() || 'Unknown rendering error'}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={this.handleReset}
                className="px-4 py-2 bg-[#3D3A35] hover:bg-[#4A4843] text-white text-xs font-bold transition-colors"
              >
                Dismiss & Resume
              </button>
              <button
                onClick={this.handleReload}
                className="px-4 py-2 bg-[#D94E28] hover:bg-[#C4411C] text-white text-xs font-bold flex items-center gap-1.5 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Reload App</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
