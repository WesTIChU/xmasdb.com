import React from 'react';

interface AppErrorBoundaryState {
  hasError: boolean;
}

export class AppErrorBoundary extends React.Component<React.PropsWithChildren, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('XmasDB application rendering error', error, info);
  }

  private reload = (): void => {
    window.location.reload();
  };

  render(): React.ReactNode {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="min-h-screen flex items-center justify-center bg-[#FAF7F2] px-6 text-center text-[#23211E]">
        <section aria-labelledby="app-error-heading" className="max-w-md">
          <h1 id="app-error-heading" className="font-heading text-2xl font-semibold text-[#1A3D2F] sm:text-3xl">
            XmasDB needs a refresh
          </h1>
          <p className="mt-3 font-body text-base leading-relaxed text-[#736B63]">
            This page could not finish loading. Refresh to try again.
          </p>
          <button
            type="button"
            onClick={this.reload}
            className="mt-6 rounded border border-[#DCD3C7] bg-[#FAF7F2] px-4 py-2 font-sans-clean text-sm text-[#1A3D2F] hover:bg-[#EFE8DD]"
          >
            Refresh page
          </button>
        </section>
      </main>
    );
  }
}
