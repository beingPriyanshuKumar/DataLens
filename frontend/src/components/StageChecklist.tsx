import type { RunEvent, RunStats } from "../types";
import "./StageChecklist.css";

interface StageChecklistProps {
  status: string;
  stats: RunStats;
  events: RunEvent[];
}

export default function StageChecklist({
  status,
  stats,
  events,
}: StageChecklistProps) {
  const isCompleted = status === "completed";
  const isFailed = status === "failed";
  const isCancelled = status === "cancelled";
  const isDone = isCompleted || isFailed || isCancelled;

  // Derive active stage from events or status
  const lastEvent = events[events.length - 1];
  const lastStep = lastEvent?.step || "init";

  const fetchDone = stats.pages_fetched ?? 0;
  const extractDone = stats.raw_count ?? 0;

  // Find any "reading" or "fetching" url from recent events
  const readingEvent = [...events]
    .reverse()
    .find((e) => e.step === "fetch" || e.step === "extract" || e.data?.url);

  const readingUrl = readingEvent?.data?.url;
  const readingQuery = readingEvent?.data?.query;

  // Define the stages
  const stages = [
    {
      id: "understand",
      label: "Understand",
      isDone: isDone || events.some((e) => e.step === "search" || e.step === "fetch"),
      isActive: !isDone && (lastStep === "init" || lastStep === "preview"),
    },
    {
      id: "search",
      label: "Search",
      isDone: isDone || events.some((e) => e.step === "fetch" || e.step === "extract"),
      isActive: !isDone && lastStep === "search",
    },
    {
      id: "fetch",
      label: fetchDone > 0 ? `Fetch ${fetchDone}` : "Fetch",
      isDone: isDone || events.some((e) => e.step === "extract" || e.step === "dedupe"),
      isActive: !isDone && lastStep === "fetch",
    },
    {
      id: "extract",
      label: extractDone > 0 ? `Extract ${extractDone}` : "Extract",
      isDone: isDone || events.some((e) => e.step === "validate" || e.step === "dedupe"),
      isActive: !isDone && lastStep === "extract",
    },
    {
      id: "verify",
      label: "Verify",
      isDone: isDone || events.some((e) => e.step === "dedupe"),
      isActive: !isDone && lastStep === "verify",
    },
    {
      id: "clean",
      label: "Clean & Dedupe",
      isDone: isCompleted,
      isActive: !isDone && (lastStep === "dedupe" || lastStep === "validate"),
    },
  ];

  return (
    <div className="stage-checklist">
      <div className="stage-checklist__steps">
        {stages.map((st, i) => (
          <span key={st.id} style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
            <span
              className={`stage-item ${
                st.isActive
                  ? "stage-item--active"
                  : st.isDone
                  ? "stage-item--done"
                  : ""
              }`}
            >
              <span className="stage-item__dot" />
              <span>
                {st.label} {st.isDone ? "✓" : ""}
              </span>
            </span>
            {i < stages.length - 1 && <span className="stage-item__divider">·</span>}
          </span>
        ))}
      </div>

      {/* First record metric if proud */}
      {stats.first_record_seconds != null && (
        <div className="stage-timing">
          ⚡ First verified record ready in {stats.first_record_seconds}s
        </div>
      )}

      {/* "Now reading" line during execution */}
      {!isDone && readingUrl && (
        <div className="stage-reading">
          <span className="stage-reading__label">Now Reading:</span>
          <span className="stage-reading__url" title={readingUrl}>
            {readingUrl}
          </span>
          {readingQuery && (
            <span>(found by: <em>{readingQuery}</em>)</span>
          )}
        </div>
      )}
    </div>
  );
}
