import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  formatJson,
  formatLevelPrefix,
  formatPlain,
  formatPretty,
  formatTime,
  resolveTransports,
} from "./transports";
import type { FormatOptions, LogRecord, ResolvedFormatOptions } from "./types";
import { createColors } from "./utils/colors";
import {
  MIN_ALIGN_COLUMNS,
  padToRight,
  stringWidth,
  stripAnsi,
} from "./utils/display";
import { resolveFormatOptions } from "./utils/format-options";

function withFormat(overrides: FormatOptions = {}): ResolvedFormatOptions {
  return resolveFormatOptions(overrides);
}

const FORMAT_TIME_OFF = withFormat({
  time: false,
});

const FORMAT_TIME_ISO = withFormat({
  time: { enabled: true, format: "iso", timezone: "utc" },
});

const FORMAT_TIME_UTC_STRING = withFormat({
  time: { enabled: true, format: "utcString", timezone: "utc" },
});

const FORMAT_TIME_TIME12 = withFormat({
  time: { enabled: true, format: "time12", timezone: "utc" },
});

const sampleRecord: LogRecord = {
  timestamp: "2026-07-15T00:00:00.000Z",
  level: "info",
  name: "cache",
  message: "Cache hit",
  meta: { zKey: 1, aKey: "alpha" },
};

const TERMINAL_WIDTH = 100;
const DIM_TIME = "\x1b[2m00:00:00\x1b[22m";
const ORIGINAL_PLATFORM = process.platform;
const ORIGINAL_STDOUT_COLUMNS = Object.getOwnPropertyDescriptor(
  process.stdout,
  "columns"
);

function mockTerminalWidth(columns: number): void {
  Object.defineProperty(process.stdout, "columns", {
    configurable: true,
    value: columns,
  });
}

function restoreTerminalWidth(): void {
  if (ORIGINAL_STDOUT_COLUMNS) {
    Object.defineProperty(process.stdout, "columns", ORIGINAL_STDOUT_COLUMNS);
  }
}

function restorePlatform(): void {
  Object.defineProperty(process, "platform", {
    configurable: true,
    value: ORIGINAL_PLATFORM,
  });
}

function forceColors(): void {
  vi.stubEnv("FORCE_COLOR", "1");
  vi.stubEnv("NO_COLOR", undefined);
}

function forceUnicode(): void {
  vi.stubEnv("WT_SESSION", "1");
  vi.stubEnv("TERM", "xterm-256color");
}

function disableColors(): void {
  vi.stubEnv("NO_COLOR", "");
  vi.stubEnv("FORCE_COLOR", undefined);
}

function disableUnicode(): void {
  vi.stubEnv("WT_SESSION", undefined);
  vi.stubEnv("TERM", "linux");
  vi.stubEnv("TERM_PROGRAM", undefined);
  vi.stubEnv("TERMINUS_SUBLIME", undefined);
  vi.stubEnv("ConEmuTask", undefined);
  vi.stubEnv("TERMINAL_EMULATOR", undefined);
  Object.defineProperty(process, "platform", {
    configurable: true,
    value: "linux",
  });
}

describe("formatTime", () => {
  it("extracts HH:MM:SS from ISO timestamp", () => {
    expect(formatTime("2026-07-15T00:00:00.000Z")).toBe("00:00:00");
    expect(formatTime("2026-07-15T14:30:45.123Z")).toBe("14:30:45");
  });
});

describe("padToRight", () => {
  it("pads content so suffix aligns to the right edge", () => {
    const line = padToRight("hello", "00:00:00", MIN_ALIGN_COLUMNS);
    expect(stripAnsi(line)).toBe(
      `hello${" ".repeat(MIN_ALIGN_COLUMNS - 5 - 8)}00:00:00`
    );
    expect(stringWidth(line)).toBe(MIN_ALIGN_COLUMNS);
  });

  it("uses compact spacing when content overflows the terminal width", () => {
    const content = "x".repeat(90);
    const line = padToRight(content, "00:00:00", MIN_ALIGN_COLUMNS);
    expect(line).toBe(`${content} 00:00:00`);
  });

  it("uses compact spacing below the align threshold", () => {
    const line = padToRight("hello", "00:00:00", 40);
    expect(line).toBe("hello 00:00:00");
  });
});

describe("transport formatting", () => {
  beforeEach(() => {
    mockTerminalWidth(TERMINAL_WIDTH);
    forceColors();
    forceUnicode();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    restoreTerminalWidth();
    restorePlatform();
  });

  it("formats plain console output with right-aligned timestamp", () => {
    const line = formatPlain(sampleRecord);
    expect(line.endsWith("00:00:00")).toBe(true);
    expect(stringWidth(line)).toBe(TERMINAL_WIDTH);
    expect(line.startsWith("INFO")).toBe(true);
  });

  it("formats pretty console output with right-aligned dim timestamp", () => {
    const line = formatPretty(sampleRecord);
    expect(line.endsWith(DIM_TIME)).toBe(true);
    expect(stringWidth(line)).toBe(TERMINAL_WIDTH);
    expect(line).toContain("ℹ");
    expect(line).not.toContain("INFO");
    expect(line).toContain("[cache]");
    expect(line).toContain("Cache hit");
    expect(line).toContain("\x1b[38;5;37m");
    expect(line).toContain("\x1b[2m");
  });

  it("omits ANSI from pretty output when colors are unsupported", () => {
    disableColors();
    const line = formatPretty(sampleRecord);
    expect(line).not.toContain("\x1b[");
    expect(line).toContain("ℹ");
    expect(line).toContain("[cache]");
    expect(line).toContain("Cache hit");
    expect(line.endsWith("00:00:00")).toBe(true);
    expect(stringWidth(line)).toBe(TERMINAL_WIDTH);
  });

  it("uses ASCII glyph fallbacks when Unicode is unsupported", () => {
    disableUnicode();
    const start = formatPretty({
      ...sampleRecord,
      level: "start",
      message: "Migrating database",
    });
    const success = formatPretty({
      ...sampleRecord,
      level: "success",
      message: "Migration complete",
    });
    const debug = formatPretty({
      ...sampleRecord,
      level: "debug",
      message: "debug detail",
    });
    const trace = formatPretty({
      ...sampleRecord,
      level: "trace",
      message: "trace detail",
    });
    const info = formatPretty(sampleRecord);
    expect(start).toContain("o");
    expect(start).not.toContain("◐");
    expect(success).toContain("✓");
    expect(success).not.toContain("✔");
    expect(debug).toContain("D");
    expect(debug).not.toContain("◆");
    expect(trace).toContain("→");
    expect(info).toContain("i");
    expect(info).not.toContain("ℹ");
  });

  it("omits the name segment from pretty output when name is absent", () => {
    const { name: _name, ...unnamed } = sampleRecord;
    const line = formatPretty(unnamed);
    expect(line).not.toContain("[cache]");
    expect(line).toContain("Cache hit");
    expect(line.endsWith(DIM_TIME)).toBe(true);
  });

  it("omits the name segment from plain output when name is absent", () => {
    const { name: _name, ...unnamed } = sampleRecord;
    const line = formatPlain(unnamed);
    expect(line).not.toContain("[cache]");
    expect(line).toContain("Cache hit");
    expect(line.startsWith("INFO")).toBe(true);
  });

  it("omits the timestamp from pretty output when disabled", () => {
    const line = formatPretty(sampleRecord, FORMAT_TIME_OFF);
    expect(line).not.toContain("00:00:00");
    expect(line).toContain("Cache hit");
    expect(stringWidth(line)).toBeLessThan(TERMINAL_WIDTH);
  });

  it("omits the timestamp from plain output when disabled", () => {
    const line = formatPlain(sampleRecord, FORMAT_TIME_OFF);
    expect(line).not.toContain("00:00:00");
    expect(line).toContain("Cache hit");
  });

  it("formats pretty output with iso timestamp when configured", () => {
    const line = formatPretty(sampleRecord, FORMAT_TIME_ISO);
    expect(line.endsWith("\x1b[2m2026-07-15T00:00:00.000Z\x1b[22m")).toBe(true);
  });

  it("formats pretty output with utcString timestamp when configured", () => {
    const line = formatPretty(sampleRecord, FORMAT_TIME_UTC_STRING);
    expect(line.endsWith("\x1b[2mWed, 15 Jul 2026 00:00:00 GMT\x1b[22m")).toBe(
      true
    );
  });

  it("formats pretty output with time12 timestamp when configured", () => {
    const line = formatPretty(sampleRecord, FORMAT_TIME_TIME12);
    expect(line.endsWith("\x1b[2m12:00:00 AM\x1b[22m")).toBe(true);
  });

  it("uses compact timestamp layout on narrow terminals", () => {
    mockTerminalWidth(40);
    const line = formatPretty(sampleRecord);
    expect(stripAnsi(line)).toBe(
      'ℹ\uFE0E [cache] Cache hit {"zKey":1,"aKey":"alpha"} 00:00:00'
    );
  });

  it("uses compact spacing when line exceeds terminal width", () => {
    mockTerminalWidth(40);
    const record: LogRecord = {
      ...sampleRecord,
      message: "x".repeat(80),
    };
    const line = formatPlain(record);
    expect(line.endsWith("00:00:00")).toBe(true);
    expect(line).toContain(" 00:00:00");
    expect(stringWidth(line)).toBeGreaterThan(40);
  });

  it("keeps multiline messages alignable on the first line", () => {
    const record: LogRecord = {
      ...sampleRecord,
      message: "first line\nsecond line\nthird line",
      meta: {},
    };
    const lines = formatPretty(record).split("\n");
    expect(lines).toHaveLength(3);
    expect(lines[0]?.endsWith(DIM_TIME)).toBe(true);
    expect(stringWidth(lines[0] ?? "")).toBe(TERMINAL_WIDTH);
    expect(stripAnsi(lines[1] ?? "")).toBe("  second line");
    expect(stripAnsi(lines[2] ?? "")).toBe("  third line");
  });

  it("formats success with a green checkmark and no label", () => {
    const record: LogRecord = {
      ...sampleRecord,
      level: "success",
      message: "Migration complete",
    };
    const line = formatPretty(record);
    expect(line).toContain("✔\uFE0E");
    expect(line).not.toContain("SUCCESS");
    expect(line).toContain("\x1b[92m");
    expect(line.endsWith(DIM_TIME)).toBe(true);
  });

  it("formats start with a magenta loading glyph and no label", () => {
    const record: LogRecord = {
      ...sampleRecord,
      level: "start",
      message: "Migrating database",
    };
    const line = formatPretty(record);
    expect(line).toContain("◐");
    expect(line).not.toContain("START");
    expect(line).toContain("\x1b[35m");
    expect(line.endsWith(DIM_TIME)).toBe(true);
  });

  it("formats trace with a muted glyph and no label", () => {
    const record: LogRecord = {
      ...sampleRecord,
      level: "trace",
      message: "Entering handler",
    };
    const line = formatPretty(record);
    expect(line).toContain("→");
    expect(line).not.toContain("TRACE");
    expect(line).toContain("\x1b[38;5;245m");
    expect(line.endsWith(DIM_TIME)).toBe(true);
  });

  it("formats plain trace and fatal labels", () => {
    const trace = formatPlain({
      ...sampleRecord,
      level: "trace",
      message: "Entering handler",
      meta: {},
    });
    const fatal = formatPlain({
      ...sampleRecord,
      level: "fatal",
      message: "Process crashed",
      meta: {},
    });
    expect(trace.startsWith("TRACE")).toBe(true);
    expect(fatal.startsWith("FATAL")).toBe(true);
  });

  it("formats warn as a background badge with no glyph", () => {
    const colors = createColors({ useColor: true });
    const prefix = formatLevelPrefix("warn", "badge", colors);
    expect(prefix).toContain("\x1b[48;5;227m");
    expect(prefix).toContain("WARN");
    expect(prefix).not.toContain("⚠");
  });

  it("colors warn, error, and fatal glyphs when symbol kind is selected", () => {
    const colors = createColors({ useColor: true });
    const warn = formatLevelPrefix("warn", "symbol", colors);
    const error = formatLevelPrefix("error", "symbol", colors);
    const fatal = formatLevelPrefix("fatal", "symbol", colors);

    expect(warn).toContain("⚠\uFE0E");
    expect(warn).toContain("\x1b[38;5;227m");
    expect(warn).not.toContain("WARN");
    expect(warn).not.toContain("\x1b[48;5;227m");

    expect(error).toContain("✖\uFE0E");
    expect(error).toContain("\x1b[91m");
    expect(error).not.toContain("ERROR");
    expect(error).not.toContain("\x1b[41m");

    expect(fatal).toContain("☠\uFE0E");
    expect(fatal).toContain("\x1b[38;5;88m");
    expect(fatal).not.toContain("FATAL");
    expect(fatal).not.toContain("\x1b[48;5;88m");
  });

  it("formats error as a red badge with structured stack frames", () => {
    const error = new Error("boom");
    error.stack =
      "Error: boom\n    at runWithHooks (C:\\Users\\app\\runtime.js:1554:9)\n    at C:\\Users\\app\\runtime.js:1291:27";
    const record: LogRecord = {
      ...sampleRecord,
      level: "error",
      message: "boom",
      meta: { err: error, error: "boom" },
    };
    const line = formatPretty(record);
    const lines = line.split("\n");
    expect(lines[0]).toContain("\x1b[41m");
    expect(lines[0]).toContain("ERROR");
    expect(lines[0]).toContain("[cache]");
    expect(lines[0]).toContain("boom");
    expect(lines[0]?.endsWith(DIM_TIME)).toBe(true);
    expect(lines[1]).toBe("");
    expect(lines.length).toBeGreaterThan(2);
    const frameLines = lines.slice(2).map((l) => stripAnsi(l).trim());
    expect(frameLines.some((l) => l.startsWith("at "))).toBe(true);
    expect(line).toContain("\x1b[97m");
    expect(line).toContain("\x1b[38;5;43m");
    expect(frameLines).toContain(
      "at runWithHooks (C:\\Users\\app\\runtime.js:1554:9)"
    );
    expect(frameLines).toContain("at C:\\Users\\app\\runtime.js:1291:27");
  });

  it("formats fatal as a deep-red symbol with structured stack frames", () => {
    const error = new Error("crash");
    error.stack =
      "Error: crash\n    at bootstrap (server.ts:8:3)\n    at main (server.ts:1:1)";
    const record: LogRecord = {
      ...sampleRecord,
      level: "fatal",
      message: "Unrecoverable failure",
      meta: { err: error, error: "crash" },
    };
    const line = formatPretty(record);
    const lines = line.split("\n");
    expect(lines[0]).toContain("\x1b[38;5;88m");
    expect(lines[0]).toContain("☠\uFE0E");
    expect(lines[0]).not.toContain("FATAL");
    expect(lines[0]).toContain("Unrecoverable failure");
    expect(lines[0]?.endsWith(DIM_TIME)).toBe(true);
    expect(lines[1]).toBe("");
    const frameLines = lines.slice(2).map((l) => stripAnsi(l).trim());
    expect(frameLines).toContain("crash");
    expect(frameLines).toContain("at bootstrap (server.ts:8:3)");
    expect(frameLines).toContain("at main (server.ts:1:1)");
  });

  it("includes trace and fatal levels in JSON output", () => {
    const trace = JSON.parse(
      formatJson({
        ...sampleRecord,
        level: "trace",
        message: "Entering handler",
        meta: {},
      })
    ) as Record<string, unknown>;
    const fatal = JSON.parse(
      formatJson({
        ...sampleRecord,
        level: "fatal",
        message: "Unrecoverable failure",
        meta: {},
      })
    ) as Record<string, unknown>;
    expect(trace.level).toBe("trace");
    expect(fatal.level).toBe("fatal");
  });

  it("renders err.message below the prefix line when a separate message is given", () => {
    const error = new Error("connection refused");
    const record: LogRecord = {
      ...sampleRecord,
      level: "error",
      message: "Database unavailable",
      meta: { err: error, error: "connection refused" },
    };
    const lines = formatPretty(record).split("\n");
    expect(lines[0]).toContain("Database unavailable");
    expect(lines[0]).toContain("[cache]");
    expect(lines[1]).toBe("");
    expect(stripAnsi(lines[2] ?? "").trim()).toBe("connection refused");
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
    const lines = formatPretty(record)
      .split("\n")
      .map((line) => stripAnsi(line).trim());
    expect(lines).toContain("Caused by: timeout");
    expect(lines).toContain("at connect (db.ts:42:11)");
  });

  it("falls back to a single badge line when no Error is attached", () => {
    const record: LogRecord = {
      ...sampleRecord,
      level: "error",
      message: "plain error string",
      meta: {},
    };
    const line = formatPretty(record);
    expect(line.split("\n")).toHaveLength(1);
    expect(line).toContain("ERROR");
    expect(line).toContain("\x1b[41m");
    expect(line).toContain("plain error string");
  });

  it("serializes Error values in JSON meta", () => {
    const record: LogRecord = {
      ...sampleRecord,
      meta: { error: new Error("boom") },
    };
    const parsed = JSON.parse(formatJson(record)) as {
      error: { message: string; name: string; stack: string };
    };
    expect(parsed.error.name).toBe("Error");
    expect(parsed.error.message).toBe("boom");
    expect(typeof parsed.error.stack).toBe("string");
  });

  it("serializes Error values in pretty/plain meta", () => {
    const record: LogRecord = {
      ...sampleRecord,
      meta: { error: new Error("boom") },
    };
    const line = formatPlain(record);
    expect(line).toContain('"message":"boom"');
    expect(line).not.toContain('"error":{}');
  });

  it("serializes nested Error values in meta", () => {
    const record: LogRecord = {
      ...sampleRecord,
      meta: { wrapper: { err: new Error("inner") } },
    };
    const parsed = JSON.parse(formatJson(record)) as {
      wrapper: { err: { message: string; name: string } };
    };
    expect(parsed.wrapper.err.name).toBe("Error");
    expect(parsed.wrapper.err.message).toBe("inner");
  });

  it("does not throw on circular or bigint meta in JSON and inline output", () => {
    const circular: Record<string, unknown> = { label: "cycle" };
    circular.self = circular;
    const record: LogRecord = {
      ...sampleRecord,
      meta: { circular, amount: 10n },
    };

    expect(() => formatJson(record)).not.toThrow();
    expect(() => formatPlain(record)).not.toThrow();

    const parsed = JSON.parse(formatJson(record)) as {
      amount: string;
      circular: { label: string; self: string };
    };
    expect(parsed.amount).toBe("10");
    expect(parsed.circular.self).toBe("[Circular]");
    expect(formatPlain(record)).toContain("[Circular]");
    expect(formatPlain(record)).toContain('"amount":"10"');
  });

  it("omits empty metadata from inline plain output", () => {
    const record: LogRecord = {
      ...sampleRecord,
      meta: {},
    };
    const line = formatPlain(record, FORMAT_TIME_OFF);
    expect(line).toBe("INFO    [cache] Cache hit");
    expect(line).not.toContain("{}");
  });

  it("formats JSON with stable key order", () => {
    const parsed = JSON.parse(formatJson(sampleRecord)) as Record<
      string,
      unknown
    >;
    expect(Object.keys(parsed)).toEqual([
      "timestamp",
      "level",
      "name",
      "message",
      "aKey",
      "zKey",
    ]);
    expect(parsed).toMatchObject({
      timestamp: "00:00:00",
      level: "info",
      name: "cache",
      message: "Cache hit",
      aKey: "alpha",
      zKey: 1,
    });
  });

  it("keeps canonical JSON fields when meta keys collide", () => {
    const record: LogRecord = {
      ...sampleRecord,
      meta: {
        level: "debug",
        message: "from-meta",
        name: "spoofed",
        timestamp: "99:99:99",
        zKey: 1,
        aKey: "alpha",
      },
    };
    const parsed = JSON.parse(formatJson(record)) as Record<string, unknown>;

    expect(Object.keys(parsed)).toEqual([
      "timestamp",
      "level",
      "name",
      "message",
      "aKey",
      "zKey",
    ]);
    expect(parsed).toMatchObject({
      timestamp: "00:00:00",
      level: "info",
      name: "cache",
      message: "Cache hit",
      aKey: "alpha",
      zKey: 1,
    });
  });

  it("formats JSON with full ISO timestamp when configured", () => {
    const parsed = JSON.parse(
      formatJson(sampleRecord, FORMAT_TIME_ISO)
    ) as Record<string, unknown>;
    expect(parsed.timestamp).toBe("2026-07-15T00:00:00.000Z");
  });

  it("formats JSON with utcString timestamp when configured", () => {
    const parsed = JSON.parse(
      formatJson(sampleRecord, FORMAT_TIME_UTC_STRING)
    ) as Record<string, unknown>;
    expect(parsed.timestamp).toBe("Wed, 15 Jul 2026 00:00:00 GMT");
  });

  it("omits timestamp from JSON when disabled", () => {
    const parsed = JSON.parse(
      formatJson(sampleRecord, FORMAT_TIME_OFF)
    ) as Record<string, unknown>;
    expect(Object.keys(parsed)).toEqual([
      "level",
      "name",
      "message",
      "aKey",
      "zKey",
    ]);
    expect(parsed).not.toHaveProperty("timestamp");
  });

  it("omits name from JSON when name is absent", () => {
    const { name: _name, ...unnamed } = sampleRecord;
    const parsed = JSON.parse(formatJson(unnamed)) as Record<string, unknown>;
    expect(Object.keys(parsed)).toEqual([
      "timestamp",
      "level",
      "message",
      "aKey",
      "zKey",
    ]);
    expect(parsed).not.toHaveProperty("name");
  });
});

describe("console routing", () => {
  beforeEach(() => {
    forceColors();
    forceUnicode();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    restoreTerminalWidth();
    restorePlatform();
  });

  it("routes trace through console.log and fatal through console.error", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const warnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);
    const errorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const [transport] = resolveTransports(
      [{ type: "console" }],
      FORMAT_TIME_OFF
    );
    transport?.write({
      ...sampleRecord,
      level: "trace",
      message: "Entering handler",
      meta: {},
    });
    transport?.write({
      ...sampleRecord,
      level: "fatal",
      message: "Unrecoverable failure",
      meta: {},
    });
    transport?.write({
      ...sampleRecord,
      level: "warn",
      message: "Slow query",
      meta: {},
    });

    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(String(logSpy.mock.calls[0]?.[0])).toContain("TRACE");
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(String(errorSpy.mock.calls[0]?.[0])).toContain("FATAL");
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
});

describe("formatOptions", () => {
  beforeEach(() => {
    mockTerminalWidth(TERMINAL_WIDTH);
    forceColors();
    forceUnicode();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    restoreTerminalWidth();
    restorePlatform();
  });

  it("omits inline meta when meta is false", () => {
    const line = formatPretty(sampleRecord, withFormat({ meta: false }));
    expect(line).not.toContain("zKey");
    expect(line).toContain("Cache hit");
  });

  it("omits name segment when name is false", () => {
    const line = formatPretty(sampleRecord, withFormat({ name: false }));
    expect(line).not.toContain("[cache]");
    expect(line).toContain("Cache hit");
  });

  it("uses compact layout when align is false", () => {
    mockTerminalWidth(120);
    const line = formatPretty(sampleRecord, withFormat({ align: false }));
    expect(stripAnsi(line)).toBe(
      'ℹ\uFE0E [cache] Cache hit {"zKey":1,"aKey":"alpha"} 00:00:00'
    );
  });

  it("right-aligns only when width meets custom align threshold", () => {
    mockTerminalWidth(100);
    const compact = formatPretty(sampleRecord, withFormat({ align: 120 }));
    expect(stripAnsi(compact)).toBe(
      'ℹ\uFE0E [cache] Cache hit {"zKey":1,"aKey":"alpha"} 00:00:00'
    );

    mockTerminalWidth(120);
    const aligned = formatPretty(sampleRecord, withFormat({ align: 120 }));
    expect(stringWidth(aligned)).toBe(120);
    expect(stripAnsi(aligned).endsWith("00:00:00")).toBe(true);
  });

  it("strips ANSI when colors is false", () => {
    forceColors();
    const line = formatPretty(sampleRecord, withFormat({ colors: false }));
    expect(line).toBe(stripAnsi(line));
    expect(line).toContain("Cache hit");
  });

  it("omits stack frames when stack is false", () => {
    const error = new Error("connection refused");
    error.stack =
      "Error: connection refused\n    at connect (db.ts:42:11)\n    at bootstrap (server.ts:8:3)";
    const record: LogRecord = {
      ...sampleRecord,
      level: "error",
      message: "Database unavailable",
      meta: { err: error },
    };
    const line = formatPretty(record, withFormat({ stack: false }));
    expect(line).toContain("Database unavailable");
    expect(line).toContain("connection refused");
    expect(line).not.toContain("at connect");
    expect(line).not.toContain("db.ts:42:11");
  });

  it("applies per-level glyph, fallback, label, and kind overrides", () => {
    const line = formatPretty(
      sampleRecord,
      withFormat({
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
    expect(stripAnsi(line)).toContain("★\uFE0E");
    expect(stripAnsi(line)).not.toContain("NOTE");

    const badge = formatPretty(
      sampleRecord,
      withFormat({
        levels: {
          info: { kind: "badge", label: "NOTE" },
        },
      })
    );
    expect(stripAnsi(badge)).toContain(" NOTE ");

    disableUnicode();
    const ascii = formatPretty(
      sampleRecord,
      withFormat({
        levels: {
          info: { symbol: "★", fallbackSymbol: "*", kind: "symbol" },
        },
      })
    );
    expect(stripAnsi(ascii)).toContain("*\uFE0E");
  });

  it("pads plain labels using the longest effective label", () => {
    const line = formatPlain(
      sampleRecord,
      withFormat({
        levels: {
          info: { label: "INFORMATION" },
        },
      })
    );
    expect(line.startsWith("INFORMATION")).toBe(true);
    expect(stripAnsi(line)).toContain("[cache] Cache hit");
  });

  it("orders JSON groups and appends missing defaults", () => {
    const parsed = JSON.parse(
      formatJson(
        sampleRecord,
        withFormat({
          json: { fieldOrder: ["message", "meta", "message"] },
        })
      )
    ) as Record<string, unknown>;
    expect(Object.keys(parsed)).toEqual([
      "message",
      "aKey",
      "zKey",
      "timestamp",
      "level",
      "name",
    ]);
  });

  it("pretty-prints JSON with configurable indentation", () => {
    const compact = formatJson(sampleRecord);
    expect(compact.includes("\n")).toBe(false);

    const pretty = formatJson(
      sampleRecord,
      withFormat({ json: { pretty: true } })
    );
    expect(pretty.startsWith("{\n  ")).toBe(true);

    const spaced = formatJson(
      sampleRecord,
      withFormat({ json: { pretty: 4 } })
    );
    expect(spaced.startsWith("{\n    ")).toBe(true);
  });

  it("merges transport formatOptions over logger options", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const [transport] = resolveTransports(
      [
        {
          type: "json",
          formatOptions: {
            json: { fieldOrder: ["message", "level"] },
          },
        },
      ],
      withFormat({ time: false })
    );
    transport?.write(sampleRecord);
    const parsed = JSON.parse(String(logSpy.mock.calls[0]?.[0])) as Record<
      string,
      unknown
    >;
    expect(Object.keys(parsed)).toEqual([
      "message",
      "level",
      "name",
      "aKey",
      "zKey",
    ]);
    expect(parsed).not.toHaveProperty("timestamp");
  });

  it("uses formatOptions.pretty for console transports", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const [transport] = resolveTransports(
      [{ type: "console" }],
      withFormat({ pretty: true })
    );
    transport?.write({ ...sampleRecord, meta: {} });
    expect(stripAnsi(String(logSpy.mock.calls[0]?.[0]))).toContain("ℹ");
  });
});
