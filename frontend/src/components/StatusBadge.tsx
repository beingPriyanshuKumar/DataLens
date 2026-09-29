interface StatusBadgeProps {
  status: string;
}

const STATUS_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  queued: { bg: "var(--status-queued-bg)", text: "var(--status-queued-text)", dot: "var(--status-queued-dot)" },
  running: { bg: "var(--status-running-bg)", text: "var(--status-running-text)", dot: "var(--status-running-dot)" },
  completed: { bg: "var(--status-completed-bg)", text: "var(--status-completed-text)", dot: "var(--status-completed-dot)" },
  failed: { bg: "var(--status-failed-bg)", text: "var(--status-failed-text)", dot: "var(--status-failed-dot)" },
  cancelling: { bg: "var(--status-cancelling-bg)", text: "var(--status-cancelling-text)", dot: "var(--status-cancelling-dot)" },
  cancelled: { bg: "var(--status-cancelled-bg)", text: "var(--status-cancelled-text)", dot: "var(--status-cancelled-dot)" },
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.queued;
  return (
    <span
      className="status-badge"
      style={{
        background: style.bg,
        color: style.text,
      }}
    >
      <span
        className={`status-dot ${status === "running" ? "status-dot--pulse" : ""}`}
        style={{ background: style.dot }}
      />
      {status}
    </span>
  );
}
