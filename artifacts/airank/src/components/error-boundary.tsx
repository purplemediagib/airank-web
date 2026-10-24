import {
  Component,
  type ComponentType,
  type ErrorInfo,
  type ReactNode,
} from 'react';

export interface ErrorFallbackProps {
  error: Error;
  resetError: () => void;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  FallbackComponent?: ComponentType<ErrorFallbackProps>;
  /** Changing this clears a caught error. Pass the route to recover on navigation. */
  resetKey?: unknown;
}

interface ErrorBoundaryState {
  error: Error | null;
}

function toError(value: unknown): Error {
  if (value instanceof Error) {
    return value;
  }
  if (typeof value === 'string') {
    return new Error(value);
  }
  try {
    return new Error(JSON.stringify(value));
  } catch {
    return new Error(String(value));
  }
}

const ROOT_COPY = {
  fi: { title: 'Jotain meni pieleen', body: 'Sovellusta ei voitu näyttää. Tietojasi ei ole muutettu.', retry: 'Yritä uudelleen' },
  en: { title: 'Something went wrong', body: 'The app could not be displayed. Your data has not been changed.', retry: 'Try again' },
};

/** Root fallback: no providers available, so copy follows document lang. Never shows internal error messages. */
function DefaultFallback({ resetError }: ErrorFallbackProps) {
  const c = document.documentElement.lang === 'en' ? ROOT_COPY.en : ROOT_COPY.fi;
  return (
    <div role="alert" className="flex min-h-[100dvh] w-full items-center justify-center bg-canvas p-6">
      <div className="w-full max-w-lg rounded-[12px] border border-line bg-white p-6 text-center">
        <h1 className="text-xl font-semibold text-ink">{c.title}</h1>
        <p className="mt-2 text-sm text-muted-ink">{c.body}</p>
        <button type="button" onClick={resetError} className="mt-4 h-10 rounded-lg bg-navy px-4 text-sm font-medium text-white hover:bg-ink focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-cyan">
          {c.retry}
        </button>
      </div>
    </div>
  );
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { error: toError(error) };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error(
      'ErrorBoundary caught an error:',
      toError(error),
      info.componentStack,
    );
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    if (
      this.state.error !== null &&
      prevProps.resetKey !== this.props.resetKey
    ) {
      this.resetError();
    }
  }

  resetError = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    const { error } = this.state;
    if (error === null) {
      return this.props.children;
    }
    const Fallback = this.props.FallbackComponent ?? DefaultFallback;
    return <Fallback error={error} resetError={this.resetError} />;
  }
}
