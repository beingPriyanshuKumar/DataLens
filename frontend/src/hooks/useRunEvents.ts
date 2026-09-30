import { useEffect, useRef, useState, useCallback } from "react";
import { createEventSource } from "../api";
import type { RunEvent } from "../types";

const MAX_RECONNECT_ATTEMPTS = 5;

export function useRunEvents(
  runId: string | undefined,
  isActive: boolean,
  onRecordsUpdated?: (data: any) => void
) {
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [isDone, setIsDone] = useState(false);
  const sourceRef = useRef<EventSource | null>(null);
  const cursorRef = useRef(0);
  const cbRef = useRef(onRecordsUpdated);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef(0);
  const isCancelledRef = useRef(false);

  useEffect(() => {
    cbRef.current = onRecordsUpdated;
  }, [onRecordsUpdated]);

  const reset = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    retryCountRef.current = 0;
    setEvents([]);
    setIsDone(false);
    cursorRef.current = 0;
  }, []);

  useEffect(() => {
    if (!runId || !isActive) {
      if (sourceRef.current) {
        sourceRef.current.close();
        sourceRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      return;
    }

    isCancelledRef.current = false;

    function connect() {
      if (isCancelledRef.current) return;

      const es = createEventSource(runId!, cursorRef.current);
      sourceRef.current = es;

      es.onopen = () => {
        retryCountRef.current = 0;
      };

      es.addEventListener("log", (e: MessageEvent) => {
        try {
          const event: RunEvent = JSON.parse(e.data);
          cursorRef.current = Math.max(cursorRef.current, event.id);
          setEvents((prev) => [...prev, event]);
          retryCountRef.current = 0;
        } catch (err) {
          console.error("Failed to parse log event", err);
        }
      });

      es.addEventListener("records_updated", (e: MessageEvent) => {
        try {
          const payload = JSON.parse(e.data);
          if (cbRef.current) cbRef.current(payload);
        } catch {
          if (cbRef.current) cbRef.current({});
        }
      });

      es.addEventListener("done", () => {
        setIsDone(true);
        if (sourceRef.current) {
          sourceRef.current.close();
          sourceRef.current = null;
        }
      });

      es.onerror = () => {
        if (sourceRef.current) {
          sourceRef.current.close();
          sourceRef.current = null;
        }

        if (isCancelledRef.current) return;

        // Attempt reconnection if not exceeded max retries
        if (retryCountRef.current < MAX_RECONNECT_ATTEMPTS) {
          const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 10000);
          retryCountRef.current += 1;
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        } else {
          console.warn("Max EventSource reconnect attempts reached for run", runId);
        }
      };
    }

    connect();

    return () => {
      isCancelledRef.current = true;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (sourceRef.current) {
        sourceRef.current.close();
        sourceRef.current = null;
      }
    };
  }, [runId, isActive]);

  return { events, isDone, reset };
}

