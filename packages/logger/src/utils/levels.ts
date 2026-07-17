import type { LogLevel } from "../types";

const LEVEL_RANK: Record<Exclude<LogLevel, "silent">, number> = {
  trace: 0,
  debug: 10,
  info: 20,
  success: 20,
  start: 20,
  warn: 30,
  error: 40,
  fatal: 50,
};

/** Returns true when `level` meets or exceeds `threshold`. */
export function shouldLog(threshold: LogLevel, level: LogLevel): boolean {
  if (threshold === "silent" || level === "silent") {
    return false;
  }
  return LEVEL_RANK[level] >= LEVEL_RANK[threshold];
}

/** Default log level when none is provided. */
export const DEFAULT_LOG_LEVEL: LogLevel = "info";

/** Default redaction key names. */
export const DEFAULT_REDACT_KEYS: readonly string[] = [
  "password",
  "token",
  "authorization",
];
