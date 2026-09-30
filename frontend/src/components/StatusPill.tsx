import "./StatusPill.css";

export type StatusType =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelling"
  | "cancelled"
  | "fetched"
  | "blocked"
  | "skipped";

interface StatusPillProps {
  status: string | null | undefined;
  className?: string;
}

export default function StatusPill({ status, className = "" }: StatusPillProps) {
  const raw = (status || "queued").toLowerCase();

  let normStatus: StatusType = "queued";
  let label = "QUEUED";

  if (raw === "running") {
    normStatus = "running";
    label = "RUNNING";
  } else if (raw === "cancelling") {
    normStatus = "cancelling";
    label = "CANCELLING…";
  } else if (raw === "completed") {
    normStatus = "completed";
    label = "COMPLETED";
  } else if (raw === "failed") {
    normStatus = "failed";
    label = "FAILED";
  } else if (raw === "cancelled") {
    normStatus = "cancelled";
    label = "CANCELLED";
  } else if (raw === "fetched") {
    normStatus = "fetched";
    label = "FETCHED";
  } else if (raw.includes("blocked")) {
    normStatus = "blocked";
    label = "BLOCKED";
  } else if (raw === "skipped") {
    normStatus = "skipped";
    label = "SKIPPED";
  }

  return (
    <span
      className={`status-pill status-pill--${normStatus} ${className}`.trim()}
    >
      {normStatus === "running" && (
        <span className="status-pill__dot" aria-hidden="true" />
      )}
      <span>{label}</span>
    </span>
  );
}
