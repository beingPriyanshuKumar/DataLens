interface ConfidenceBarProps {
  value: number;
}

export default function ConfidenceBar({ value }: ConfidenceBarProps) {
  const pct = Math.round(value * 100);
  const hue = value >= 0.7 ? 145 : value >= 0.4 ? 45 : 0;

  return (
    <div className="confidence-bar">
      <div className="confidence-bar__track">
        <div
          className="confidence-bar__fill"
          style={{
            width: `${pct}%`,
            background: `hsl(${hue}, 72%, 52%)`,
          }}
        />
      </div>
      <span className="confidence-bar__label">{pct}%</span>
    </div>
  );
}
