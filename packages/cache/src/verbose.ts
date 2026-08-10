/** Minimal logger shape for package verbose diagnostics. */
export interface VerboseLogger {
  error(...args: unknown[]): void;
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
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

/** Resolves verbose diagnostics logging from boolean or injectable adapter. */
export function resolveVerboseLogger(
  verbose?: boolean | VerboseLogger
): VerboseLogger {
  if (verbose && typeof verbose === "object") {
    return verbose;
  }

  return verbose ? consoleVerboseLogger : noopVerboseLogger;
}
