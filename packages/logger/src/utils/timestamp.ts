import type {
  ResolvedTimestampConfig,
  TimestampFormat,
  TimestampOption,
  TimestampTimezone,
} from "../types";

/** Default format when `time` is enabled but `format` is omitted. */
export const DEFAULT_TIMESTAMP_FORMAT: TimestampFormat = "time";

/** Default timezone when `time` is enabled but `timezone` is omitted. */
export const DEFAULT_TIMESTAMP_TIMEZONE: TimestampTimezone = "utc";

/** Default resolved timestamp config (enabled, `"time"` format, `"utc"`). */
export const DEFAULT_TIMESTAMP_CONFIG: ResolvedTimestampConfig = {
  enabled: true,
  format: DEFAULT_TIMESTAMP_FORMAT,
  timezone: DEFAULT_TIMESTAMP_TIMEZONE,
};

/** Normalizes a `time` option into a resolved config. */
export function resolveTimestampConfig(
  option: TimestampOption | undefined
): ResolvedTimestampConfig {
  if (option === undefined || option === true) {
    return DEFAULT_TIMESTAMP_CONFIG;
  }
  if (option === false) {
    return {
      enabled: false,
      format: DEFAULT_TIMESTAMP_FORMAT,
      timezone: DEFAULT_TIMESTAMP_TIMEZONE,
    };
  }
  if (!option.enabled) {
    return {
      enabled: false,
      format: DEFAULT_TIMESTAMP_FORMAT,
      timezone: DEFAULT_TIMESTAMP_TIMEZONE,
    };
  }
  return {
    enabled: true,
    format: option.format ?? DEFAULT_TIMESTAMP_FORMAT,
    timezone: option.timezone ?? DEFAULT_TIMESTAMP_TIMEZONE,
  };
}

function formatTimeOfDay(
  date: Date,
  timezone: TimestampTimezone,
  twelveHour: boolean
): string {
  let hours = timezone === "local" ? date.getHours() : date.getUTCHours();
  const minutes =
    timezone === "local" ? date.getMinutes() : date.getUTCMinutes();
  const seconds =
    timezone === "local" ? date.getSeconds() : date.getUTCSeconds();

  if (twelveHour) {
    const meridiem = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;
    const hh = String(hours).padStart(2, "0");
    const mm = String(minutes).padStart(2, "0");
    const ss = String(seconds).padStart(2, "0");
    return `${hh}:${mm}:${ss} ${meridiem}`;
  }

  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

/** Formats an ISO timestamp according to the given format and timezone. */
export function formatTimestamp(
  iso: string,
  format: TimestampFormat,
  timezone: TimestampTimezone = DEFAULT_TIMESTAMP_TIMEZONE
): string {
  switch (format) {
    case "iso":
      return iso;
    case "utcString":
      return timezone === "local"
        ? new Date(iso).toString()
        : new Date(iso).toUTCString();
    case "time12":
      return formatTimeOfDay(new Date(iso), timezone, true);
    default:
      return formatTimeOfDay(new Date(iso), timezone, false);
  }
}
