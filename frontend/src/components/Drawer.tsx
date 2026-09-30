import { useEffect, useRef } from "react";
import Button from "./Button";
import ConfidenceBar from "./ConfidenceBar";
import type { EvidenceDetail, RecordDetail } from "../types";
import "./Drawer.css";

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  record: RecordDetail | null;
  evidence: EvidenceDetail[];
  titleField?: string;
}

export default function Drawer({
  isOpen,
  onClose,
  record,
  evidence,
  titleField,
}: DrawerProps) {
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const drawerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement | null;
      closeButtonRef.current?.focus();

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onClose();
        } else if (e.key === "Tab" && drawerRef.current) {
          // Trap focus inside drawer
          const focusables = drawerRef.current.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          if (focusables.length === 0) return;
          const first = focusables[0];
          const last = focusables[focusables.length - 1];

          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      };

      document.addEventListener("keydown", handleKeyDown);
      return () => {
        document.removeEventListener("keydown", handleKeyDown);
        if (previousFocusRef.current) {
          previousFocusRef.current.focus();
        }
      };
    }
  }, [isOpen, onClose]);

  if (!isOpen || !record) return null;

  const data = record.data || {};
  const firstKey = titleField || Object.keys(data)[0] || "Record Details";
  const title = String(data[firstKey] ?? "Record Details");

  const domainFromUrl = (url: string | null | undefined): string => {
    if (!url) return "";
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  };

  return (
    <div
      className="drawer-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-title"
    >
      <div className="drawer" ref={drawerRef}>
        {/* Header */}
        <div className="drawer__header">
          <h2 id="drawer-title" className="drawer__title" title={title}>
            {title}
          </h2>
          <Button
            ref={closeButtonRef}
            variant="ghost"
            onClick={onClose}
            aria-label="Close record details"
          >
            CLOSE ✕
          </Button>
        </div>

        {/* Section 1: Fields */}
        <div className="drawer__section">
          <div className="drawer__section-title">FIELDS</div>
          <dl className="drawer__dl">
            {Object.entries(data).map(([key, val]) => (
              <div key={key} className="drawer__field-group">
                <dt className="drawer__dt">{key.replace(/_/g, " ")}</dt>
                <dd className="drawer__dd">{val != null ? String(val) : "—"}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Section 2: Confidence */}
        <div className="drawer__section">
          <div className="drawer__section-title">CONFIDENCE</div>
          <ConfidenceBar value={record.confidence} />
          {record.flags && record.flags.length > 0 && (
            <ul className="drawer__flags" aria-label="Validation flags">
              {record.flags.map((flag, idx) => (
                <li key={idx} className="drawer__flag-item">
                  <span className="drawer__flag-star" aria-hidden="true">*</span>
                  {flag}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Section 3: Evidence */}
        <div className="drawer__section">
          <div className="drawer__section-title">
            EVIDENCE ({evidence.length})
          </div>
          {evidence.length === 0 ? (
            <div className="type-small" style={{ color: "var(--color-ink-muted)" }}>
              No verbatim evidence snippets recorded for this item.
            </div>
          ) : (
            <div className="drawer__evidence-list">
              {evidence.map((ev, idx) => {
                const domain = domainFromUrl(ev.source_url);
                return (
                  <div key={ev.id || idx} className="drawer__evidence-item">
                    <blockquote className="drawer__evidence-quote">
                      "{ev.snippet}"
                    </blockquote>
                    <div className="drawer__evidence-source">
                      {domain && (
                        <span className="drawer__evidence-domain">{domain}</span>
                      )}
                      {ev.source_url && (
                        <a
                          href={ev.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="drawer__evidence-url"
                        >
                          {ev.source_url}
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
