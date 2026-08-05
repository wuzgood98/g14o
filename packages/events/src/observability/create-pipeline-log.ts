import type { EventBusHooks } from "../bus/hooks";
import type { MutableEventContext } from "../types/context";

const DEFAULT_MAX_ENTRIES = 50;

export interface PipelineLogOptions {
  /** Format a pipeline-end log line. */
  formatEnd?: (ctx: MutableEventContext<unknown>) => string;
  /** Format a pipeline-start log line. */
  formatStart?: (ctx: MutableEventContext<unknown>) => string;
  /** Max middleware log entries retained in memory. */
  maxEntries?: number;
}

export interface PipelineLogStore {
  clearLogs: () => void;
  getErrorLog: () => readonly Error[];
  getMiddlewareLog: () => readonly string[];
  hooks: EventBusHooks;
  subscribe: (listener: () => void) => () => void;
}

/** In-memory pipeline log store with {@link EventBusHooks}. */
export function createPipelineLog(
  options: PipelineLogOptions = {}
): PipelineLogStore {
  const maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
  const formatStart = options.formatStart ?? ((ctx) => `→ ${ctx.name}`);
  const formatEnd = options.formatEnd ?? ((ctx) => `← ${ctx.name}`);

  const middlewareLog: string[] = [];
  const errorLog: Error[] = [];
  const listeners = new Set<() => void>();
  let middlewareSnapshot: readonly string[] = [];
  let errorSnapshot: readonly Error[] = [];

  const refreshSnapshots = (): void => {
    middlewareSnapshot = [...middlewareLog];
    errorSnapshot = [...errorLog];
  };

  const notify = (): void => {
    refreshSnapshots();
    for (const listener of listeners) {
      listener();
    }
  };

  const trim = <T>(log: T[]): void => {
    while (log.length > maxEntries) {
      log.shift();
    }
  };

  const pushError = (error: Error): void => {
    errorLog.push(error);
    trim(errorLog);
    notify();
  };

  const hooks: EventBusHooks = {
    onPipelineStart: (ctx) => {
      middlewareLog.push(formatStart(ctx));
      trim(middlewareLog);
      notify();
    },
    onPipelineEnd: (ctx) => {
      middlewareLog.push(formatEnd(ctx));
      trim(middlewareLog);
      notify();
    },
    onValidationError: (error) => {
      pushError(error);
    },
    onError: (error) => {
      pushError(error);
    },
  };

  return {
    hooks,
    getMiddlewareLog: () => middlewareSnapshot,
    getErrorLog: () => errorSnapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    clearLogs: () => {
      middlewareLog.length = 0;
      errorLog.length = 0;
      notify();
    },
  };
}
