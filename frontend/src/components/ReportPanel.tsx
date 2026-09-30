import type { TrustReport, FieldSpec } from "../types";
import "./ReportPanel.css";

interface ReportPanelProps {
  report: TrustReport;
  fields?: FieldSpec[];
}

export default function ReportPanel({ report, fields = [] }: ReportPanelProps) {
  const reqFields = new Set(fields.filter((f) => f.required).map((f) => f.name));

  return (
    <div className="report-panel" id="panel-report" role="tabpanel">
      {/* Title / Description */}
      <div className="report-panel__header">
        <h2 className="report-panel__title">Data Integrity & Trust Report</h2>
        <p className="report-panel__desc">
          Every number is measured and verifiable against source URLs and content snapshots.
          No opaque AI grades.
        </p>
      </div>

      {/* 1. Funnel Section */}
      <div className="report-section">
        <h3 className="report-section__title">Extraction & Verification Funnel</h3>
        <div className="funnel-grid">
          {report.funnel.map((step, idx) => (
            <div key={idx} className="funnel-step">
              <span className="funnel-step__label">{step.label}</span>
              <span className="funnel-step__count">{step.count}</span>
              {step.dropped > 0 && (
                <span className="funnel-step__dropped">
                  −{step.dropped} dropped
                </span>
              )}
              {Object.keys(step.drop_reasons).length > 0 && (
                <div className="funnel-step__reasons">
                  {Object.entries(step.drop_reasons).map(([reason, count]) => (
                    <div key={reason}>
                      {reason.replace(/_/g, " ")}: <strong>{count}</strong>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 2. Trust Signals */}
      <div className="report-section">
        <h3 className="report-section__title">Verifiable Trust Signals</h3>
        <div className="signals-grid">
          {report.trust_signals.map((sig) => {
            const isPercent =
              sig.name === "verification_rate" ||
              sig.name === "corroboration" ||
              sig.name === "source_concentration" ||
              sig.name === "required_completeness";

            const formattedVal = isPercent
              ? `${Math.round(sig.value * 100)}%`
              : sig.value.toFixed(2);

            const formattedThresh = isPercent
              ? `${Math.round(sig.threshold * 100)}%`
              : sig.threshold.toFixed(2);

            return (
              <div key={sig.name} className="signal-card">
                <div className="signal-card__top">
                  <span className="signal-card__label">{sig.label}</span>
                  <span
                    className={`signal-card__badge ${
                      sig.passed
                        ? "signal-card__badge--pass"
                        : "signal-card__badge--warn"
                    }`}
                  >
                    {sig.passed ? "PASS" : "WARN"}
                  </span>
                </div>
                <div className="signal-card__value">{formattedVal}</div>
                <div className="signal-card__meta">
                  <span>
                    Threshold: {sig.name === "source_concentration" ? "≤" : "≥"}{" "}
                    {formattedThresh}
                  </span>
                  <span className="signal-card__formula">{sig.formula}</span>
                </div>
              </div>
            );
          })}

          {/* Measured Precision Card */}
          <div className="signal-card">
            <div className="signal-card__top">
              <span className="signal-card__label">Measured Precision</span>
              <span className="signal-card__badge signal-card__badge--info">
                SAMPLE
              </span>
            </div>
            <div className="signal-card__value">Not measured</div>
            <div className="signal-card__meta">
              <span>Verified human sample via spot-check</span>
              <span className="signal-card__formula">sample correct / sample checked</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Field Completeness */}
      <div className="report-section">
        <h3 className="report-section__title">Field Completeness</h3>
        <div className="completeness-list">
          {report.field_completeness.map((fc) => {
            const isReq = reqFields.has(fc.name);
            const pct = Math.round(fc.share * 100);

            return (
              <div key={fc.name} className="completeness-item">
                <div className="completeness-item__header">
                  <span className="completeness-item__name">
                    {fc.name.replace(/_/g, " ")}
                    {isReq && <span className="completeness-item__req">REQ</span>}
                  </span>
                  <span>
                    {fc.non_null_count}/{fc.total} ({pct}%)
                  </span>
                </div>
                <div className="completeness-bar">
                  <div
                    className="completeness-bar__fill"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Sources Summary */}
      <div className="report-section">
        <h3 className="report-section__title">Sources Summary</h3>
        <div className="sources-summary-grid">
          <div className="summary-cell">
            <span className="summary-cell__label">Fetched</span>
            <span className="summary-cell__val">{report.sources_summary.fetched}</span>
          </div>
          <div className="summary-cell">
            <span className="summary-cell__label">Policy Blocked</span>
            <span className="summary-cell__val">{report.sources_summary.blocked_by_policy}</span>
          </div>
          <div className="summary-cell">
            <span className="summary-cell__label">Robots Disallowed</span>
            <span className="summary-cell__val">{report.sources_summary.blocked_by_robots}</span>
          </div>
          <div className="summary-cell">
            <span className="summary-cell__label">Failed</span>
            <span className="summary-cell__val">{report.sources_summary.failed}</span>
          </div>
          <div className="summary-cell">
            <span className="summary-cell__label">Total Attempted</span>
            <span className="summary-cell__val">{report.sources_summary.total}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
