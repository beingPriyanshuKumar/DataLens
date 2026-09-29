import { useEffect, useRef, useState, useCallback } from "react";
import { createEventSource } from "../api";
import type { RunEvent } from "../types";

export function useRunEvents(
  runId: string | undefined,
  isActive: boolean
) {
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [isDone, setIsDone] = useState(false);
  const sourceRef = useRef<EventSource | null>(null);
  const cursorRef = useRef(0);

  const reset = useCallback(() => {
    setEvents([]);
    setIsDone(false);
    cursorRef.current = 0;
  }, []);

  useEffect(() => {
    if (!runId || !isActive) return;

    const es = createEventSource(runId, cursorRef.current);
    sourceRef.current = es;

    es.addEventListener("log", (e: MessageEvent) => {
      const event: RunEvent = JSON.parse(e.data);
      cursorRef.current = event.id;
      setEvents((prev) => [...prev, event]);
    });

    es.addEventListener("done", () => {
      setIsDone(true);
      es.close();
    });

    es.onerror = () => {
      es.close();
    };

    return () => {
      es.close();
      sourceRef.current = null;
    };
  }, [runId, isActive]);

  return { events, isDone, reset };
}
