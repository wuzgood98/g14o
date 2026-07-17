import type {
  ActiveLogLevel,
  LevelFormatOptions,
  LevelPrefixKind,
  LogRecord,
  ResolvedFormatOptions,
  ResolvedTimestampConfig,
} from "./types";
import { forceTextPresentation, selectGlyph } from "./utils/display";
import { DEFAULT_FORMAT_OPTIONS } from "./utils/format-options";
import { safeJsonStringify } from "./utils/safe-json";
import { normalizeStack } from "./utils/stack";
import { formatTimestamp } from "./utils/timestamp";

const DIM_STYLE = "color: #9ca3af";
const WHITE_STYLE = "color: #e5e7eb";
const GREEN_STYLE = "color: #00d7af";
const CONTINUATION_INDENT = "  ";

interface BrowserLevelStyle {
  badgeStyle?: string;
  fallbackSymbol: string;
  kind: LevelPrefixKind;
  label: string;
  symbolStyle?: string;
  unicodeSymbol: string;
}

const BROWSER_LEVEL_STYLES: Record<ActiveLogLevel, BrowserLevelStyle> = {
  trace: {
    kind: "symbol",
    unicodeSymbol: "·",
    fallbackSymbol: ".",
    label: "TRACE",
    symbolStyle: "color: #9ca3af",
  },
  debug: {
    kind: "symbol",
    unicodeSymbol: "●",
    fallbackSymbol: "*",
    label: "DEBUG",
    symbolStyle: "color: #8787af",
  },
  info: {
    kind: "symbol",
    unicodeSymbol: "i",
    fallbackSymbol: "i",
    label: "INFO",
    symbolStyle: "color: #00afaf",
  },
  success: {
    kind: "symbol",
    unicodeSymbol: "√",
    fallbackSymbol: "v",
    label: "SUCCESS",
    symbolStyle: "color: #4ade80",
  },
  start: {
    kind: "symbol",
    unicodeSymbol: "◐",
    fallbackSymbol: "o",
    label: "START",
    symbolStyle: "color: #c026d3",
  },
  warn: {
    kind: "badge",
    unicodeSymbol: "⚠",
    fallbackSymbol: "‼",
    label: "WARN",
    badgeStyle:
      "background: #fde047; color: #111827; font-weight: bold; padding: 0 4px; border-radius: 2px",
    symbolStyle: "color: #fde047",
  },
  error: {
    kind: "badge",
    unicodeSymbol: "✖",
    fallbackSymbol: "×",
    label: "ERROR",
    badgeStyle:
      "background: #ef4444; color: #ffffff; font-weight: bold; padding: 0 4px; border-radius: 2px",
    symbolStyle: "color: #ef4444",
  },
  fatal: {
    kind: "badge",
    unicodeSymbol: "☠",
    fallbackSymbol: "×",
    label: "FATAL",
    badgeStyle:
      "background: #7f1d1d; color: #ffffff; font-weight: bold; padding: 0 4px; border-radius: 2px",
    symbolStyle: "color: #7f1d1d",
  },
};

function resolveBrowserLevelStyle(
  level: ActiveLogLevel,
  override: LevelFormatOptions | undefined
): BrowserLevelStyle {
  const base = BROWSER_LEVEL_STYLES[level];
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
  for (const level of Object.keys(BROWSER_LEVEL_STYLES) as ActiveLogLevel[]) {
    const style = resolveBrowserLevelStyle(level, levels[level]);
    longest = Math.max(longest, style.label.length);
  }
  return longest;
}

interface BrowserSegment {
  style?: string;
  text: string;
}

function browserColorsEnabled(formatOptions: ResolvedFormatOptions): boolean {
  return formatOptions.colors !== false;
}

function styled(
  text: string,
  style: string | undefined,
  colorsEnabled: boolean
): BrowserSegment {
  if (colorsEnabled && style) {
    return { text, style };
  }
  return { text };
}

function escapeConsoleText(text: string): string {
  return text.replaceAll("%", "%%");
}

function buildConsoleArgs(segments: BrowserSegment[]): unknown[] {
  let format = "";
  const styles: string[] = [];
  const hasStyledSegment = segments.some((segment) => segment.style);

  for (const segment of segments) {
    if (hasStyledSegment) {
      format += `%c${escapeConsoleText(segment.text)}`;
      styles.push(segment.style ?? "");
      continue;
    }
    format += escapeConsoleText(segment.text);
  }

  return [format, ...styles];
}

function formatMetaInline(meta: Record<string, unknown>): string {
  const keys = Object.keys(meta);
  if (keys.length === 0) {
    return "";
  }
  return ` ${safeJsonStringify(meta)}`;
}

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

function formatNameSegment(
  name: string | undefined,
  showName: boolean
): string {
  if (!(showName && name)) {
    return "";
  }
  return ` [${name}]`;
}

function formatTimestampSuffix(
  iso: string,
  config: ResolvedTimestampConfig
): string {
  if (!config.enabled) {
    return "";
  }
  return ` ${formatTimestamp(iso, config.format, config.timezone)}`;
}

function appendStackFrameSegments(
  segments: BrowserSegment[],
  frame: NonNullable<ReturnType<typeof normalizeStack>[number]["frame"]>,
  prefix: string,
  colorsEnabled: boolean
): void {
  if (frame.parenthesized) {
    segments.push(styled(`${prefix}at `, DIM_STYLE, colorsEnabled));
    segments.push(styled(frame.descriptor, WHITE_STYLE, colorsEnabled));
    segments.push(styled(" (", WHITE_STYLE, colorsEnabled));
    segments.push(styled(frame.location, GREEN_STYLE, colorsEnabled));
    segments.push(styled(")", WHITE_STYLE, colorsEnabled));
    return;
  }

  segments.push(styled(`${prefix}at `, DIM_STYLE, colorsEnabled));
  segments.push(styled(frame.location, GREEN_STYLE, colorsEnabled));
}

function appendStackDetailSegments(
  segments: BrowserSegment[],
  stack: string | undefined,
  message: string,
  colorsEnabled: boolean
): void {
  for (const detail of normalizeStack(stack, message)) {
    if (detail.frame) {
      appendStackFrameSegments(
        segments,
        detail.frame,
        `\n${CONTINUATION_INDENT}`,
        colorsEnabled
      );
      continue;
    }
    segments.push(
      styled(`\n${CONTINUATION_INDENT}${detail.line}`, DIM_STYLE, colorsEnabled)
    );
  }
}

function appendPrefixSegments(
  segments: BrowserSegment[],
  style: BrowserLevelStyle,
  pretty: boolean,
  colorsEnabled: boolean,
  labelWidth: number
): void {
  if (pretty) {
    if (style.kind === "badge") {
      segments.push(
        styled(` ${style.label} `, style.badgeStyle, colorsEnabled)
      );
      return;
    }
    segments.push(
      styled(
        forceTextPresentation(
          selectGlyph(style.unicodeSymbol, style.fallbackSymbol)
        ),
        style.symbolStyle,
        colorsEnabled
      )
    );
    return;
  }

  segments.push({ text: style.label.padEnd(labelWidth) });
}

/**
 * Formats a level prefix using an explicit kind override.
 * Useful for verifying badge vs symbol styling without changing defaults.
 */
export function formatBrowserLevelPrefix(
  level: ActiveLogLevel,
  kind: LevelPrefixKind
): unknown[] {
  const segments: BrowserSegment[] = [];
  appendPrefixSegments(
    segments,
    { ...BROWSER_LEVEL_STYLES[level], kind },
    true,
    true,
    BROWSER_LEVEL_STYLES[level].label.length
  );
  return buildConsoleArgs(segments);
}

function splitMessage(message: string): {
  first: string;
  rest: string[];
} {
  const [first = "", ...rest] = message.split("\n");
  return { first, rest };
}

function appendContinuationSegments(
  segments: BrowserSegment[],
  lines: readonly string[]
): void {
  for (const line of lines) {
    segments.push({ text: `\n${CONTINUATION_INDENT}${line}` });
  }
}

const ERROR_META_KEYS = ["err", "error"] as const;

function formatBrowserPrettyError(
  record: LogRecord,
  style: BrowserLevelStyle,
  formatOptions: ResolvedFormatOptions
): unknown[] {
  const colorsEnabled = browserColorsEnabled(formatOptions);
  const labelWidth = longestLabelWidth(formatOptions.levels);
  const segments: BrowserSegment[] = [];
  appendPrefixSegments(segments, style, true, colorsEnabled, labelWidth);
  if (formatOptions.name && record.name) {
    segments.push(
      styled(formatNameSegment(record.name, true), DIM_STYLE, colorsEnabled)
    );
  }
  segments.push({ text: " " });

  const { first, rest } = splitMessage(record.message);
  const err = record.meta.err;

  if (!(err instanceof Error)) {
    segments.push({ text: first });
    if (formatOptions.meta) {
      segments.push({ text: formatMetaInline(record.meta) });
    }
    segments.push(
      styled(
        formatTimestampSuffix(record.timestamp, formatOptions.time),
        DIM_STYLE,
        colorsEnabled
      )
    );
    appendContinuationSegments(segments, rest);
    return buildConsoleArgs(segments);
  }

  segments.push({ text: first });
  if (formatOptions.meta) {
    segments.push({
      text: formatMetaInlineExcluding(record.meta, ERROR_META_KEYS),
    });
  }
  segments.push(
    styled(
      formatTimestampSuffix(record.timestamp, formatOptions.time),
      DIM_STYLE,
      colorsEnabled
    )
  );

  const detailSegments: BrowserSegment[] = [];
  const stackDetails = formatOptions.stack
    ? normalizeStack(err.stack, err.message)
    : [];
  const hasStructuredMessage = record.message !== err.message;
  const hasDetails =
    rest.length > 0 || hasStructuredMessage || stackDetails.length > 0;

  if (hasDetails) {
    detailSegments.push({ text: "\n" });
  }

  appendContinuationSegments(detailSegments, rest);

  if (hasStructuredMessage) {
    detailSegments.push(
      styled(`\n${CONTINUATION_INDENT}${err.message}`, DIM_STYLE, colorsEnabled)
    );
  }

  if (formatOptions.stack) {
    appendStackDetailSegments(
      detailSegments,
      err.stack,
      err.message,
      colorsEnabled
    );
  }

  if (detailSegments.length === 0) {
    return buildConsoleArgs(segments);
  }

  return buildConsoleArgs([...segments, ...detailSegments]);
}

function isStructuredErrorLevel(level: ActiveLogLevel): boolean {
  return level === "error" || level === "fatal";
}

function formatBrowserPretty(
  record: LogRecord,
  formatOptions: ResolvedFormatOptions = DEFAULT_FORMAT_OPTIONS
): unknown[] {
  const style = resolveBrowserLevelStyle(
    record.level,
    formatOptions.levels[record.level]
  );
  if (isStructuredErrorLevel(record.level)) {
    return formatBrowserPrettyError(record, style, formatOptions);
  }

  const colorsEnabled = browserColorsEnabled(formatOptions);
  const labelWidth = longestLabelWidth(formatOptions.levels);
  const segments: BrowserSegment[] = [];
  appendPrefixSegments(segments, style, true, colorsEnabled, labelWidth);
  if (formatOptions.name && record.name) {
    segments.push(
      styled(formatNameSegment(record.name, true), DIM_STYLE, colorsEnabled)
    );
  }
  segments.push({ text: " " });

  const { first, rest } = splitMessage(record.message);
  segments.push({ text: first });
  if (formatOptions.meta) {
    segments.push({ text: formatMetaInline(record.meta) });
  }
  segments.push(
    styled(
      formatTimestampSuffix(record.timestamp, formatOptions.time),
      DIM_STYLE,
      colorsEnabled
    )
  );
  appendContinuationSegments(segments, rest);

  return buildConsoleArgs(segments);
}

function formatBrowserPlain(
  record: LogRecord,
  formatOptions: ResolvedFormatOptions = DEFAULT_FORMAT_OPTIONS
): unknown[] {
  const style = resolveBrowserLevelStyle(
    record.level,
    formatOptions.levels[record.level]
  );
  const labelWidth = longestLabelWidth(formatOptions.levels);
  const meta = formatOptions.meta ? formatMetaInline(record.meta) : "";
  const name = formatNameSegment(record.name, formatOptions.name);
  const [first = "", ...rest] = record.message.split("\n");
  const firstLine = `${style.label.padEnd(labelWidth)}${name} ${first}${meta}${formatTimestampSuffix(record.timestamp, formatOptions.time)}`;
  if (rest.length === 0) {
    return [firstLine];
  }
  const continuations = rest
    .map((line) => `${CONTINUATION_INDENT}${line}`)
    .join("\n");
  return [`${firstLine}\n${continuations}`];
}

/**
 * Formats a log record for browser `console.*` calls.
 * Returns a format string plus optional `%c` CSS style arguments.
 * Pretty vs plain is controlled by `formatOptions.pretty`.
 */
export function formatBrowserConsole(
  record: LogRecord,
  formatOptions: ResolvedFormatOptions = DEFAULT_FORMAT_OPTIONS
): unknown[] {
  if (formatOptions.pretty) {
    return formatBrowserPretty(record, formatOptions);
  }
  return formatBrowserPlain(record, formatOptions);
}
