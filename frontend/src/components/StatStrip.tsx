import "./StatStrip.css";

export interface StatItem {
  id: string;
  value: string | number;
  label: string;
  variant?: "default" | "highlight" | "alert";
}

interface StatStripProps {
  stats: StatItem[];
  ariaLive?: "polite" | "off";
  className?: string;
}

export default function StatStrip({
  stats,
  ariaLive = "off",
  className = "",
}: StatStripProps) {
  const colClass = stats.length === 5 ? "stat-strip--cols-5" : "stat-strip--cols-4";

  return (
    <div
      className={`stat-strip ${colClass} ${className}`.trim()}
      aria-live={ariaLive}
    >
      {stats.map((item) => (
        <div
          key={item.id}
          className={`stat-strip__cell ${
            item.variant === "highlight"
              ? "stat-strip__cell--highlight"
              : item.variant === "alert"
              ? "stat-strip__cell--alert"
              : ""
          }`.trim()}
        >
          <div className="stat-strip__value">{item.value}</div>
          <div
            className={`stat-strip__label ${
              item.variant === "alert" ? "stat-strip__label--alert" : ""
            }`.trim()}
          >
            {item.variant === "alert" && (
              <span className="stat-strip__asterisk" aria-hidden="true">
                *
              </span>
            )}
            {item.label}
          </div>
        </div>
      ))}
    </div>
  );
}
