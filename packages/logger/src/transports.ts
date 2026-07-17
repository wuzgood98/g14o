import { formatBrowserConsole } from "./browser";
import type {
  ActiveLogLevel,
  LevelFormatOptions,
  LevelPrefixKind,
  LogRecord,
  LogTransport,
  ResolvedFormatOptions,
  ResolvedTimestampConfig,
  Transport,
} from "./types";
import {
  type ColorFn,
  type Colors,
  createColors,
  isColorSupported,
} from "./utils/colors";
import {
  forceTextPresentation,
  padToRight,
  selectGlyph,
} from "./utils/display";
import { isBrowserEnv } from "./utils/env";
import {
  DEFAULT_FORMAT_OPTIONS,
  mergeFormatOptions,
  resolveJsonFieldOrder,
  resolveJsonIndent,
} from "./utils/format-options";
import { normalizeStack } from "./utils/stack";
import { formatTimestamp } from "./utils/timestamp";

function resolveColors(formatOptions: ResolvedFormatOptions): Colors {
  const useColor =
    formatOptions.colors === "auto" ? isColorSupported() : formatOptions.colors;
  return createColors({ useColor });
}

interface LevelStyle {
  /** Background badge paint for `kind: "badge"`. */
  badgePaint?: (colors: Colors) => ColorFn;
  /** ASCII fallback when Unicode glyphs are unsupported. */
  fallbackSymbol: string;
  /** How the level prefix renders: colored glyph or background badge. */
  kind: LevelPrefixKind;
  /** Uppercase label, used by plain/badge output. */
  label: string;
  /** Foreground paint for `kind: "symbol"`. */
  symbolPaint: (colors: Colors) => ColorFn;
  /** Unicode glyph for symbol prefixes. */
  unicodeSymbol: string;
}

const LEVEL_STYLES: Record<ActiveLogLevel, LevelStyle> = {
  trace: {
    kind: "symbol",
    symbolPaint: (colors) => colors.trace,
    unicodeSymbol: "→",
    fallbackSymbol: "→",
    label: "TRACE",
  },
  debug: {
    kind: "symbol",
    symbolPaint: (colors) => colors.debug,
    unicodeSymbol: "◆",
    fallbackSymbol: "D",
    label: "DEBUG",
  },
  info: {
    kind: "symbol",
    symbolPaint: (colors) => colors.info,
    unicodeSymbol: "ℹ",
    fallbackSymbol: "i",
    label: "INFO",
  },
  success: {
    kind: "symbol",
    symbolPaint: (colors) => colors.greenBright,
    unicodeSymbol: "✔",
    fallbackSymbol: "✓",
    label: "SUCCESS",
  },
  start: {
    kind: "symbol",
    symbolPaint: (colors) => colors.magenta,
    unicodeSymbol: "◐",
    fallbackSymbol: "o",
    label: "START",
  },
  warn: {
    kind: "symbol",
    badgePaint: (colors) => (text) =>
      colors.bgWarn(colors.black(colors.bold(text))),
    symbolPaint: (colors) => colors.warn,
    unicodeSymbol: "⚠",
    fallbackSymbol: "‼",
    label: "WARN",
  },
  error: {
    kind: "badge",
    badgePaint: (colors) => (text) =>
      colors.bgRed(colors.whiteBright(colors.bold(text))),
    symbolPaint: (colors) => colors.error,
    unicodeSymbol: "✖",
    fallbackSymbol: "×",
    label: "ERROR",
  },
  fatal: {
    kind: "symbol",
    badgePaint: (colors) => (text) =>
      colors.bgFatal(colors.whiteBright(colors.bold(text))),
    symbolPaint: (colors) => colors.fatal,
    unicodeSymbol: "☠",
    fallbackSymbol: "×",
    label: "FATAL",
  },
};

function resolveLevelStyle(
  level: ActiveLogLevel,
  override: LevelFormatOptions | undefined
): LevelStyle {
  const base = LEVEL_STYLES[level];
  if (!override) {
    return base;
  }
  return {
    ...base,
    kind: override.kind ?? base.kind,
    label: override.label ?? base.label,
    unicodeSymbol: override.symbol ?? base.unicodeSymbol,
    fallbackSymbol: override.fallbackSymbol ?? base.fallbackSymbol,
  };
}

function longestLabelWidth(levels: ResolvedFormatOptions["levels"]): number {
  let longest = 0;
  for (const level of Object.keys(LEVEL_STYLES) as ActiveLogLevel[]) {
    const style = resolveLevelStyle(level, levels[level]);
    longest = Math.max(longest, style.label.length);
  }
  return longest;
}

/** Renders the leading level prefix: colored glyph or background badge. */
function formatPrefix(style: LevelStyle, colors: Colors): string {
  if (style.kind === "badge") {
    const paint = (style.badgePaint ?? style.symbolPaint)(colors);
    return paint(` ${style.label} `);
  }
  const paint = style.symbolPaint(colors);
  const symbol = forceTextPresentation(
    selectGlyph(style.unicodeSymbol, style.fallbackSymbol)
  );
  const colored = paint(symbol);
  // Full reset then foreground so terminal emoji/glyph color overrides cannot win.
  return colored === symbol ? colored : `\x1b[0m${colored}`;
}

/**
 * Formats a level prefix using an explicit kind override.
 * Useful for verifying badge vs symbol styling without changing defaults.
 */
export function formatLevelPrefix(
  level: ActiveLogLevel,
  kind: LevelPrefixKind,
  colors: Colors = createColors({ useColor: isColorSupported() })
): string {
  return formatPrefix({ ...LEVEL_STYLES[level], kind }, colors);
}

/** Dim `[name]` segment for console output; empty when name is omitted or disabled. */
function formatNameSegment(
  name: string | undefined,
  colors: Colors,
  showName: boolean
): string {
  if (!(showName && name)) {
    return "";
  }
  return ` ${colors.dim(`[${name}]`)}`;
}

/** Plain `[name]` segment without ANSI; empty when name is omitted or disabled. */
function formatNameSegmentPlain(
  name: string | undefined,
  showName: boolean
): string {
  if (!(showName && name)) {
    return "";
  }
  return ` [${name}]`;
}

const CONTINUATION_INDENT = "  ";
const DEFAULT_TERMINAL_WIDTH = 80;

/** Returns terminal width, falling back when stdout is unavailable. */
export function getTerminalWidth(): number {
  if (isBrowserEnv()) {
    return DEFAULT_TERMINAL_WIDTH;
  }
  return process.stdout?.columns ?? DEFAULT_TERMINAL_WIDTH;
}

/** Derives HH:MM:SS from an ISO timestamp (UTC, deterministic). */
export function formatTime(timestamp: string): string {
  return formatTimestamp(timestamp, "time");
}

function formatTimestampSuffix(
  iso: string,
  config: ResolvedTimestampConfig,
  pretty: boolean,
  colors: Colors
): string {
  if (!config.enabled) {
    return "";
  }
  const time = formatTimestamp(iso, config.format, config.timezone);
  return pretty ? colors.dim(time) : time;
}

function finalizeLine(
  content: string,
  suffix: string,
  width: number,
  align: number | false
): string {
  if (!suffix) {
    return content;
  }
  return padToRight(content, suffix, width, align);
}

function serializeError(error: Error): Record<string, unknown> {
  const result: Record<string, unknown> = {
    name: error.name,
    message: error.message,
    stack: error.stack,
  };
  if (error.cause !== undefined) {
    result.cause = error.cause;
  }
  return result;
}

function metaReplacer(_key: string, value: unknown): unknown {
  return value instanceof Error ? serializeError(value) : value;
}

function formatMetaInline(meta: Record<string, unknown>): string {
  const keys = Object.keys(meta);
  if (keys.length === 0) {
    return "";
  }
  return ` ${JSON.stringify(meta, metaReplacer)}`;
}

/** Serializes meta to inline JSON, omitting the given keys. */
function formatMetaInlineExcluding(
  meta: Record<string, unknown>,
  exclude: readonly string[]
): string {
  const filtered: Record<string, unknown> = {};
  for (const key of Object.keys(meta)) {
    if (!exclude.includes(key)) {
      filtered[key] = meta[key];
    }
  }
  return formatMetaInline(filtered);
}

/** Formats a single stack frame with gray `at`, white descriptor, and green path. */
function formatStackFrameLine(
  frame: NonNullable<ReturnType<typeof normalizeStack>[number]["frame"]>,
  colors: Colors
): string {
  if (frame.parenthesized) {
    return `${CONTINUATION_INDENT}${colors.gray("at ")}${colors.whiteBright(frame.descriptor)} ${colors.whiteBright(`(${colors.stackGreen(frame.location)})`)}`;
  }

  return `${CONTINUATION_INDENT}${colors.gray("at ")}${colors.stackGreen(frame.location)}`;
}

/** Formats normalized stack detail lines with colorized frames when possible. */
function formatStackDetailLines(
  stack: string | undefined,
  message: string,
  colors: Colors
): string[] {
  return normalizeStack(stack, message).map((detail) => {
    if (detail.frame) {
      return formatStackFrameLine(detail.frame, colors);
    }
    return colors.dim(`${CONTINUATION_INDENT}${detail.line}`);
  });
}

/**
 * Splits a message into a primary line and indented continuation lines.
 * Meta is appended to the primary line so the first row stays alignable.
 */
function splitMessageLines(
  message: string,
  meta: string
): { primary: string; continuations: string[] } {
  const [first = "", ...rest] = message.split("\n");
  return {
    primary: `${first}${meta}`,
    continuations: rest.map((line) => `${CONTINUATION_INDENT}${line}`),
  };
}

const ERROR_META_KEYS = ["err", "error"] as const;

function formatPrettyError(
  record: LogRecord,
  style: LevelStyle,
  formatOptions: ResolvedFormatOptions,
  colors: Colors
): string {
  const prefix = formatPrefix(style, colors);
  const name = formatNameSegment(record.name, colors, formatOptions.name);
  const suffix = formatTimestampSuffix(
    record.timestamp,
    formatOptions.time,
    true,
    colors
  );
  const width = getTerminalWidth();
  const err = record.meta.err;

  if (!(err instanceof Error)) {
    const meta = formatOptions.meta ? formatMetaInline(record.meta) : "";
    const { primary, continuations } = splitMessageLines(record.message, meta);
    const firstLine = finalizeLine(
      `${prefix}${name} ${primary}`,
      suffix,
      width,
      formatOptions.align
    );
    if (continuations.length === 0) {
      return firstLine;
    }
    return [firstLine, ...continuations].join("\n");
  }

  const meta = formatOptions.meta
    ? formatMetaInlineExcluding(record.meta, ERROR_META_KEYS)
    : "";
  const { primary, continuations } = splitMessageLines(record.message, meta);
  const firstLine = finalizeLine(
    `${prefix}${name} ${primary}`,
    suffix,
    width,
    formatOptions.align
  );

  const structuredLines: string[] = [];
  if (record.message !== err.message) {
    structuredLines.push(colors.dim(`${CONTINUATION_INDENT}${err.message}`));
  }

  const stackLines = formatOptions.stack
    ? formatStackDetailLines(err.stack, err.message, colors)
    : [];

  const detailLines = [...continuations, ...structuredLines, ...stackLines];

  if (detailLines.length === 0) {
    return firstLine;
  }

  return [firstLine, "", ...detailLines].join("\n");
}

function isStructuredErrorLevel(level: ActiveLogLevel): boolean {
  return level === "error" || level === "fatal";
}

function formatPretty(
  record: LogRecord,
  formatOptions: ResolvedFormatOptions = DEFAULT_FORMAT_OPTIONS
): string {
  const colors = resolveColors(formatOptions);
  const style = resolveLevelStyle(
    record.level,
    formatOptions.levels[record.level]
  );
  if (isStructuredErrorLevel(record.level)) {
    return formatPrettyError(record, style, formatOptions, colors);
  }
  const meta = formatOptions.meta ? formatMetaInline(record.meta) : "";
  const prefix = formatPrefix(style, colors);
  const name = formatNameSegment(record.name, colors, formatOptions.name);
  const { primary, continuations } = splitMessageLines(record.message, meta);
  const suffix = formatTimestampSuffix(
    record.timestamp,
    formatOptions.time,
    true,
    colors
  );
  const firstLine = finalizeLine(
    `${prefix}${name} ${primary}`,
    suffix,
    getTerminalWidth(),
    formatOptions.align
  );
  if (continuations.length === 0) {
    return firstLine;
  }
  return [firstLine, ...continuations].join("\n");
}

function formatPlain(
  record: LogRecord,
  formatOptions: ResolvedFormatOptions = DEFAULT_FORMAT_OPTIONS
): string {
  const colors = resolveColors(formatOptions);
  const style = resolveLevelStyle(
    record.level,
    formatOptions.levels[record.level]
  );
  const labelWidth = longestLabelWidth(formatOptions.levels);
  const label = style.label.padEnd(labelWidth);
  const meta = formatOptions.meta ? formatMetaInline(record.meta) : "";
  const name = formatNameSegmentPlain(record.name, formatOptions.name);
  const { primary, continuations } = splitMessageLines(record.message, meta);
  const suffix = formatTimestampSuffix(
    record.timestamp,
    formatOptions.time,
    false,
    colors
  );
  const firstLine = finalizeLine(
    `${label}${name} ${primary}`,
    suffix,
    getTerminalWidth(),
    formatOptions.align
  );
  if (continuations.length === 0) {
    return firstLine;
  }
  return [firstLine, ...continuations].join("\n");
}

function formatJson(
  record: LogRecord,
  formatOptions: ResolvedFormatOptions = DEFAULT_FORMAT_OPTIONS
): string {
  const { time } = formatOptions;
  const fieldOrder = resolveJsonFieldOrder(formatOptions.json.fieldOrder);
  const payload: Record<string, unknown> = {};

  for (const group of fieldOrder) {
    switch (group) {
      case "timestamp":
        if (time.enabled) {
          payload.timestamp = formatTimestamp(
            record.timestamp,
            time.format,
            time.timezone
          );
        }
        break;
      case "level":
        payload.level = record.level;
        break;
      case "name":
        if (record.name !== undefined) {
          payload.name = record.name;
        }
        break;
      case "message":
        payload.message = record.message;
        break;
      case "meta":
        for (const key of Object.keys(record.meta).sort()) {
          payload[key] = record.meta[key];
        }
        break;
      default:
        break;
    }
  }

  const indent = resolveJsonIndent(formatOptions.json.pretty);
  return JSON.stringify(payload, metaReplacer, indent);
}

function writeToConsole(
  level: ActiveLogLevel,
  output: string | unknown[]
): void {
  if (isStructuredErrorLevel(level)) {
    if (typeof output === "string") {
      console.error(output);
      return;
    }
    console.error(...output);
    return;
  }
  if (level === "warn") {
    if (typeof output === "string") {
      console.warn(output);
      return;
    }
    console.warn(...output);
    return;
  }
  if (typeof output === "string") {
    console.log(output);
    return;
  }
  console.log(...output);
}

function createConsoleTransport(
  formatOptions: ResolvedFormatOptions
): LogTransport {
  return {
    write(record: LogRecord): void {
      if (isBrowserEnv()) {
        writeToConsole(
          record.level,
          formatBrowserConsole(record, formatOptions)
        );
        return;
      }

      const line = formatOptions.pretty
        ? formatPretty(record, formatOptions)
        : formatPlain(record, formatOptions);
      writeToConsole(record.level, line);
    },
  };
}

function createJsonTransport(
  formatOptions: ResolvedFormatOptions
): LogTransport {
  return {
    write(record: LogRecord): void {
      writeToConsole(record.level, formatJson(record, formatOptions));
    },
  };
}

/** Resolves built-in transport configs into runtime transports. */
export function resolveTransports(
  configs: Transport[],
  formatOptions: ResolvedFormatOptions = DEFAULT_FORMAT_OPTIONS
): LogTransport[] {
  return configs.map((config) => {
    const effective = mergeFormatOptions(formatOptions, config.formatOptions);
    if (config.type === "json") {
      return createJsonTransport(effective);
    }
    return createConsoleTransport(effective);
  });
}

/** Default single console transport. */
export const DEFAULT_TRANSPORTS: Transport[] = [{ type: "console" }];

export { formatJson, formatPlain, formatPretty };
