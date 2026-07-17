import { afterEach, describe, expect, it, vi } from "vitest";
import { formatBrowserConsole, formatBrowserLevelPrefix } from "./browser";
import { getTerminalWidth } from "./transports";
import type { FormatOptions, LogRecord, ResolvedFormatOptions } from "./types";
import { isBrowserEnv } from "./utils/env";
import { resolveFormatOptions } from "./utils/format-options";

function withFormat(overrides: FormatOptions = {}): ResolvedFormatOptions {
  return resolveFormatOptions(overrides);
}

const PRETTY = withFormat({ pretty: true });

const FORMAT_TIME_OFF = withFormat({
  time: false,
});

const PRETTY_TIME_OFF = withFormat({
  pretty: true,
  time: false,
});

const sampleRecord: LogRecord = {
  timestamp: "2026-07-15T00:00:00.000Z",
  level: "info",
  name: "cache",
  message: "Cache hit",
  meta: { key: "users:1" },
};

function countStyleArgs(args: unknown[]): number {
  return args.length - 1;
}

function countStyleMarkers(format: string): number {
  return (format.match(/%c/g) ?? []).length;
}

describe("isBrowserEnv", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns true when process is undefined", () => {
    vi.stubGlobal("process", undefined);
    expect(isBrowserEnv()).toBe(true);
  });

  it("returns true when process.stdout is unavailable", () => {
    vi.stubGlobal("process", {});
    expect(isBrowserEnv()).toBe(true);
  });
});

describe("getTerminalWidth", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns 80 when process.stdout is unavailable", () => {
    vi.stubGlobal("process", {});
    expect(getTerminalWidth()).toBe(80);
  });
});

describe("formatBrowserConsole", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("formats pretty info output with matching %c markers and CSS args", () => {
    const args = formatBrowserConsole(sampleRecord, PRETTY);
    const [format, ...styles] = args;

    expect(typeof format).toBe("string");
    expect(format).toContain("i");
    expect(format).toContain("[cache]");
    expect(format).toContain("Cache hit");
    expect(format).toContain("00:00:00");
    expect(countStyleMarkers(format as string)).toBe(countStyleArgs(args));
    expect(styles.some((style) => String(style).includes("color:"))).toBe(true);
  });

  it("resets browser console styles for unstyled segments with empty %c args", () => {
    const args = formatBrowserConsole(sampleRecord, PRETTY);
    const [format, ...styles] = args;

    expect(countStyleMarkers(format as string)).toBe(styles.length);
    expect(styles.some((style) => style === "")).toBe(true);
    expect(styles.some((style) => String(style).includes("color:"))).toBe(true);
  });

  it("formats warn as a badge with background styling", () => {
    const record: LogRecord = {
      ...sampleRecord,
      level: "warn",
      message: "Slow query",
    };
    const args = formatBrowserConsole(record, PRETTY);
    const [format, ...styles] = args;

    expect(format).toContain("WARN");
    expect(styles.some((style) => String(style).includes("background:"))).toBe(
      true
    );
  });

  it("colors warn, error, and fatal glyphs when symbol kind is selected", () => {
    vi.stubEnv("WT_SESSION", "1");
    vi.stubEnv("TERM", "xterm-256color");

    const warn = formatBrowserLevelPrefix("warn", "symbol");
    const error = formatBrowserLevelPrefix("error", "symbol");
    const fatal = formatBrowserLevelPrefix("fatal", "symbol");

    expect(warn[0]).toContain("⚠\uFE0E");
    expect(warn[0]).not.toContain("WARN");
    expect(
      warn.slice(1).some((style) => String(style).includes("#fde047"))
    ).toBe(true);
    expect(
      warn.slice(1).some((style) => String(style).includes("background:"))
    ).toBe(false);

    expect(error[0]).toContain("✖\uFE0E");
    expect(error[0]).not.toContain("ERROR");
    expect(
      error.slice(1).some((style) => String(style).includes("#ef4444"))
    ).toBe(true);
    expect(
      error.slice(1).some((style) => String(style).includes("background:"))
    ).toBe(false);

    expect(fatal[0]).toContain("☠\uFE0E");
    expect(fatal[0]).not.toContain("FATAL");
    expect(
      fatal.slice(1).some((style) => String(style).includes("#7f1d1d"))
    ).toBe(true);
    expect(
      fatal.slice(1).some((style) => String(style).includes("background:"))
    ).toBe(false);
  });

  it("formats trace with a muted symbol style", () => {
    vi.stubEnv("WT_SESSION", "1");
    vi.stubEnv("TERM", "xterm-256color");

    const record: LogRecord = {
      ...sampleRecord,
      level: "trace",
      message: "Entering handler",
      meta: {},
    };
    const args = formatBrowserConsole(record, PRETTY);
    const [format, ...styles] = args;

    expect(format).toContain("·");
    expect(format).not.toContain("TRACE");
    expect(format).toContain("Entering handler");
    expect(countStyleMarkers(format as string)).toBe(countStyleArgs(args));
    expect(styles.some((style) => String(style).includes("#9ca3af"))).toBe(
      true
    );
  });

  it("formats plain trace and fatal labels", () => {
    const trace = formatBrowserConsole(
      {
        ...sampleRecord,
        level: "trace",
        message: "Entering handler",
        meta: {},
      },
      FORMAT_TIME_OFF
    );
    const fatal = formatBrowserConsole(
      {
        ...sampleRecord,
        level: "fatal",
        message: "Unrecoverable failure",
        meta: {},
      },
      FORMAT_TIME_OFF
    );

    expect(trace).toEqual(["TRACE   [cache] Entering handler"]);
    expect(fatal).toEqual(["FATAL   [cache] Unrecoverable failure"]);
  });

  it("formats plain output as a single unstyled line", () => {
    const args = formatBrowserConsole(sampleRecord);
    expect(args).toHaveLength(1);
    expect(args[0]).toBe(
      'INFO    [cache] Cache hit {"key":"users:1"} 00:00:00'
    );
  });

  it("omits timestamp when disabled", () => {
    const args = formatBrowserConsole(sampleRecord, PRETTY_TIME_OFF);
    const [format] = args;
    expect(format).not.toContain("00:00:00");
  });

  it("escapes literal percent signs in message text", () => {
    const record: LogRecord = {
      ...sampleRecord,
      message: "100% complete",
    };
    const [format] = formatBrowserConsole(record, PRETTY);
    expect(format).toContain("100%% complete");
  });

  it("renders error stack frames on additional styled lines", () => {
    const error = new Error("connection refused");
    error.stack =
      "Error: connection refused\n    at connect (db.ts:42:11)\n    at db.ts:10:5";
    const record: LogRecord = {
      ...sampleRecord,
      level: "error",
      message: "Database unavailable",
      meta: { err: error },
    };

    const args = formatBrowserConsole(record, PRETTY);
    const [format, ...styles] = args;

    expect(format).toContain("ERROR");
    expect(format).toContain("[cache]");
    expect(format).toContain("Database unavailable");
    expect(format).toContain("connection refused");
    expect(format).toContain("at ");
    expect(format).toContain("connect");
    expect(format).toContain("db.ts:42:11");
    expect(format).toContain("db.ts:10:5");
    expect(countStyleMarkers(format as string)).toBe(countStyleArgs(args));
    expect(styles.some((style) => String(style).includes("color:"))).toBe(true);
    expect(styles.some((style) => String(style).includes("#00d7af"))).toBe(
      true
    );
    expect(styles.some((style) => String(style).includes("#e5e7eb"))).toBe(
      true
    );
  });

  it("renders fatal stack frames with a deep-red badge", () => {
    const error = new Error("process crashed");
    error.stack =
      "Error: process crashed\n    at bootstrap (server.ts:8:3)\n    at main (server.ts:1:1)";
    const record: LogRecord = {
      ...sampleRecord,
      level: "fatal",
      message: "Unrecoverable failure",
      meta: { err: error },
    };

    const args = formatBrowserConsole(record, PRETTY);
    const [format, ...styles] = args;

    expect(format).toContain("FATAL");
    expect(format).toContain("Unrecoverable failure");
    expect(format).toContain("process crashed");
    expect(format).toContain("at ");
    expect(format).toContain("bootstrap");
    expect(format).toContain("server.ts:8:3");
    expect(countStyleMarkers(format as string)).toBe(countStyleArgs(args));
    expect(styles.some((style) => String(style).includes("#7f1d1d"))).toBe(
      true
    );
  });

  it("keeps multiline messages on indented continuation lines", () => {
    const record: LogRecord = {
      ...sampleRecord,
      message: "first line\nsecond line",
      meta: {},
    };
    const [format] = formatBrowserConsole(record, PRETTY);
    expect(format).toContain("first line");
    expect(format).toContain("\n  second line");
  });

  it("preserves non-frame stack detail lines", () => {
    const error = new Error("boom");
    error.stack =
      "Error: boom\nCaused by: timeout\n    at connect (db.ts:42:11)";
    const record: LogRecord = {
      ...sampleRecord,
      level: "error",
      message: "boom",
      meta: { err: error },
    };
    const [format] = formatBrowserConsole(record, PRETTY);
    expect(format).toContain("Caused by: timeout");
    expect(format).toContain("at ");
    expect(format).toContain("connect");
  });

  it("omits meta and name when format options disable them", () => {
    const args = formatBrowserConsole(
      sampleRecord,
      withFormat({ pretty: true, meta: false, name: false })
    );
    const [format] = args;
    expect(format).not.toContain("[cache]");
    expect(format).not.toContain("users:1");
    expect(format).toContain("Cache hit");
  });

  it("omits stack frames when stack is false", () => {
    const error = new Error("connection refused");
    error.stack = "Error: connection refused\n    at connect (db.ts:42:11)";
    const record: LogRecord = {
      ...sampleRecord,
      level: "error",
      message: "Database unavailable",
      meta: { err: error },
    };
    const [format] = formatBrowserConsole(
      record,
      withFormat({ pretty: true, stack: false })
    );
    expect(format).toContain("Database unavailable");
    expect(format).toContain("connection refused");
    expect(format).not.toContain("at ");
    expect(format).not.toContain("db.ts:42:11");
  });

  it("omits CSS styles when colors is false", () => {
    const args = formatBrowserConsole(
      sampleRecord,
      withFormat({ pretty: true, colors: false })
    );
    expect(args).toHaveLength(1);
    expect(String(args[0])).not.toContain("%c");
  });

  it("applies per-level symbol and label overrides", () => {
    vi.stubEnv("WT_SESSION", "1");
    vi.stubEnv("TERM", "xterm-256color");

    const args = formatBrowserConsole(
      sampleRecord,
      withFormat({
        pretty: true,
        levels: {
          info: {
            symbol: "★",
            fallbackSymbol: "*",
            label: "NOTE",
            kind: "symbol",
          },
        },
      })
    );
    const [format] = args;
    expect(format).toContain("★");
    expect(format).not.toContain("NOTE");
    expect(format).toContain("Cache hit");
  });

  it("pads plain labels using the longest effective label", () => {
    const args = formatBrowserConsole(
      sampleRecord,
      withFormat({
        levels: {
          info: { label: "INFORMATION" },
        },
      })
    );
    expect(args[0]).toBe(
      'INFORMATION [cache] Cache hit {"key":"users:1"} 00:00:00'
    );
  });
});
