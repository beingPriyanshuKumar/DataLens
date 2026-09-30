import type { DiagnosticItem } from "../types";
import "./DiagnosticBanner.css";

interface DiagnosticBannerProps {
  diagnostics: DiagnosticItem[];
  onActionClick?: (action: string) => void;
}

export default function DiagnosticBanner({
  diagnostics,
  onActionClick,
}: DiagnosticBannerProps) {
  if (!diagnostics || diagnostics.length === 0) return null;

  const hasWarning = diagnostics.some((d) => d.severity === "warning");

  return (
    <div
      className={`diagnostic-banner ${
        hasWarning ? "diagnostic-banner--warning" : "diagnostic-banner--info"
      }`}
      role="alert"
    >
      {diagnostics.map((diag, idx) => (
        <div key={idx} className="diagnostic-item">
          <div className="diagnostic-item__content">
            <div className="diagnostic-item__title">
              <span>{diag.severity === "warning" ? "⚠️ DIAGNOSTIC NOTICE" : "ℹ️ INSIGHT"}</span>
            </div>
            <div className="diagnostic-item__message">{diag.message}</div>
          </div>
          {diag.action && (
            <button
              type="button"
              className="diagnostic-item__action"
              onClick={() => onActionClick && onActionClick(diag.action!)}
            >
              {diag.action}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
