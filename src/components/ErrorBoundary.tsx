"use client";

import { Component, type ReactNode } from "react";

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    // Surface it so the user can copy it back to us.
    console.error("Resplice boundary:", error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="rounded-xl border border-[#7a2230] bg-[#2a0f14] p-4 text-sm text-[#ffb4b4]">
          <strong className="block text-[#ff6b6b]">
            Render error (diagnostic):
          </strong>
          <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap text-xs">
            {this.state.error.stack || this.state.error.message}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}
