import { Component, type ErrorInfo, type ReactNode } from "react";
import Button from "./Button";
import SparkleIcon from "./SparkleIcon";
import "./ErrorBoundary.css";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an unhandled error:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  private handleGoHome = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = "/";
  };

  public override render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="error-boundary">
          <div className="error-boundary__card">
            <div className="error-boundary__header">
              <SparkleIcon size={28} color="var(--color-red)" />
              <h2 className="error-boundary__title">Application Error</h2>
            </div>
            <p className="error-boundary__desc">
              Something went wrong while rendering this view. You can reload the page or return to the dashboard.
            </p>
            {this.state.error?.message && (
              <pre className="error-boundary__details">
                {this.state.error.message}
              </pre>
            )}
            <div className="error-boundary__actions">
              <Button variant="primary" onClick={this.handleReset}>
                Reload Page
              </Button>
              <Button variant="secondary" onClick={this.handleGoHome}>
                Return Home
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
