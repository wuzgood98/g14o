import { DEFAULT_TRANSPORTS, resolveTransports } from "./transports";
import type {
  Logger,
  LoggerOptions,
  LogLevel,
  LogRecord,
  LogTransport,
} from "./types";
import { resolveFormatOptions } from "./utils/format-options";
import { generateRequestId } from "./utils/id";
import {
  DEFAULT_LOG_LEVEL,
  DEFAULT_REDACT_KEYS,
  shouldLog,
} from "./utils/levels";
import { normalizeLogArgs } from "./utils/normalize-args";
import { redactMeta } from "./utils/redact";
import { monotonicNow } from "./utils/timing";

interface LoggerState {
  bindings: Record<string, unknown>;
  level: LogLevel;
  name?: string;
  redactKeys: readonly string[];
  transports: LogTransport[];
}

function mergeMeta(
  bindings: Record<string, unknown>,
  meta: Record<string, unknown> | undefined
): Record<string, unknown> {
  if (!meta || Object.keys(meta).length === 0) {
    return { ...bindings };
  }
  return { ...bindings, ...meta };
}

function createTimestamp(): string {
  return new Date().toISOString();
}

function writeLog(
  state: LoggerState,
  level: Exclude<LogLevel, "silent">,
  args: unknown[]
): void {
  if (!shouldLog(state.level, level)) {
    return;
  }

  const { message, meta } = normalizeLogArgs(args);
  const mergedMeta = mergeMeta(state.bindings, meta);
  const redactedMeta = redactMeta(mergedMeta, state.redactKeys);

  const record: LogRecord = {
    timestamp: createTimestamp(),
    level,
    name: state.name,
    message,
    meta: redactedMeta,
  };

  for (const transport of state.transports) {
    transport.write(record);
  }
}

function createLogMethod(
  state: LoggerState,
  level: Exclude<LogLevel, "silent">
): (...args: unknown[]) => void {
  return (...args: unknown[]): void => {
    writeLog(state, level, args);
  };
}

function createLoggerFromState(state: LoggerState): Logger {
  return {
    trace: createLogMethod(state, "trace"),
    debug: createLogMethod(state, "debug"),
    info: createLogMethod(state, "info"),
    success: createLogMethod(state, "success"),
    start: createLogMethod(state, "start"),
    warn: createLogMethod(state, "warn"),
    error: createLogMethod(state, "error"),
    fatal: createLogMethod(state, "fatal"),
    child(bindings: Record<string, unknown>): Logger {
      return createLoggerFromState({
        ...state,
        bindings: mergeMeta(state.bindings, bindings),
      });
    },
    time(label: string, meta?: Record<string, unknown>) {
      const startedAt = monotonicNow();
      return (endMeta?: Record<string, unknown>): void => {
        const durationMs = Math.round(monotonicNow() - startedAt);
        writeLog(state, "success", [
          label,
          { ...meta, ...endMeta, durationMs },
        ]);
      };
    },
    withRequestId(id?: string): Logger {
      return createLoggerFromState({
        ...state,
        bindings: mergeMeta(state.bindings, {
          requestId: id ?? generateRequestId(),
        }),
      });
    },
  };
}

/**
 * Creates a structured logger with configurable level, transports, and redaction.
 */
export function createLogger(options: LoggerOptions = {}): Logger {
  const transportConfigs = options.transports ?? DEFAULT_TRANSPORTS;
  const redactKeys =
    options.redact === undefined ? DEFAULT_REDACT_KEYS : options.redact;
  const formatOptions = resolveFormatOptions(options.formatOptions);

  const state: LoggerState = {
    level: options.level ?? DEFAULT_LOG_LEVEL,
    name: options.name,
    redactKeys,
    transports: resolveTransports(transportConfigs, formatOptions),
    bindings: {},
  };

  return createLoggerFromState(state);
}
