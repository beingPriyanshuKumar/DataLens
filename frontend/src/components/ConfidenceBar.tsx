import type { CSSProperties } from "react";
import "./ConfidenceBar.css";

interface ConfidenceBarProps {
  value: number;
  className?: string;
}

export default function ConfidenceBar({ value, className = "" }: ConfidenceBarProps) {
  const isLow = value < 0.5;
  const formatted = value.toFixed(2);
  const pct = Math.min(100, Math.max(0, Math.round(value * 100)));

  return (
    <div
      className={`confidence-bar ${isLow ? "confidence-bar--low" : ""} ${className}`.trim()}
      title={`Confidence: ${formatted}`}
    >
      <span className="confidence-bar__val">{formatted}</span>
      <div className="confidence-bar__track" aria-hidden="true">
        <div
          className="confidence-bar__fill"
          style={{ "--progress": `${pct}%` } as CSSProperties}
        />
      </div>
    </div>
  );
}
