/** Supported log severity levels. */
export type LogLevel =
  | "trace"
  | "debug"
  | "info"
  | "success"
  | "start"
  | "warn"
  | "error"
  | "fatal"
  | "silent";

/** Active log levels that emit records (excludes `silent`). */
export type ActiveLogLevel = Exclude<LogLevel, "silent">;

/** Built-in console transport configuration. */
export interface ConsoleTransport {
  /**
   * Per-transport formatting overrides (deep-merged over logger `formatOptions`).
   */
  formatOptions?: FormatOptions;
  /** Selects the human-readable console transport. */
  type: "console";
}

/** Built-in JSON transport configuration. */
export interface JsonTransport {
  /**
   * Per-transport formatting overrides (deep-merged over logger `formatOptions`).
   */
  formatOptions?: FormatOptions;
  /** Selects the structured JSON transport, emitting one object per line. */
  type: "json";
}

/** Discriminated union of built-in transport configurations. */
export type Transport = ConsoleTransport | JsonTransport;

/**
 * Display format for log timestamps.
 *
 * - `"time"` — `HH:MM:SS` (default)
 * - `"time12"` — `hh:MM:SS AM/PM`
 * - `"iso"` — full ISO 8601 string
 * - `"utcString"` — HTTP-style date (`Thu, 16 Jul 2026 18:45:30 GMT`), or local `Date#toString()` when timezone is `"local"`
 */
export type TimestampFormat = "time" | "time12" | "iso" | "utcString";

/** Timezone used when formatting timestamps for display. */
export type TimestampTimezone = "utc" | "local";

/**
 * Timestamp option for {@link FormatOptions.time}.
 *
 * - `boolean` — enable/disable with the default format
 * - `{ enabled: false }` — disable (no `format`)
 * - `{ enabled: true; format?; timezone? }` — enable; `format` defaults to `"time"`, `timezone` to `"utc"`
 */
export type TimestampOption =
  | boolean
  | { enabled: false }
  | {
      enabled: true;
      format?: TimestampFormat;
      timezone?: TimestampTimezone;
    };

/** Resolved timestamp settings used by transports. */
export interface ResolvedTimestampConfig {
  /**
   * Whether timestamp display is enabled.
   *
   * @default `true`.
   */
  enabled: boolean;
  /**
   * Timestamp format {@link TimestampFormat}.
   *
   * @default `"time"`.
   */
  format: TimestampFormat;
  /**
   * Timezone for display formatting {@link TimestampTimezone}.
   *
   * @default `"utc"`.
   */
  timezone: TimestampTimezone;
}

/** How a level prefix renders in pretty console output. */
export type LevelPrefixKind = "symbol" | "badge";

/**
 * Per-level identity overrides for pretty/plain console prefixes.
 * Colors and badge CSS remain environment-specific defaults.
 */
export interface LevelFormatOptions {
  /** ASCII fallback when Unicode glyphs are unsupported. */
  fallbackSymbol?: string;
  /** Prefix kind: colored glyph or background badge. */
  kind?: LevelPrefixKind;
  /** Uppercase label used by plain output and badges. */
  label?: string;
  /** Unicode glyph for symbol prefixes. */
  symbol?: string;
}

/** Named groups for JSON field ordering. */
export type JsonFieldGroup =
  | "timestamp"
  | "level"
  | "name"
  | "message"
  | "meta";

/** JSON transport serialization options. */
export interface JsonFormatOptions {
  /**
   * Ordered field groups. `meta` expands to alphabetically sorted metadata keys.
   * Missing groups append in the default order. Duplicates are ignored after first use.
   *
   * @default `["timestamp", "level", "name", "message", "meta"]`.
   */
  fieldOrder?: JsonFieldGroup[];
  /**
   * Pretty-print JSON. `true` uses 2 spaces; a number uses that indentation
   * (clamped to 0–10). Default is compact one-line output.
   *
   * @default `false`.
   */
  pretty?: boolean | number;
}

/** Resolved JSON serialization settings. */
export interface ResolvedJsonFormatOptions {
  fieldOrder: JsonFieldGroup[];
  pretty: boolean | number;
}

/** Output formatting options for {@link createLogger} and transports. */
export interface FormatOptions {
  /**
   * Min terminal width for right-aligned timestamps; `false` = always compact.
   *
   * @default `80`.
   */
  align?: number | false;
  /**
   * Pretty color override (`true` / `false` / `"auto"`).
   *
   * @default `"auto"`.
   */
  colors?: boolean | "auto";
  /**
   * JSON serialization (field order and indentation).
   */
  json?: JsonFormatOptions;
  /**
   * Per-level glyph/label/kind overrides for console prefixes.
   */
  levels?: Partial<Record<ActiveLogLevel, LevelFormatOptions>>;
  /**
   * Inline meta JSON on console lines.
   *
   * @default `true`.
   */
  meta?: boolean;
  /**
   * `[name]` segment on console lines.
   *
   * @default `true`.
   */
  name?: boolean;
  /**
   * Pretty console mode (glyphs/badges). Applies to console transports.
   *
   * @default `false`.
   */
  pretty?: boolean;
  /**
   * Stack frames in pretty error/fatal output.
   *
   * @default `true`.
   */
  stack?: boolean;
  /**
   * Timestamp display. Formats: `"time"` | `"time12"` | `"iso"` | `"utcString"`.
   * Set to `false` or `{ enabled: false }` to omit timestamps.
   *
   * @default enabled with `"time"` (`HH:MM:SS`) and timezone `"utc"`.
   */
  time?: TimestampOption;
}

/** Resolved formatting settings used by transports. */
export interface ResolvedFormatOptions {
  align: number | false;
  colors: boolean | "auto";
  json: ResolvedJsonFormatOptions;
  levels: Partial<Record<ActiveLogLevel, LevelFormatOptions>>;
  meta: boolean;
  name: boolean;
  pretty: boolean;
  stack: boolean;
  time: ResolvedTimestampConfig;
}

/** Options for {@link createLogger}. */
export interface LoggerOptions {
  /**
   * Output formatting (timestamps, meta, name segment, alignment, colors, stacks).
   */
  formatOptions?: FormatOptions;
  /**
   * Minimum severity to emit.
   * @default `"info"`.
   */
  level?: LogLevel;
  /** Logger name included in every log line when provided. */
  name?: string;
  /** Key names to redact recursively in meta objects (case-insensitive). */
  redact?: string[];
  /** Output transports. Default single console transport. */
  transports?: Transport[];
}

/**
 * Structured logger interface.
 *
 * Overloads preserve structured call-site typing while remaining assignable to
 * broader `(...args: unknown[])` logger shapes (e.g. `@g14o/cache`).
 */
export interface Logger {
  /** Returns a child logger that merges `bindings` into every subsequent log. */
  child(bindings: Record<string, unknown>): Logger;
  /** Logs diagnostic details at the `debug` level. Hidden by the default threshold. */
  debug(message: string, meta?: Record<string, unknown>): void;
  debug(...args: unknown[]): void;
  /** Logs a recoverable failure at the `error` level with structured error details. */
  error(error: unknown, message?: string): void;
  error(...args: unknown[]): void;
  /** Logs an unrecoverable failure at the highest severity level. */
  fatal(error: unknown, message?: string): void;
  fatal(...args: unknown[]): void;
  /** Logs general operational information at the default severity level. */
  info(message: string, meta?: Record<string, unknown>): void;
  info(...args: unknown[]): void;
  /** Logs the beginning or progress of a process at the `info` severity tier. */
  start(message: string, meta?: Record<string, unknown>): void;
  start(...args: unknown[]): void;
  /** Logs successful completion of a process at the `info` severity tier. */
  success(message: string, meta?: Record<string, unknown>): void;
  success(...args: unknown[]): void;
  /**
   * Starts a timer for `label`. Returns a stop function that logs at `success`
   * level with `durationMs` in meta.
   */
  time(
    label: string,
    meta?: Record<string, unknown>
  ): (endMeta?: Record<string, unknown>) => void;
  /** Logs fine-grained diagnostic details at the lowest severity level. */
  trace(message: string, meta?: Record<string, unknown>): void;
  trace(...args: unknown[]): void;
  /** Logs a potentially harmful or unexpected condition at the `warn` level. */
  warn(message: string, meta?: Record<string, unknown>): void;
  warn(...args: unknown[]): void;
  /**
   * Returns a child logger with `requestId` bound. Generates one when `id` is omitted.
   */
  withRequestId(id?: string): Logger;
}

/** Internal normalized log record passed to transports. */
export interface LogRecord {
  level: ActiveLogLevel;
  message: string;
  meta: Record<string, unknown>;
  name?: string;
  timestamp: string;
}

/** Runtime transport that writes a formatted log record. */
export interface LogTransport {
  write(record: LogRecord): void;
}
