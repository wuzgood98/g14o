/** Minimal logger shape for package verbose diagnostics. */
export interface VerboseLogger {
  error(...args: unknown[]): void;
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
}

export interface ResolveVerboseLoggerOptions {
  /** Optional injectable logger; wins over `verbose`. */
  logger?: VerboseLogger;
  /** Zero-config console adapter when true and no `logger`. */
  verbose?: boolean;
}

const noop = (): void => {
  /* silent when verbose is off */
};

/** Silent logger used when verbose diagnostics are disabled. */
export const noopVerboseLogger: VerboseLogger = {
  info: noop,
  warn: noop,
  error: noop,
};

/** Console-backed logger used when `verbose: true`. */
export const consoleVerboseLogger: VerboseLogger = {
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

/** Resolves verbose diagnostics logging from boolean or options. */
export function resolveVerboseLogger(
  options?: boolean | ResolveVerboseLoggerOptions
): VerboseLogger {
  if (typeof options === "boolean") {
    return options ? consoleVerboseLogger : noopVerboseLogger;
  }

  if (options?.logger) {
    return options.logger;
  }

  if (options?.verbose) {
    return consoleVerboseLogger;
  }

  return noopVerboseLogger;
}
