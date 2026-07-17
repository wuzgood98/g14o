import type {
  ActiveLogLevel,
  FormatOptions,
  JsonFieldGroup,
  JsonFormatOptions,
  LevelFormatOptions,
  ResolvedFormatOptions,
  ResolvedJsonFormatOptions,
  TimestampOption,
} from "../types";
import { MIN_ALIGN_COLUMNS } from "./display";
import { DEFAULT_TIMESTAMP_CONFIG, resolveTimestampConfig } from "./timestamp";

/** Default JSON field group order. */
export const DEFAULT_JSON_FIELD_ORDER: JsonFieldGroup[] = [
  "timestamp",
  "level",
  "name",
  "message",
  "meta",
];

/** Default resolved JSON format options. */
export const DEFAULT_JSON_FORMAT_OPTIONS: ResolvedJsonFormatOptions = {
  fieldOrder: DEFAULT_JSON_FIELD_ORDER,
  pretty: false,
};

/** Default resolved format options (matches current logger defaults). */
export const DEFAULT_FORMAT_OPTIONS: ResolvedFormatOptions = {
  time: DEFAULT_TIMESTAMP_CONFIG,
  meta: true,
  name: true,
  align: MIN_ALIGN_COLUMNS,
  colors: "auto",
  stack: true,
  pretty: false,
  levels: {},
  json: DEFAULT_JSON_FORMAT_OPTIONS,
};

function mergeLevelOverrides(
  base: Partial<Record<ActiveLogLevel, LevelFormatOptions>>,
  override: Partial<Record<ActiveLogLevel, LevelFormatOptions>> | undefined
): Partial<Record<ActiveLogLevel, LevelFormatOptions>> {
  if (!override) {
    return { ...base };
  }

  const merged: Partial<Record<ActiveLogLevel, LevelFormatOptions>> = {
    ...base,
  };

  for (const [level, options] of Object.entries(override) as [
    ActiveLogLevel,
    LevelFormatOptions | undefined,
  ][]) {
    if (!options) {
      continue;
    }
    merged[level] = { ...merged[level], ...options };
  }

  return merged;
}

function resolveJsonFormatOptions(
  options: JsonFormatOptions | undefined,
  base: ResolvedJsonFormatOptions = DEFAULT_JSON_FORMAT_OPTIONS
): ResolvedJsonFormatOptions {
  return {
    fieldOrder: options?.fieldOrder ?? base.fieldOrder,
    pretty: options?.pretty ?? base.pretty,
  };
}

/**
 * Normalizes partial `FormatOptions` into a fully resolved config.
 * When `base` is provided, omitted keys inherit from `base` (for transport overrides).
 */
export function resolveFormatOptions(
  options: FormatOptions | undefined,
  base: ResolvedFormatOptions = DEFAULT_FORMAT_OPTIONS
): ResolvedFormatOptions {
  if (!options) {
    return {
      ...base,
      time: { ...base.time },
      levels: { ...base.levels },
      json: {
        fieldOrder: [...base.json.fieldOrder],
        pretty: base.json.pretty,
      },
    };
  }

  const timeOption: TimestampOption | undefined =
    options.time === undefined ? undefined : options.time;

  return {
    time:
      timeOption === undefined
        ? { ...base.time }
        : resolveTimestampConfig(timeOption),
    meta: options.meta ?? base.meta,
    name: options.name ?? base.name,
    align: options.align ?? base.align,
    colors: options.colors ?? base.colors,
    stack: options.stack ?? base.stack,
    pretty: options.pretty ?? base.pretty,
    levels: mergeLevelOverrides(base.levels, options.levels),
    json: resolveJsonFormatOptions(options.json, base.json),
  };
}

/**
 * Deep-merges transport `formatOptions` over already-resolved logger options.
 */
export function mergeFormatOptions(
  base: ResolvedFormatOptions,
  override: FormatOptions | undefined
): ResolvedFormatOptions {
  return resolveFormatOptions(override, base);
}

/** Clamps JSON indentation to the range accepted by `JSON.stringify` (0–10). */
export function resolveJsonIndent(
  pretty: boolean | number
): number | undefined {
  if (pretty === false) {
    return;
  }
  if (pretty === true) {
    return 2;
  }
  if (pretty < 0) {
    return 0;
  }
  if (pretty > 10) {
    return 10;
  }
  return Math.floor(pretty);
}

/**
 * Resolves JSON field groups: unique requested groups first, then any missing
 * defaults appended in default order.
 */
export function resolveJsonFieldOrder(
  requested: readonly JsonFieldGroup[] | undefined
): JsonFieldGroup[] {
  const order = requested ?? DEFAULT_JSON_FIELD_ORDER;
  const seen = new Set<JsonFieldGroup>();
  const result: JsonFieldGroup[] = [];

  for (const group of order) {
    if (seen.has(group)) {
      continue;
    }
    seen.add(group);
    result.push(group);
  }

  for (const group of DEFAULT_JSON_FIELD_ORDER) {
    if (seen.has(group)) {
      continue;
    }
    result.push(group);
  }

  return result;
}
