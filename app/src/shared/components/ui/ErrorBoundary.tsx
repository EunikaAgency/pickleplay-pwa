import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  isChunkError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, isChunkError: false };

  static getDerivedStateFromError(err: Error): State {
    const isChunkError =
      /dynamically imported module|Failed to fetch/i.test(err.message);
    return { hasError: true, isChunkError };
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    if (this.state.isChunkError) {
      return (
        <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
          <span className="text-5xl">🔄</span>
          <h1 className="mt-4 font-heading text-2xl font-extrabold">
            New version available
          </h1>
          <p className="mt-2 max-w-xs text-base text-on-surface-variant">
            A fresh update was deployed while you were browsing. Reload to get
            the latest build.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-6 inline-flex h-12 items-center rounded-full bg-lime px-8 text-base font-extrabold text-on-surface active:scale-95 transition-transform"
          >
            Reload now
          </button>
        </div>
      );
    }

    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
        <span className="text-5xl">⚠️</span>
        <h1 className="mt-4 font-heading text-2xl font-extrabold">
          Something went wrong
        </h1>
        <p className="mt-2 max-w-xs text-base text-on-surface-variant">
          An unexpected error happened. Try reloading the page.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-6 inline-flex h-12 items-center rounded-full bg-lime px-8 text-base font-extrabold text-on-surface active:scale-95 transition-transform"
        >
          Reload
        </button>
      </div>
    );
  }
}
