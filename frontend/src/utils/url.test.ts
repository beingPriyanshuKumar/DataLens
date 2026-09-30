import { describe, it, expect } from "vitest";
import { safeHref } from "./url";

describe("safeHref", () => {
  it("returns null for null/undefined input", () => {
    expect(safeHref(null)).toBe(null);
    expect(safeHref(undefined)).toBe(null);
  });

  it("returns null for non-string input", () => {
    expect(safeHref(42)).toBe(null);
    expect(safeHref({})).toBe(null);
  });

  it("returns null for empty/whitespace strings", () => {
    expect(safeHref("")).toBe(null);
    expect(safeHref("   ")).toBe(null);
  });

  it("allows valid http URLs", () => {
    expect(safeHref("http://example.com")).toBe("http://example.com/");
    expect(safeHref("http://example.com/path?q=1")).toBe(
      "http://example.com/path?q=1"
    );
  });

  it("allows valid https URLs", () => {
    expect(safeHref("https://example.com")).toBe("https://example.com/");
    expect(safeHref("https://example.com/path")).toBe(
      "https://example.com/path"
    );
  });

  it("blocks javascript: scheme", () => {
    expect(safeHref("javascript:alert(1)")).toBe(null);
  });

  it("blocks javascript: with mixed case", () => {
    expect(safeHref("JaVaScRiPt:alert(1)")).toBe(null);
  });

  it("blocks javascript: with tab characters (browser bypass)", () => {
    expect(safeHref("java\tscript:alert(1)")).toBe(null);
  });

  it("blocks javascript: with newlines", () => {
    expect(safeHref("java\nscript:alert(1)")).toBe(null);
  });

  it("blocks data: scheme", () => {
    expect(safeHref("data:text/html,<script>alert(1)</script>")).toBe(null);
  });

  it("blocks vbscript: scheme", () => {
    expect(safeHref("vbscript:msgbox")).toBe(null);
  });

  it("blocks javascript: with leading whitespace", () => {
    expect(safeHref("  javascript:alert(1)")).toBe(null);
  });

  it("returns null for relative paths (not safe for dynamic anchors)", () => {
    expect(safeHref("/relative/path")).toBe(null);
    expect(safeHref("relative/path")).toBe(null);
  });

  it("handles URLs with leading whitespace correctly", () => {
    expect(safeHref("  https://example.com")).toBe("https://example.com/");
  });

  it("blocks file: scheme", () => {
    expect(safeHref("file:///etc/passwd")).toBe(null);
  });

  it("blocks ftp: scheme", () => {
    expect(safeHref("ftp://example.com/file")).toBe(null);
  });
});
