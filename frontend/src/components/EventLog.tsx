import { useEffect, useRef } from "react";
import type { RunEvent } from "../types";
import "./EventLog.css";

interface EventLogProps {
  events: RunEvent[];
  isLive: boolean;
  className?: string;
}

export default function EventLog({
  events,
  isLive,
  className = "",
}: EventLogProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const userScrolledUpRef = useRef(false);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 30;
    userScrolledUpRef.current = !isAtBottom;
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (!userScrolledUpRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [events]);

  const formatTime = (isoString: string): string => {
    try {
      const d = new Date(isoString);
      return d.toTimeString().split(" ")[0];
    } catch {
      return isoString;
    }
  };

  return (
    <div className={`event-log-container ${className}`.trim()}>
      <div className="event-log__header">
        <span className="type-label">EVENT LOG</span>
        <div
          className={`event-log__status ${
            isLive ? "event-log__status--live" : "event-log__status--reconnecting"
          }`}
        >
          {isLive ? "● LIVE" : "○ RECONNECTING"}
        </div>
      </div>
      <div
        className="event-log__scroll"
        ref={scrollRef}
        onScroll={handleScroll}
        role="log"
        aria-label="Run Events Log"
      >
        {events.length === 0 ? (
          <div className="event-log__empty">Waiting for pipeline events…</div>
        ) : (
          events.map((ev) => (
            <div key={ev.id} className="event-log__row">
              <span className="event-log__time">{formatTime(ev.created_at)}</span>
              <span
                className={`event-log__level event-log__level--${ev.level}`}
              >
                {ev.level}
              </span>
              <span className="event-log__message">{ev.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
