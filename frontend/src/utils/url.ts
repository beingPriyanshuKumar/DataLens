/**
 * Sanitize a URL value for use in anchor href attributes.
 *
 * Only allows http: and https: schemes. Returns null for dangerous
 * schemes like javascript:, data:, vbscript:, or any malformed input.
 * This prevents XSS via scraped URLs containing executable schemes.
 */
export function safeHref(value: unknown): string | null {
  if (value == null || typeof value !== "string") return null;

  // Trim and strip control characters (tabs, newlines) that browsers
  // silently strip from schemes, enabling bypass like "java\tscript:"
  const cleaned = value.replace(/[\t\n\r\0]/g, "").trim();
  if (!cleaned) return null;

  try {
    const url = new URL(cleaned);
    const protocol = url.protocol.toLowerCase();
    if (protocol === "http:" || protocol === "https:") {
      return url.href;
    }
    return null;
  } catch {
    // Relative URLs or invalid strings — not safe for dynamic anchors
    return null;
  }
}
