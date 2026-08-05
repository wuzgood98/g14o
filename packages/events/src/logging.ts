/** Internal logger shape used by `@g14o/events`. Not part of the public API. */
export interface InternalLogger {
  error: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
}

const noop = (): void => {
  /* silent when verbose is off */
};

/** Silent logger used when `verbose` is not enabled. */
export const noopLogger: InternalLogger = {
  info: noop,
  warn: noop,
  error: noop,
};

/** Console-backed logger used when `verbose: true`. */
export const consoleLogger: InternalLogger = {
  info: (...args: unknown[]) => {
    console.info(...args);
  },
  warn: (...args: unknown[]) => {
    console.warn(...args);
  },
  error: (...args: unknown[]) => {
    console.error(...args);
  },
};

/** Resolves the internal logger from the `verbose` option. */
export function resolveLogger(verbose = false): InternalLogger {
  return verbose ? consoleLogger : noopLogger;
}

const eventLoggers = new WeakMap<object, InternalLogger>();

/** Associates an internal logger with a bus instance. @internal */
export function bindEventLogger(bus: object, logger: InternalLogger): void {
  eventLoggers.set(bus, logger);
}

/** Resolves the logger bound to a bus, or {@link noopLogger}. @internal */
export function getEventLogger(bus: object): InternalLogger {
  return eventLoggers.get(bus) ?? noopLogger;
}
